import { useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { parseArmazemT1MetaFile, type ArmazemT1MetaIndicador, type ParsedArmazemT1MetaRow } from '@/lib/armazem-t1-meta-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { Unidade } from '@/types'

const BATCH_SIZE = 500
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ANOS_IMPORT = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

/** Cada indicador tem sua própria tabela de meta (unidade, ano, mes, valor) — ver migration_060. */
const TABELAS: Record<ArmazemT1MetaIndicador, string> = {
  tma: 'metas_armazem_t1_tma',
  disponibilidade_gente: 'metas_armazem_t1_disponibilidade_gente',
  presenteismo_al: 'metas_armazem_t1_presenteismo_al',
}

/**
 * Importa a meta mensal do Armazém T1 (Estância/CDR Bahia) — TMA,
 * Disponibilidade de Gente e Presenteísmo AL empilhados numa planilha só,
 * coluna INDICADOR diz qual é qual (mesmo padrão do resultado do BI).
 * Aceita INDICADOR · UNIDADE · META (um mês, escolhido na tela) ou
 * INDICADOR · UNIDADE · JAN · FEV · ... (histórico, só a primeira
 * importação). TMA em duração (HH:MM → minutos); os outros dois em %.
 */
export function ImportarMetasArmazemT1() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [file, setFile] = useState<File | null>(null)
  const [anoImport, setAnoImport] = useState(String(new Date().getFullYear()))
  const [mesImport, setMesImport] = useState(String(new Date().getMonth() + 1))
  const [linhas, setLinhas] = useState<ParsedArmazemT1MetaRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  const formatoHistorico = useMemo(() => linhas.some(l => l.mes !== undefined), [linhas])

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseArmazemT1MetaFile(f)
      setLinhas(resultado.linhas)
      setErrosParse(resultado.erros)
    } catch (err) {
      setLinhas([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  const resolucao = useMemo(() => {
    const resolvidas: { linha: ParsedArmazemT1MetaRow; unidade: Unidade }[] = []
    const naoReconhecidas = new Set<string>()
    for (const linha of linhas) {
      const unidade = resolverUnidade(linha.unidade, unidades)
      if (unidade) resolvidas.push({ linha, unidade })
      else naoReconhecidas.add(linha.unidade)
    }
    return { resolvidas, naoReconhecidas: Array.from(naoReconhecidas).sort() }
  }, [linhas, unidades])

  async function handleImportar() {
    const ano = Number(anoImport)
    const mesSelecionado = Number(mesImport)
    const porTabela = new Map<string, Map<string, { unidade: string; ano: number; mes: number; valor: number }>>()
    for (const { linha, unidade } of resolucao.resolvidas) {
      const mes = linha.mes ?? mesSelecionado
      const tabela = TABELAS[linha.indicador]
      if (!porTabela.has(tabela)) porTabela.set(tabela, new Map())
      porTabela.get(tabela)!.set(`${unidade.codigo}|${mes}`, { unidade: unidade.codigo, ano, mes, valor: linha.valor })
    }

    const totalRegistros = Array.from(porTabela.values()).reduce((acc, m) => acc + m.size, 0)
    if (totalRegistros === 0) return

    setImportando(true)
    try {
      for (const [tabela, mapa] of porTabela) {
        const registros = Array.from(mapa.values())
        for (let i = 0; i < registros.length; i += BATCH_SIZE) {
          const batch = registros.slice(i, i + BATCH_SIZE)
          const { error } = await supabase.from(tabela).upsert(batch, { onConflict: 'unidade,ano,mes' })
          if (error) throw new Error(error.message)
        }
      }
      toast({
        title: `${totalRegistros} meta(s) do Armazém T1 importada(s)`,
        description: formatoHistorico ? `Histórico — vários meses de ${ano}.` : `${MESES_NOMES[mesSelecionado - 1]}/${ano}.`,
      })
      setFile(null)
      setLinhas([])
      setErrosParse([])
    } catch (err) {
      toast({ title: 'Erro ao importar metas do Armazém T1', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      <h2 className="text-base font-semibold">Armazém T1 (Estância / CDR Bahia) — meta mensal</h2>
      <p className="text-sm text-muted-foreground">
        Suba a planilha (Excel ou CSV) com as colunas{' '}
        <span className="font-mono text-xs">INDICADOR · UNIDADE · META</span> — os 3 indicadores podem vir
        empilhados no mesmo arquivo, a coluna INDICADOR diz qual é qual (TMA, DISPONIBILIDADE DE GENTE, PRESENTEÍSMO
        AL). Também aceita <span className="font-mono text-xs">INDICADOR · UNIDADE · JAN · FEV · ...</span> no lugar
        de META — formato histórico, só a primeira importação. TMA em duração (ex: "01:40"), os outros dois em %.
      </p>

      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Select value={anoImport} onValueChange={setAnoImport}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS_IMPORT.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {!formatoHistorico && (
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Select value={mesImport} onValueChange={setMesImport}>
              <SelectTrigger className={cn('w-40', selectGlamour)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <FilePickerButton label="Planilha (.xlsx ou .csv)" accept=".xlsx,.xls,.csv,.txt" file={file} onFile={handleFile} />
      </div>

      {formatoHistorico && (
        <div className="rounded-lg border border-blue-300/50 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400">
          Formato histórico detectado (colunas de mês) — cada mês da planilha vai ser gravado no seu próprio mês, dentro do ano selecionado acima.
        </div>
      )}

      {errosParse.length > 0 && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <p className="mb-1 font-semibold">{errosParse.length} problema(s) no arquivo:</p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto">
            {errosParse.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {resolucao.naoReconhecidas.length > 0 && (
        <div className="rounded-lg border border-red-300/50 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <p className="mb-1 font-semibold">
            {resolucao.naoReconhecidas.length} unidade(s) não reconhecida(s) — cadastre como apelido na Administração e suba de novo:
          </p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
            {resolucao.naoReconhecidas.map(o => <li key={o}>{o}</li>)}
          </ul>
        </div>
      )}

      {file && (
        <div className="flex items-center gap-3">
          <Button onClick={handleImportar} disabled={resolucao.resolvidas.length === 0 || importando} className="gap-2">
            {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar {resolucao.resolvidas.length} meta(s)
          </Button>
          <Button variant="outline" onClick={() => { setFile(null); setLinhas([]); setErrosParse([]) }} disabled={importando}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}
