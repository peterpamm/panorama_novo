import { useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { parseDistribuicaoBiFile, type ParsedDistribuicaoBiRow } from '@/lib/distribuicao-bi-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { ResultadoDistribuicaoBi, Unidade } from '@/types'

const BATCH_SIZE = 500
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ANOS_IMPORT = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

/**
 * Importa o resultado mensal dos indicadores de RV da Distribuição que vêm
 * do BI numa planilha compartilhada — LogOn DU, Devolução e Presenteísmo DU
 * empilhados no mesmo arquivo, uma coluna INDICADOR diz qual é qual. Cada
 * arquivo é o resultado de um único mês/ano pra todas as unidades.
 */
export function ImportarResultadosDistribuicaoBi() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [file, setFile] = useState<File | null>(null)
  const [anoImport, setAnoImport] = useState(String(new Date().getFullYear()))
  const [mesImport, setMesImport] = useState(String(new Date().getMonth() + 1))
  const [linhas, setLinhas] = useState<ParsedDistribuicaoBiRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseDistribuicaoBiFile(f)
      setLinhas(resultado.linhas)
      setErrosParse(resultado.erros)
    } catch (err) {
      setLinhas([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  const resolucao = useMemo(() => {
    const resolvidas: { linha: ParsedDistribuicaoBiRow; unidade: Unidade }[] = []
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
    const mes = Number(mesImport)
    const porChave = new Map<string, Omit<ResultadoDistribuicaoBi, 'id'>>()
    for (const { linha, unidade } of resolucao.resolvidas) {
      porChave.set(`${linha.indicador}|${unidade.codigo}|${linha.negocio}`, {
        indicador: linha.indicador, unidade: unidade.codigo, negocio: linha.negocio, ano, mes, valor: linha.valor,
      })
    }
    const registros = Array.from(porChave.values())
    if (registros.length === 0) return

    setImportando(true)
    try {
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('resultados_distribuicao_bi')
          .upsert(batch, { onConflict: 'indicador,unidade,negocio,ano,mes' })
        if (error) throw new Error(error.message)
      }
      toast({ title: `${registros.length} resultado(s) importado(s) pra ${MESES_NOMES[mes - 1]}/${ano}` })
      setFile(null)
      setLinhas([])
      setErrosParse([])
    } catch (err) {
      toast({ title: 'Erro ao importar resultados da Distribuição', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      <h2 className="text-base font-semibold">LogOn DU / Devolução / Presenteísmo DU — resultado mensal</h2>
      <p className="text-sm text-muted-foreground">
        Suba a planilha (Excel ou CSV) com as colunas{' '}
        <span className="font-mono text-xs">INDICADOR · UNIDADE · RESULTADO</span> — os três indicadores podem vir
        empilhados no mesmo arquivo, a coluna INDICADOR diz qual é qual (ADERÊNCIA LOGON, DEVOLUÇÃO PDV, PRESENTEISMO
        DU). Cada arquivo é o resultado de um único mês/ano. Unidades com CDL e CDR (ex: CDL CAMAÇARI e CDR BAHIA) são
        gravadas separadas por negócio — ROTA e ARM.
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
        <div className="space-y-1.5">
          <Label>Mês</Label>
          <Select value={mesImport} onValueChange={setMesImport}>
            <SelectTrigger className={cn('w-40', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <FilePickerButton label="Planilha (.xlsx ou .csv)" accept=".xlsx,.xls,.csv,.txt" file={file} onFile={handleFile} />
      </div>

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
            Importar {resolucao.resolvidas.length} resultado(s)
          </Button>
          <Button variant="outline" onClick={() => { setFile(null); setLinhas([]); setErrosParse([]) }} disabled={importando}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}
