import { useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { parseArmazemMetasFile, type ArmazemT1MetaIndicador, type ParsedArmazemMetaRow } from '@/lib/armazem-t1-meta-parser'
import { MODELO_METAS_ARMAZEM } from '@/lib/modelos-importacao'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { BotaoModeloPlanilha } from '@/components/importacao/BotaoModeloPlanilha'
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

/**
 * Tabela de destino por tier + indicador. O T1 (Estância/CDR Bahia) tem uma
 * tabela por indicador (migration 060); o T2 só tem meta de Presenteísmo AL
 * (migration 059) — TMA e Disponibilidade de Gente do T2 vêm de outro lugar,
 * então linha desse tipo pro T2 é ignorada e reportada na tela.
 */
const TABELAS: Record<'T1' | 'T2', Partial<Record<ArmazemT1MetaIndicador, string>>> = {
  T1: {
    tma: 'metas_armazem_t1_tma',
    disponibilidade_gente: 'metas_armazem_t1_disponibilidade_gente',
    presenteismo_al: 'metas_armazem_t1_presenteismo_al',
  },
  T2: {
    presenteismo_al: 'metas_armazem_presenteismo_al',
  },
}

const NOME_INDICADOR: Record<ArmazemT1MetaIndicador, string> = {
  tma: 'TMA',
  disponibilidade_gente: 'Disponibilidade de Gente',
  presenteismo_al: 'Presenteísmo AL',
}

/**
 * Importa as metas mensais do Armazém — T1 e T2 de uma vez, do mesmo arquivo.
 *
 * A planilha oficial traz "RV ARM _T1" e "RV ARM _T2" em abas separadas, e
 * antes existiam duas telas pedindo esse mesmo arquivo (uma em cada sub-aba
 * da Importação), cada uma lendo uma aba. Além de redundante, escolher a aba
 * errada importava as metas do tier errado sem avisar. Agora é uma tela só:
 * lê todas as abas, e o tier de cada linha sai do nome da aba (ou da própria
 * unidade, se a aba não disser — ver `tierDaLinha`).
 *
 * Aceita INDICADOR · UNIDADE · META (um mês, escolhido na tela) ou
 * INDICADOR · UNIDADE · JAN · FEV · ... (histórico, vários meses de uma vez).
 * TMA em duração (HH:MM → minutos); os demais em %.
 */
export function ImportarMetasArmazem() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [file, setFile] = useState<File | null>(null)
  const [anoImport, setAnoImport] = useState(String(new Date().getFullYear()))
  const [mesImport, setMesImport] = useState(String(new Date().getMonth() + 1))
  const [linhas, setLinhas] = useState<ParsedArmazemMetaRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  const formatoHistorico = useMemo(() => linhas.some(l => l.mes !== undefined), [linhas])

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseArmazemMetasFile(f)
      setLinhas(resultado.linhas)
      setErrosParse(resultado.erros)
    } catch (err) {
      setLinhas([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  function limpar() {
    setFile(null)
    setLinhas([])
    setErrosParse([])
  }

  const resolucao = useMemo(() => {
    const resolvidas: { linha: ParsedArmazemMetaRow; unidade: Unidade }[] = []
    const naoReconhecidas = new Set<string>()
    const semTabela = new Set<string>()
    for (const linha of linhas) {
      const unidade = resolverUnidade(linha.unidade, unidades)
      if (!unidade) {
        naoReconhecidas.add(linha.unidade)
        continue
      }
      if (!TABELAS[linha.tier][linha.indicador]) {
        semTabela.add(`${NOME_INDICADOR[linha.indicador]} (${linha.tier})`)
        continue
      }
      resolvidas.push({ linha, unidade })
    }
    return {
      resolvidas,
      naoReconhecidas: Array.from(naoReconhecidas).sort(),
      semTabela: Array.from(semTabela).sort(),
    }
  }, [linhas, unidades])

  /** Resumo do que vai entrar, por tier — é o que substitui o antigo seletor de aba. */
  const resumo = useMemo(() => {
    const porTier = { T1: new Set<string>(), T2: new Set<string>() }
    for (const { linha, unidade } of resolucao.resolvidas) porTier[linha.tier].add(unidade.nome)
    return porTier
  }, [resolucao])

  async function handleImportar() {
    const ano = Number(anoImport)
    const mesSelecionado = Number(mesImport)
    const porTabela = new Map<string, Map<string, { unidade: string; ano: number; mes: number; valor: number }>>()
    for (const { linha, unidade } of resolucao.resolvidas) {
      const mes = linha.mes ?? mesSelecionado
      const tabela = TABELAS[linha.tier][linha.indicador]
      if (!tabela) continue
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
        title: `${totalRegistros} meta(s) do Armazém importada(s)`,
        description: formatoHistorico ? `T1 e T2 · histórico, vários meses de ${ano}.` : `T1 e T2 · ${MESES_NOMES[mesSelecionado - 1]}/${ano}.`,
      })
      limpar()
    } catch (err) {
      toast({ title: 'Erro ao importar metas do Armazém', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      <h2 className="text-base font-semibold">Metas do Armazém (T1 e T2) — meta mensal</h2>
      <p className="text-sm text-muted-foreground">
        Suba a planilha (Excel ou CSV) com as colunas{' '}
        <span className="font-mono text-xs">INDICADOR · UNIDADE · META</span> ou{' '}
        <span className="font-mono text-xs">INDICADOR · UNIDADE · JAN · FEV · ...</span> (histórico, vários meses de
        uma vez). As abas de T1 e T2 são lidas juntas — cada linha vai pro lugar certo pelo tier da aba/unidade.
        Em caso de dúvida, use o modelo de planilha.
      </p>

      <div className="flex flex-wrap items-end gap-3">
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
        <BotaoModeloPlanilha nomeArquivo="modelo_metas_armazem" abas={MODELO_METAS_ARMAZEM} />
      </div>

      {formatoHistorico && (
        <div className="rounded-lg border border-blue-300/50 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400">
          Formato histórico detectado (colunas de mês) — cada mês da planilha vai ser gravado no seu próprio mês, dentro do ano selecionado acima.
        </div>
      )}

      {linhas.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-gray-200/60 p-3 text-xs dark:border-gray-700/60">
          {(['T1', 'T2'] as const).map(tier => (
            <p key={tier}>
              <span className="font-semibold">{tier}:</span>{' '}
              {resumo[tier].size === 0
                ? <span className="text-muted-foreground">nenhuma unidade nessa planilha</span>
                : <span className="text-muted-foreground">{Array.from(resumo[tier]).sort().join(' · ')}</span>}
            </p>
          ))}
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

      {resolucao.semTabela.length > 0 && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          Ignorado (não existe meta desse indicador nesse tier): {resolucao.semTabela.join(', ')}
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
          <Button variant="outline" onClick={limpar} disabled={importando}>Cancelar</Button>
        </div>
      )}
    </div>
  )
}
