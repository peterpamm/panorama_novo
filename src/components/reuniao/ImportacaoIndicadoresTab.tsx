import { useEffect, useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { parsePlanilhaReuniaoXlsx, resolverValorImportado, type ParsedPlanilhaRow } from '@/lib/reuniao-planilha-parser'
import { negocioParaImportacao } from '@/lib/reuniao-resultados'
import { negocioPorPrefixo, normalizarNomeUnidade, resolverUnidade } from '@/lib/unidade-resolver'
import { MODELO_INDICADORES_ARMAZEM, MODELO_INDICADORES_DU } from '@/lib/modelos-importacao'
import { BotaoModeloPlanilha } from '@/components/importacao/BotaoModeloPlanilha'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { ReuniaoFormato, ReuniaoIndicador, ReuniaoSetor, Unidade } from '@/types'

const BATCH_SIZE = 500
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ANOS_IMPORT = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

interface ImportacaoIndicadoresTabProps {
  setor: ReuniaoSetor
  /** Aba do workbook padrão de Reunião Resultados a ler (ex: "Import RR_DU") — cada setor usa a sua. */
  nomeAba: string
}

/** Modelo de planilha por setor — só Armazém e Distribuição usam esse componente hoje. */
const MODELOS_POR_SETOR: Partial<Record<ReuniaoSetor, typeof MODELO_INDICADORES_ARMAZEM>> = {
  armazem: MODELO_INDICADORES_ARMAZEM,
  distribuicao: MODELO_INDICADORES_DU,
}

interface LinhaResolvida {
  linha: ParsedPlanilhaRow
  unidade: Unidade
  negocio: string
  indicador: ReuniaoIndicador
  resultado: number
  meta: number | null
  /** Formato EFETIVO dessa linha — `indicador.formato_t1` quando o texto da coluna Indicador bateu com `nome_t1` (e o indicador tem um formato próprio cadastrado pro T1), senão `indicador.formato`. Gravado junto no `reuniao_resultados_mensais` pra exibição não precisar re-adivinhar o lado depois (ver migration 112). */
  formato: ReuniaoFormato
}

/**
 * Importa a planilha padrão de Reunião Resultados (`Import_RR - Arm&DU.xlsx`
 * e afins — ver `reuniao-planilha-parser.ts`): meta, resultado e pontos já
 * vêm prontos, um mês/ano por arquivo. Resolve unidade (`resolverUnidade`) e
 * negócio (`negocioPorPrefixo` + `negocioParaImportacao` — mesma regra do
 * Termômetro: Camaçari abre em Rota/Armazém fora do Financeiro) e resolve o
 * indicador casando o texto da coluna Indicador contra `nome` OU `nome_t1`
 * dos indicadores cadastrados no setor/ano.
 */
export function ImportacaoIndicadoresTab({ setor, nomeAba }: ImportacaoIndicadoresTabProps) {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const modelo = MODELOS_POR_SETOR[setor]

  const [anoImport, setAnoImport] = useState(String(new Date().getFullYear()))
  const [mesImport, setMesImport] = useState(String(new Date().getMonth() + 1))
  const [indicadores, setIndicadores] = useState<ReuniaoIndicador[]>([])
  const [carregandoIndicadores, setCarregandoIndicadores] = useState(true)

  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<ParsedPlanilhaRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  useEffect(() => {
    async function buscarIndicadores() {
      setCarregandoIndicadores(true)
      const { data } = await supabase
        .from('reuniao_resultados_indicadores')
        .select('*')
        .eq('setor', setor)
        .eq('ano', Number(anoImport))
        .eq('ativo', true)
      setIndicadores((data as ReuniaoIndicador[]) ?? [])
      setCarregandoIndicadores(false)
    }
    buscarIndicadores()
  }, [setor, anoImport])

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parsePlanilhaReuniaoXlsx(f, nomeAba)
      setLinhas(resultado.linhas)
      setErrosParse(resultado.erros)
    } catch (err) {
      setLinhas([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  const resolucao = useMemo(() => {
    const resolvidas: LinhaResolvida[] = []
    const unidadesNaoReconhecidas = new Set<string>()
    const indicadoresNaoReconhecidos = new Set<string>()
    const valoresInvalidos = new Set<string>()
    for (const linha of linhas) {
      const unidade = resolverUnidade(linha.unidade, unidades)
      if (!unidade) { unidadesNaoReconhecidas.add(linha.unidade); continue }
      const negocio = negocioParaImportacao(unidade, negocioPorPrefixo(linha.unidade), setor)
      const alvo = normalizarNomeUnidade(linha.indicador)
      const indicador = indicadores.find(i => normalizarNomeUnidade(i.nome) === alvo)
        ?? indicadores.find(i => i.nome_t1 !== null && normalizarNomeUnidade(i.nome_t1) === alvo)
      if (!indicador) { indicadoresNaoReconhecidos.add(linha.indicador); continue }
      // Indicador combinado (nome/nome_t1, ex: ON TIME/TMV) pode ter formato
      // diferente por lado — o texto da coluna Indicador já diz qual lado é
      // essa linha (bateu com nome_t1 e não com nome); só sabemos se
      // RESULT/META é duração (fração de dia do Excel) ou número puro depois
      // de resolver esse formato efetivo.
      const ladoT1 = normalizarNomeUnidade(indicador.nome) !== alvo
      const formato = ladoT1 ? (indicador.formato_t1 ?? indicador.formato) : indicador.formato
      const resultado = resolverValorImportado(linha.resultado, formato)
      if (resultado === null) { valoresInvalidos.add(`${linha.unidade} / ${linha.indicador}`); continue }
      const meta = linha.meta === null ? null : resolverValorImportado(linha.meta, formato)
      resolvidas.push({ linha, unidade, negocio, indicador, resultado, meta, formato })
    }
    return {
      resolvidas,
      unidadesNaoReconhecidas: Array.from(unidadesNaoReconhecidas).sort(),
      indicadoresNaoReconhecidos: Array.from(indicadoresNaoReconhecidos).sort(),
      valoresInvalidos: Array.from(valoresInvalidos).sort(),
    }
  }, [linhas, unidades, indicadores, setor])

  async function handleImportar() {
    const mes = Number(mesImport)
    const registros = resolucao.resolvidas.map(({ linha, unidade, negocio, indicador, resultado, meta, formato }) => ({
      indicador_id: indicador.id, unidade: unidade.codigo, negocio, mes,
      resultado, meta, pontos: linha.pontos, formato,
    }))
    if (registros.length === 0) return

    setImportando(true)
    try {
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from('reuniao_resultados_mensais').upsert(batch, { onConflict: 'indicador_id,unidade,negocio,mes' })
        if (error) throw new Error(error.message)
      }
      toast({
        title: `${registros.length} linha(s) importada(s)`,
        description: `${MESES_NOMES[mes - 1]}/${anoImport}.`,
      })
      setFile(null)
      setLinhas([])
      setErrosParse([])
    } catch (err) {
      toast({ title: 'Erro ao importar planilha', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="text-base font-semibold">Importação — planilha padrão</h2>
      <p className="text-sm text-muted-foreground">
        Suba a planilha padrão de Reunião Resultados (aba <span className="font-mono text-xs">{nomeAba}</span>) — as
        colunas Unidade/Indicador/Meta/Result/Pts já vêm prontas, o sistema só guarda. Cada arquivo é a apuração de um
        único mês/ano, escolhido abaixo.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Select value={anoImport} onValueChange={setAnoImport}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS_IMPORT.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mês</Label>
          <Select value={mesImport} onValueChange={setMesImport}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <FilePickerButton label="Planilha (.xlsx)" accept=".xlsx,.xls" file={file} onFile={handleFile} />
        {modelo && <BotaoModeloPlanilha nomeArquivo={`modelo_importacao_rr_${setor}`} abas={modelo} />}
      </div>

      {carregandoIndicadores ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verificando indicadores cadastrados...
        </div>
      ) : indicadores.length === 0 ? (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          Nenhum indicador cadastrado pra {anoImport} — cadastre em Cadastro antes de importar.
        </div>
      ) : (
        <>
          {errosParse.length > 0 && (
            <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
              <p className="mb-1 font-semibold">{errosParse.length} problema(s) no arquivo:</p>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto">
                {errosParse.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {resolucao.unidadesNaoReconhecidas.length > 0 && (
            <div className="rounded-lg border border-red-300/50 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              <p className="mb-1 font-semibold">
                {resolucao.unidadesNaoReconhecidas.length} unidade(s) não reconhecida(s) — cadastre como apelido na Administração e suba de novo:
              </p>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
                {resolucao.unidadesNaoReconhecidas.map(o => <li key={o}>{o}</li>)}
              </ul>
            </div>
          )}

          {resolucao.indicadoresNaoReconhecidos.length > 0 && (
            <div className="rounded-lg border border-red-300/50 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              <p className="mb-1 font-semibold">
                {resolucao.indicadoresNaoReconhecidos.length} indicador(es) não reconhecido(s) — confira o "Nome" ou "Nome no T1" cadastrado em Cadastro:
              </p>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
                {resolucao.indicadoresNaoReconhecidos.map(o => <li key={o}>{o}</li>)}
              </ul>
            </div>
          )}

          {resolucao.valoresInvalidos.length > 0 && (
            <div className="rounded-lg border border-red-300/50 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              <p className="mb-1 font-semibold">
                {resolucao.valoresInvalidos.length} linha(s) com Resultado/Meta que não bateu com o Formato cadastrado do indicador (confira se o Formato é o mesmo tipo de valor da planilha — ex: Duração pra célula "HH:MM"):
              </p>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
                {resolucao.valoresInvalidos.map(o => <li key={o}>{o}</li>)}
              </ul>
            </div>
          )}

          {file && (
            <div className="flex items-center gap-3">
              <Button onClick={handleImportar} disabled={resolucao.resolvidas.length === 0 || importando} className="gap-2">
                {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Importar {resolucao.resolvidas.length} linha(s)
              </Button>
              <Button variant="outline" onClick={() => { setFile(null); setLinhas([]); setErrosParse([]) }} disabled={importando}>
                Cancelar
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
