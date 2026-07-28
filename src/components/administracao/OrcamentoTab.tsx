import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, Upload, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { parseOrcamentoWorkbook, type ParsedOrcamentoSheet, type ParseOrcamentoResultado } from '@/lib/orcamento-xlsx-parser'
import { calcularLinhasSemestre } from '@/lib/orcamento-semestre'
import { fetchOrcamentoPaginado } from '@/lib/orcamento-fetch'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { ContaCombobox } from '@/components/analise-conta/ContaCombobox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { PillToggle } from '@/components/ui/pill-toggle'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn, formatCurrencyInteiro, parseNumeroPtBr } from '@/lib/utils'
import { CONTAS_ORCAMENTO_USADAS } from '@/lib/constants'
import type { Conta, OrcamentoLinha, Unidade } from '@/types'

const BATCH_SIZE = 500
const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const NEGOCIOS = ['CONS', 'ROTA', 'ARM', 'EMP'] as const

const ANO_ATUAL = new Date().getFullYear()
// Ano vigente primeiro (é o default de todo select) — os outros só ficam disponíveis como opção.
const ANOS_OPCOES = [ANO_ATUAL, ANO_ATUAL + 1, ANO_ATUAL - 1]

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Índice na matriz de 15 colunas: Jan-Dez (0-11), 1º Sem (12), 2º Sem (13), Total/anual (14, bloco TOTAL da planilha). */
function indiceMes(mes: number): number {
  if (mes === 0) return 14
  if (mes === 13) return 12
  if (mes === 14) return 13
  return mes - 1
}

/**
 * Aba "Orçamento" da Administração: importa o workbook de orçamento (uma aba
 * ORÇ_XXX_SUFIXO por unidade×negócio, resolvidas via a aba INPUTS), permite
 * recalcular os blocos de 1º/2º semestre (não vêm da planilha — são a soma
 * dos 6 meses recalculada) e mostra o que já foi importado, filtrado por
 * unidade/negócio/ano/conta. Código e nome da conta vêm direto da planilha
 * de orçamento, que tem numeração própria (menos linhas que o plano de
 * contas do DRE).
 */
export function OrcamentoTab() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  // ── Importação ──────────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null)
  const [anoImport, setAnoImport] = useState(String(ANOS_OPCOES[0]))
  const [parseResult, setParseResult] = useState<ParseOrcamentoResultado | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importando, setImportando] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    setParseResult(null)
    setParsing(true)
    try {
      setParseResult(await parseOrcamentoWorkbook(f))
    } catch (err) {
      toast({ title: 'Erro ao ler o arquivo', description: String(err), variant: 'destructive' })
    } finally {
      setParsing(false)
    }
  }

  const resolucao = useMemo(() => {
    const resolvidas: { sheet: ParsedOrcamentoSheet; unidade: Unidade }[] = []
    const naoReconhecidas = new Set<string>()
    for (const sheet of parseResult?.sheets ?? []) {
      const unidade = resolverUnidade(sheet.unidadeNome, unidades)
      if (unidade) resolvidas.push({ sheet, unidade })
      else naoReconhecidas.add(sheet.unidadeNome)
    }
    return { resolvidas, naoReconhecidas: Array.from(naoReconhecidas).sort() }
  }, [parseResult, unidades])

  const totalLinhas = useMemo(
    () => resolucao.resolvidas.reduce((acc, { sheet }) => acc + sheet.linhas.length, 0),
    [resolucao],
  )

  async function handleImportar() {
    const ano = Number(anoImport)
    const registros: Omit<OrcamentoLinha, 'id'>[] = []
    for (const { sheet, unidade } of resolucao.resolvidas) {
      for (const linha of sheet.linhas) {
        registros.push({
          unidade: unidade.codigo,
          negocio: sheet.negocio,
          ano,
          mes: linha.mes,
          conta_codigo: linha.conta_codigo,
          conta_nome: linha.conta_nome,
          orcado: linha.orcado,
          av: linha.av,
          ah: linha.ah,
        })
      }
    }
    if (registros.length === 0) return

    setImportando(true)
    try {
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('orcamentos')
          .upsert(batch, { onConflict: 'unidade,negocio,ano,mes,conta_codigo' })
        if (error) throw new Error(error.message)
      }
      toast({ title: `${registros.length} linha(s) de orçamento importada(s) pra ${ano}` })
      setFile(null)
      setParseResult(null)
      await carregarVisualizacao()
    } catch (err) {
      toast({ title: 'Erro ao importar orçamento', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  // ── Recalcular semestres ────────────────────────────────────────────────
  const [anoSemestre, setAnoSemestre] = useState(String(ANOS_OPCOES[0]))
  const [recalculando, setRecalculando] = useState(false)

  async function handleRecalcularSemestres() {
    const ano = Number(anoSemestre)
    setRecalculando(true)
    try {
      const linhasMensais = await fetchOrcamentoPaginado((from, to) =>
        supabase.from('orcamentos').select('*')
          .eq('ano', ano).lte('mes', 12)
          .in('conta_codigo', CONTAS_ORCAMENTO_USADAS)
          .order('id', { ascending: true })
          .range(from, to),
      )
      const linhasSemestre = calcularLinhasSemestre(linhasMensais, ano)
      if (linhasSemestre.length === 0) {
        toast({ title: `Nenhum orçamento mensal encontrado pra ${ano}`, variant: 'destructive' })
        return
      }

      for (let i = 0; i < linhasSemestre.length; i += BATCH_SIZE) {
        const batch = linhasSemestre.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('orcamentos')
          .upsert(batch, { onConflict: 'unidade,negocio,ano,mes,conta_codigo' })
        if (error) throw new Error(error.message)
      }
      toast({ title: `Semestres recalculados`, description: `${linhasSemestre.length} linha(s) (1º + 2º semestre) atualizadas pra ${ano}.` })
      await carregarVisualizacao()
    } catch (err) {
      toast({ title: 'Erro ao recalcular semestres', description: String(err), variant: 'destructive' })
    } finally {
      setRecalculando(false)
    }
  }

  // ── Visualização ────────────────────────────────────────────────────────
  const [verUnidade, setVerUnidade] = useState('')
  const [verNegocio, setVerNegocio] = useState<typeof NEGOCIOS[number]>('CONS')
  const [verAno, setVerAno] = useState(String(ANOS_OPCOES[0]))
  const [coluna, setColuna] = useState<'orcado' | 'av'>('orcado')
  const [filtroConta, setFiltroConta] = useState('')
  const [linhasView, setLinhasView] = useState<OrcamentoLinha[]>([])
  const [carregandoView, setCarregandoView] = useState(false)

  useEffect(() => {
    if (unidades.length > 0 && !verUnidade) setVerUnidade(unidades[0].codigo)
  }, [unidades, verUnidade])

  async function carregarVisualizacao() {
    if (!verUnidade) return
    setCarregandoView(true)
    try {
      const linhas = await fetchOrcamentoPaginado((from, to) =>
        supabase.from('orcamentos').select('*')
          .eq('unidade', verUnidade).eq('negocio', verNegocio).eq('ano', Number(verAno))
          .order('id', { ascending: true })
          .range(from, to),
      )
      setLinhasView(linhas)
    } catch (err) {
      toast({ title: 'Erro ao carregar orçamento', description: String(err), variant: 'destructive' })
      setLinhasView([])
    } finally {
      setCarregandoView(false)
    }
  }

  useEffect(() => { carregarVisualizacao() }, [verUnidade, verNegocio, verAno]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFiltroConta('') }, [verUnidade, verNegocio, verAno])

  const matrizCompleta = useMemo(() => {
    const porConta = new Map<string, { nome: string; valores: (number | null)[] }>()
    for (const linha of linhasView) {
      const atual = porConta.get(linha.conta_codigo) ?? { nome: linha.conta_nome, valores: Array.from({ length: 15 }, () => null) }
      atual.valores[indiceMes(linha.mes)] = coluna === 'orcado' ? linha.orcado : linha.av
      porConta.set(linha.conta_codigo, atual)
    }
    return Array.from(porConta.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([conta_codigo, { nome, valores }]) => ({ conta_codigo, nome, valores }))
  }, [linhasView, coluna])

  // Lista sintética pro combobox de contas — reaproveita o componente da Análise por Conta, mas com as contas da própria planilha de orçamento (não a tabela `contas` do DRE).
  const contasOrcamento = useMemo<Conta[]>(
    () => matrizCompleta.map((l, i) => ({ codigo: l.conta_codigo, descricao: l.nome, ordem: i, nivel: 0, ativo: true })),
    [matrizCompleta],
  )

  const matriz = useMemo(
    () => filtroConta === '' ? matrizCompleta : matrizCompleta.filter(l => l.conta_codigo === filtroConta),
    [matrizCompleta, filtroConta],
  )

  // Lookup pra edição manual: linha completa (id, orcado/av original, flags) por conta×mês, só pros 12 meses individuais.
  const linhaPorContaMes = useMemo(() => {
    const m = new Map<string, OrcamentoLinha>()
    for (const linha of linhasView) {
      if (linha.mes >= 1 && linha.mes <= 12) m.set(`${linha.conta_codigo}|${linha.mes}`, linha)
    }
    return m
  }, [linhasView])

  // ── Edição manual do orçado (R$) ou do AV (%) mensal ────────────────────
  const [editando, setEditando] = useState<{ linha: OrcamentoLinha; campo: 'orcado' | 'av' } | null>(null)
  const [novoValor, setNovoValor] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  function abrirEdicao(linha: OrcamentoLinha, campo: 'orcado' | 'av') {
    setEditando({ linha, campo })
    setNovoValor(campo === 'orcado'
      ? linha.orcado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : fmtPct(linha.av))
  }

  async function handleSalvarEdicao() {
    if (!editando?.linha.id) return
    const { linha, campo } = editando
    const valor = parseNumeroPtBr(novoValor)
    setSalvandoEdicao(true)
    try {
      const payload = campo === 'orcado'
        ? { orcado: valor, orcado_editado_manualmente: true, ...(linha.orcado_editado_manualmente ? {} : { orcado_original: linha.orcado }) }
        : { av: valor, av_editado_manualmente: true, ...(linha.av_editado_manualmente ? {} : { av_original: linha.av }) }
      const { error } = await supabase.from('orcamentos').update(payload).eq('id', linha.id)
      if (error) throw new Error(error.message)
      toast({ title: campo === 'orcado' ? 'Valor orçado atualizado' : 'AV (%) atualizado' })
      setEditando(null)
      await carregarVisualizacao()
    } catch (err) {
      toast({ title: 'Erro ao salvar valor', description: String(err), variant: 'destructive' })
    } finally {
      setSalvandoEdicao(false)
    }
  }

  async function handleReverterEdicao() {
    if (!editando?.linha.id) return
    const { linha, campo } = editando
    const original = campo === 'orcado' ? linha.orcado_original : linha.av_original
    if (original == null) return
    setSalvandoEdicao(true)
    try {
      const payload = campo === 'orcado'
        ? { orcado: original, orcado_editado_manualmente: false, orcado_original: null }
        : { av: original, av_editado_manualmente: false, av_original: null }
      const { error } = await supabase.from('orcamentos').update(payload).eq('id', linha.id)
      if (error) throw new Error(error.message)
      toast({ title: 'Valor revertido pro original da importação' })
      setEditando(null)
      await carregarVisualizacao()
    } catch (err) {
      toast({ title: 'Erro ao reverter valor', description: String(err), variant: 'destructive' })
    } finally {
      setSalvandoEdicao(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Importação + Recalcular semestres (duas colunas) ── */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Importar orçamento</h2>
          <p className="text-sm text-muted-foreground">
            Workbook de orçamento inteiro (.xlsx) — uma aba <span className="font-mono text-xs">ORÇ_XXX_RT/AR/EM/TT</span> por
            unidade×negócio, resolvidas automaticamente pela aba <span className="font-mono text-xs">INPUTS</span> do próprio arquivo.
            Os blocos de mês e o bloco TOTAL (meta do ano) são importados; só o bloco anual de comparação é ignorado.
          </p>
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label>Ano do orçamento</Label>
              <Select value={anoImport} onValueChange={setAnoImport}>
                <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANOS_OPCOES.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <FilePickerButton accept=".xlsx,.xls" file={file} onFile={handleFile} />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold">Recalcular 1º/2º semestre</h2>
          <p className="text-sm text-muted-foreground">
            A planilha não tem um bloco de semestre — esses valores são calculados aqui (soma do orçado dos 6 meses de cada conta,
            AV recalculado contra a Receita Líquida Operacional do período). Só recalcula as contas que algum pacote do Farol usa
            — bem mais rápido que todas as ~155 contas de cada aba. Rode de novo sempre que reimportar o orçamento do ano
            (ex: quando novas unidades entrarem no 2º semestre).
          </p>
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Select value={anoSemestre} onValueChange={setAnoSemestre}>
                <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANOS_OPCOES.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleRecalcularSemestres} disabled={recalculando} variant="outline" className="gap-2">
              {recalculando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Recalcular semestres de {anoSemestre}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Feedback da leitura do arquivo / confirmar importação ── */}
      {(parsing || parseResult) && (
        <div className="space-y-2">
          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lendo o arquivo...
            </div>
          )}

          {parseResult && !parsing && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {resolucao.resolvidas.length} aba(s) reconhecida(s) · {totalLinhas} linha(s) de conta×mês no total.
              </p>

              {parseResult.abasForaDoPadrao.length > 0 && (
                <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                  <p className="mb-1 font-semibold">{parseResult.abasForaDoPadrao.length} aba(s) fora do padrão (ignorada(s)):</p>
                  <ul className="max-h-24 space-y-0.5 overflow-y-auto font-mono">
                    {parseResult.abasForaDoPadrao.map(a => <li key={a}>{a}</li>)}
                  </ul>
                </div>
              )}

              {parseResult.codigosNaoMapeados.length > 0 && (
                <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                  <p className="mb-1 font-semibold">
                    {parseResult.codigosNaoMapeados.length} código(s) de aba não encontrado(s) na aba INPUTS:
                  </p>
                  <ul className="max-h-24 space-y-0.5 overflow-y-auto font-mono">
                    {parseResult.codigosNaoMapeados.map(c => <li key={c}>{c}</li>)}
                  </ul>
                </div>
              )}

              {resolucao.naoReconhecidas.length > 0 && (
                <div className="rounded-lg border border-red-300/50 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                  <p className="mb-1 font-semibold">
                    {resolucao.naoReconhecidas.length} unidade(s) não reconhecida(s) — cadastre como apelido acima na aba Unidades e suba de novo:
                  </p>
                  <ul className="max-h-24 space-y-0.5 overflow-y-auto font-mono">
                    {resolucao.naoReconhecidas.map(n => <li key={n}>{n}</li>)}
                  </ul>
                </div>
              )}

              {parseResult.erros.length > 0 && (
                <div className="rounded-lg border border-red-300/50 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                  <p className="mb-1 font-semibold">{parseResult.erros.length} erro(s):</p>
                  <ul className="max-h-24 space-y-0.5 overflow-y-auto">
                    {parseResult.erros.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {file && parseResult && (
            <div className="flex items-center gap-3">
              <Button onClick={handleImportar} disabled={totalLinhas === 0 || importando} className="gap-2">
                {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Importar {totalLinhas} linha(s) pra {anoImport}
              </Button>
              <Button variant="outline" onClick={() => { setFile(null); setParseResult(null) }} disabled={importando}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Visualização ── */}
      <div className="space-y-4 border-t pt-6">
        <h2 className="text-base font-semibold">Orçamento importado</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Unidade</Label>
            <Select value={verUnidade} onValueChange={setVerUnidade}>
              <SelectTrigger className={cn('w-56', selectGlamour)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {unidades.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Negócio</Label>
            <Select value={verNegocio} onValueChange={v => setVerNegocio(v as typeof NEGOCIOS[number])}>
              <SelectTrigger className={cn('w-32', selectGlamour)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {NEGOCIOS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Select value={verAno} onValueChange={setVerAno}>
              <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANOS_OPCOES.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[280px] space-y-1.5">
            <Label className="text-xs text-muted-foreground">Conta</Label>
            <div className="flex items-center gap-1.5">
              <ContaCombobox contas={contasOrcamento} value={filtroConta} onChange={setFiltroConta} />
              {filtroConta !== '' && (
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setFiltroConta('')} aria-label="Limpar filtro de conta">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <PillToggle
            opcoes={[{ value: 'orcado', label: 'Orçado (R$)' }, { value: 'av', label: 'AV (%)' }] as const}
            value={coluna}
            onChange={setColuna}
          />
        </div>

        <TableCard
          titulo="Orçamento"
          subtitulo={carregandoView
            ? 'Carregando...'
            : matriz.length === 0
              ? 'Sem orçamento importado pra esse filtro'
              : `${verAno} · ${verNegocio} · ${coluna === 'orcado' ? 'valor orçado em R$' : 'AVR orçado (%)'} · Sem = semestre recalculado · Total = meta do ano (bloco TOTAL da planilha)`}
        >
          {carregandoView ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : matriz.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhum orçamento importado pra essa unidade/negócio/ano.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  {MESES_ABREV.map(m => <TableHead key={m} className="text-center">{m}</TableHead>)}
                  <TableHead className="text-center">1º Sem</TableHead>
                  <TableHead className="text-center">2º Sem</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matriz.map(l => (
                  <TableRow key={l.conta_codigo} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <TableCell className="text-sm font-medium">
                      <span className="mr-1 font-mono text-xs text-muted-foreground">{l.conta_codigo}</span>
                      {l.nome}
                    </TableCell>
                    {l.valores.map((v, i) => {
                      const editavel = i <= 11 && v !== null
                      const linhaOriginal = editavel ? linhaPorContaMes.get(`${l.conta_codigo}|${i + 1}`) : undefined
                      const editado = linhaOriginal
                        ? (coluna === 'orcado' ? linhaOriginal.orcado_editado_manualmente : linhaOriginal.av_editado_manualmente) ?? false
                        : false
                      return (
                        <TableCell
                          key={i}
                          className={cn(
                            'p-0 text-center text-xs tabular-nums',
                            (i === 12 || i === 13) && 'bg-blue-500/5 font-medium',
                            i === 14 && 'bg-muted/40 font-semibold',
                            editado && 'bg-fuchsia-500/15 ring-1 ring-inset ring-fuchsia-500 dark:bg-fuchsia-500/20',
                          )}
                        >
                          {v === null ? (
                            <span className="block px-2 py-1.5">—</span>
                          ) : editavel && linhaOriginal ? (
                            <button
                              type="button"
                              onClick={() => abrirEdicao(linhaOriginal, coluna)}
                              title={editado ? 'Editado manualmente — clique pra ver o valor original' : 'Clique pra editar manualmente'}
                              className={cn(
                                'block w-full px-2 py-1.5 tabular-nums transition-colors hover:bg-blue-500/10',
                                editado && 'font-bold text-fuchsia-700 dark:text-fuchsia-300',
                              )}
                            >
                              {coluna === 'orcado' ? formatCurrencyInteiro(v) : `${fmtPct(v)}%`}
                            </button>
                          ) : (
                            <span className="block px-2 py-1.5">
                              {coluna === 'orcado' ? formatCurrencyInteiro(v) : `${fmtPct(v)}%`}
                            </span>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      </div>

      <Dialog open={editando !== null} onOpenChange={v => { if (!v) setEditando(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editando?.campo === 'av' ? 'Editar AV (%)' : 'Editar valor orçado'}</DialogTitle>
          </DialogHeader>
          {editando && (() => {
            const { linha, campo } = editando
            const editadoAtual = campo === 'orcado' ? linha.orcado_editado_manualmente : linha.av_editado_manualmente
            const original = campo === 'orcado' ? linha.orcado_original : linha.av_original
            return (
              <div className="space-y-3 py-1">
                <p className="text-sm">
                  <span className="mr-1 font-mono text-xs text-muted-foreground">{linha.conta_codigo}</span>
                  <span className="font-medium">{linha.conta_nome}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {unidades.find(u => u.codigo === linha.unidade)?.nome ?? linha.unidade} · {linha.negocio} ·{' '}
                  {MESES_ABREV[linha.mes - 1]}/{linha.ano}
                </p>

                {editadoAtual && original != null && (
                  <div className="rounded-lg border border-fuchsia-300/50 bg-fuchsia-50 p-3 text-xs text-fuchsia-700 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
                    Valor original da importação:{' '}
                    <strong>{campo === 'orcado' ? formatCurrencyInteiro(original) : `${fmtPct(original)}%`}</strong>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>{campo === 'orcado' ? 'Valor orçado (R$)' : 'AV (%)'}</Label>
                  <Input
                    value={novoValor}
                    onChange={e => setNovoValor(e.target.value)}
                    placeholder={campo === 'orcado' ? 'Ex: 150.000,00' : 'Ex: 12,34'}
                  />
                </div>
              </div>
            )
          })()}
          <DialogFooter className="gap-2 sm:gap-2">
            {editando && (editando.campo === 'orcado' ? editando.linha.orcado_editado_manualmente : editando.linha.av_editado_manualmente) && (
              <Button variant="outline" onClick={handleReverterEdicao} disabled={salvandoEdicao}>
                Reverter pro original
              </Button>
            )}
            <Button onClick={handleSalvarEdicao} disabled={salvandoEdicao}>
              {salvandoEdicao ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
