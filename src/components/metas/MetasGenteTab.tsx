import { useEffect, useMemo, useState } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { RV_GENTE_DRE } from '@/lib/constants'
import { parseMetasGenteFile, type ParsedMetaGenteRow } from '@/lib/metas-gente-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { PesosDreCard } from '@/components/metas/PesosDreCard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn, parseNumeroPtBr } from '@/lib/utils'
import type { MetaGente, Unidade } from '@/types'

const BATCH_SIZE = 500
const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const NEGOCIOS_OPCOES = ['ROTA', 'ARMAZEM', 'EMPURRADA', 'CONS'] as const

/**
 * Sugestão automática de negócio — depende do indicador E da operação:
 * indicadores de AL são todos armazém; em DU/EMP, CDL* = rota e o resto
 * (CDR etc, que pode ser empurrada ou rota) fica indefinido pra escolher na tela.
 */
function sugerirNegocio(indicador: string, operacaoBi: string): string {
  if (/\bAL$/.test(indicador)) return 'ARMAZEM'
  if (operacaoBi.startsWith('CDL')) return 'ROTA'
  return ''
}

const ANOS_IMPORT = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

/** Aba "Metas de Gente": importa o arquivo do BI (INDICADOR | OPERAÇÃO | JAN..DEZ) e lista o cadastro. */
export function MetasGenteTab() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  // ── Cadastro atual ─────────────────────────────────────────────────────────
  const [registros, setRegistros] = useState<MetaGente[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('metas_gente')
      .select('*')
      .order('indicador')
      .order('unidade')
      .order('mes')
    if (error) {
      toast({ title: 'Erro ao carregar metas de gente', description: error.message, variant: 'destructive' })
    }
    setRegistros((data as MetaGente[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Importação ─────────────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null)
  const [anoImport, setAnoImport] = useState(String(new Date().getFullYear()))
  const [linhas, setLinhas] = useState<ParsedMetaGenteRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseMetasGenteFile(f)
      setLinhas(resultado.linhas)
      setErrosParse(resultado.erros)
    } catch (err) {
      setLinhas([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  // Negócio já escolhido pra cada indicador+operação (sobrevive a reimportações — não volta pra sugestão automática)
  const negociosSalvos = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of registros) {
      if (r.negocio) m.set(`${r.indicador}|${r.operacao_bi}`, r.negocio)
    }
    return m
  }, [registros])

  // Peso já cadastrado pra cada indicador+operação (idem — reimportar preserva)
  const pesosSalvos = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of registros) {
      if (r.peso) m.set(`${r.indicador}|${r.operacao_bi}`, r.peso)
    }
    return m
  }, [registros])

  // Resolve as operações do arquivo pras unidades cadastradas (código/nome/GInfo/apelidos)
  const resolucao = useMemo(() => {
    const resolvidas: { linha: ParsedMetaGenteRow; unidade: Unidade }[] = []
    const naoReconhecidas = new Set<string>()
    for (const linha of linhas) {
      const unidade = resolverUnidade(linha.operacao, unidades)
      if (unidade) resolvidas.push({ linha, unidade })
      else naoReconhecidas.add(linha.operacao)
    }
    return { resolvidas, naoReconhecidas: Array.from(naoReconhecidas).sort() }
  }, [linhas, unidades])

  const totalValores = useMemo(
    () => resolucao.resolvidas.reduce((acc, r) => acc + r.linha.valores.filter(v => v !== null).length, 0),
    [resolucao],
  )

  async function handleImportar() {
    const ano = Number(anoImport)
    // Map dedupe: se o arquivo repetir a mesma operação+indicador+mês, a última ocorrência vence
    // (evita o erro "ON CONFLICT cannot affect row a second time" no upsert).
    const porChave = new Map<string, Omit<MetaGente, 'id'>>()
    for (const { linha, unidade } of resolucao.resolvidas) {
      linha.valores.forEach((valor, i) => {
        if (valor !== null) {
          const registro = {
            indicador: linha.indicador,
            unidade: unidade.codigo,
            operacao_bi: linha.operacao,
            negocio: negociosSalvos.get(`${linha.indicador}|${linha.operacao}`) ?? sugerirNegocio(linha.indicador, linha.operacao),
            peso: pesosSalvos.get(`${linha.indicador}|${linha.operacao}`) ?? 0,
            ano,
            mes: i + 1,
            valor,
          }
          porChave.set(`${registro.indicador}|${registro.operacao_bi}|${registro.mes}`, registro)
        }
      })
    }
    const registrosImport = Array.from(porChave.values())
    if (registrosImport.length === 0) return

    setImportando(true)
    try {
      for (let i = 0; i < registrosImport.length; i += BATCH_SIZE) {
        const batch = registrosImport.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('metas_gente')
          .upsert(batch, { onConflict: 'indicador,operacao_bi,ano,mes' })
        if (error) throw new Error(error.message)
      }
      toast({ title: `${registrosImport.length} meta(s) importada(s) pra ${ano}` })
      setFile(null)
      setLinhas([])
      setErrosParse([])
      await carregar()
    } catch (err) {
      toast({ title: 'Erro ao importar metas de gente', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  // ── Peso por indicador × operação (cadastro manual, em %) ──────────────────
  // Estado local só dos inputs em edição — chave `${indicador}|${operacao}`.
  const [pesosEdicao, setPesosEdicao] = useState<Record<string, string>>({})

  async function salvarPeso(indicador: string, operacao: string) {
    const chave = `${indicador}|${operacao}`
    const raw = pesosEdicao[chave]
    if (raw === undefined) return
    const peso = parseNumeroPtBr(raw)
    const { error } = await supabase
      .from('metas_gente')
      .update({ peso })
      .eq('indicador', indicador)
      .eq('operacao_bi', operacao)
    if (error) {
      toast({ title: 'Erro ao salvar peso', description: error.message, variant: 'destructive' })
      return
    }
    setPesosEdicao(prev => {
      const { [chave]: _, ...resto } = prev
      return resto
    })
    await carregar()
  }

  // ── Visualização ───────────────────────────────────────────────────────────
  const indicadoresDisponiveis = useMemo(
    () => Array.from(new Set(registros.map(r => r.indicador))).sort(),
    [registros],
  )
  const anosDisponiveis = useMemo(
    () => Array.from(new Set(registros.map(r => r.ano))).sort((a, b) => b - a),
    [registros],
  )

  const [verIndicador, setVerIndicador] = useState('')
  const [verAno, setVerAno] = useState('')

  useEffect(() => {
    if (indicadoresDisponiveis.length > 0 && !indicadoresDisponiveis.includes(verIndicador)) {
      setVerIndicador(indicadoresDisponiveis[0])
    }
  }, [indicadoresDisponiveis, verIndicador])
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(verAno))) {
      setVerAno(String(anosDisponiveis[0]))
    }
  }, [anosDisponiveis, verAno])

  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const matrizVisualizacao = useMemo(() => {
    const doFiltro = registros.filter(r => r.indicador === verIndicador && r.ano === Number(verAno))
    const porOperacao = new Map<string, { unidade: string; negocio: string; peso: number; valores: (number | null)[] }>()
    for (const r of doFiltro) {
      const chave = r.operacao_bi || r.unidade
      const atual = porOperacao.get(chave) ?? { unidade: r.unidade, negocio: r.negocio ?? '', peso: r.peso ?? 0, valores: Array(12).fill(null) }
      if (r.negocio) atual.negocio = r.negocio
      if (r.peso) atual.peso = r.peso
      atual.valores[r.mes - 1] = r.valor
      porOperacao.set(chave, atual)
    }
    return Array.from(porOperacao.entries())
      .map(([operacao, { unidade, negocio, peso, valores }]) => ({
        operacao,
        negocio,
        peso,
        unidadeNome: nomesUnidades.get(unidade) ?? unidade,
        valores,
      }))
      .sort((a, b) => a.operacao.localeCompare(b.operacao))
  }, [registros, verIndicador, verAno, nomesUnidades])

  // ── Exclusão de operação (unidade importada por engano) ────────────────────
  const [excluindoOperacao, setExcluindoOperacao] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  /** Remove TODAS as metas dessa operação do BI — todos os indicadores, meses e anos. */
  async function handleExcluirOperacao() {
    if (!excluindoOperacao) return
    setExcluindo(true)
    const { error } = await supabase.from('metas_gente').delete().eq('operacao_bi', excluindoOperacao)
    setExcluindo(false)
    if (error) {
      toast({ title: 'Erro ao excluir operação', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: `Metas de "${excluindoOperacao}" removidas` })
    setExcluindoOperacao(null)
    await carregar()
  }

  /** Grava o negócio escolhido pra esse indicador+operação (todos os anos/meses dessa combinação). */
  async function handleNegocioChange(indicador: string, operacao: string, negocio: string) {
    const { error } = await supabase
      .from('metas_gente')
      .update({ negocio: negocio === 'indefinido' ? '' : negocio })
      .eq('indicador', indicador)
      .eq('operacao_bi', operacao)
    if (error) {
      toast({ title: 'Erro ao salvar negócio', description: error.message, variant: 'destructive' })
      return
    }
    await carregar()
  }

  return (
    <div className="space-y-6">
      {/* ── Upload ── */}
      <div className="max-w-xl space-y-3">
        <h2 className="text-base font-semibold">Metas de Gente (BI Ambev)</h2>
        <p className="text-sm text-muted-foreground">
          Suba o arquivo (Excel ou CSV) no formato{' '}
          <span className="font-mono text-xs">INDICADOR · OPERAÇÃO · JAN … DEZ</span>.
          Células com <span className="font-mono text-xs">-</span> ou <span className="font-mono text-xs">NA</span> são ignoradas.
          As operações são reconhecidas pelos apelidos cadastrados na Administração.
        </p>

        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label>Ano das metas</Label>
            <Select value={anoImport} onValueChange={setAnoImport}>
              <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANOS_IMPORT.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <FilePickerButton label="Arquivo de metas (.xlsx ou .csv)" accept=".xlsx,.xls,.csv,.txt" file={file} onFile={handleFile} />
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
              {resolucao.naoReconhecidas.length} operação(ões) não reconhecida(s) — cadastre como apelido na Administração e suba de novo:
            </p>
            <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
              {resolucao.naoReconhecidas.map(o => <li key={o}>{o}</li>)}
            </ul>
          </div>
        )}

        {file && (
          <div className="flex items-center gap-3">
            {/* `carregando` bloqueia o import até o cadastro atual estar em memória — é dele
                que vem o negócio já escolhido de cada operação, que não pode ser sobrescrito. */}
            <Button onClick={handleImportar} disabled={totalValores === 0 || importando || carregando} className="gap-2">
              {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar {totalValores} meta(s) pra {anoImport}
            </Button>
            <Button variant="outline" onClick={() => { setFile(null); setLinhas([]); setErrosParse([]) }} disabled={importando}>
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {/* ── Cadastro atual ── */}
      {registros.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Indicador</Label>
            <Select value={verIndicador} onValueChange={setVerIndicador}>
              <SelectTrigger className={cn('w-64', selectGlamour)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {indicadoresDisponiveis.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Select value={verAno} onValueChange={setVerAno}>
              <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <TableCard
        titulo="Metas cadastradas"
        subtitulo={carregando
          ? 'Carregando...'
          : registros.length === 0
            ? 'Nenhuma meta importada'
            : `${verIndicador} · ${verAno} · ${matrizVisualizacao.length} operação(ões)`}
      >
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando metas...
          </div>
        ) : matrizVisualizacao.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma meta de gente cadastrada ainda — importe o arquivo acima.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operação (BI)</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Negócio</TableHead>
                <TableHead className="text-center">Peso (%)</TableHead>
                {MESES_ABREV.map(m => (
                  <TableHead key={m} className="text-center">{m}</TableHead>
                ))}
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrizVisualizacao.map(l => (
                <TableRow key={l.operacao} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="text-sm font-medium">{l.operacao}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.unidadeNome}</TableCell>
                  <TableCell>
                    <Select value={l.negocio || 'indefinido'} onValueChange={v => handleNegocioChange(verIndicador, l.operacao, v)}>
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indefinido">—</SelectItem>
                        {NEGOCIOS_OPCOES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      value={pesosEdicao[`${verIndicador}|${l.operacao}`] ?? (l.peso ? l.peso.toLocaleString('pt-BR') : '')}
                      onChange={e => setPesosEdicao(prev => ({ ...prev, [`${verIndicador}|${l.operacao}`]: e.target.value }))}
                      onBlur={() => salvarPeso(verIndicador, l.operacao)}
                      placeholder="0"
                      className="mx-auto h-7 w-16 text-center text-xs tabular-nums"
                    />
                  </TableCell>
                  {l.valores.map((v, i) => (
                    <TableCell key={i} className={cn(
                      'text-center text-xs tabular-nums',
                      v === null && 'text-muted-foreground',
                    )}>
                      {v === null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400"
                      onClick={() => setExcluindoOperacao(l.operacao)}
                      aria-label={`Excluir metas de ${l.operacao}`}
                      title="Excluir todas as metas dessa operação"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      {/* ── Pesos dos indicadores com origem no DRE ── */}
      <PesosDreCard
        tabela="rv_gente_pesos_dre"
        indicadores={RV_GENTE_DRE}
        subtitulo="Peso único por indicador, vale pra todas as unidades (ex: Pacote de Gente = 30%). Salários e Benefícios são dispersão (diferença ≥ 0 = meta batida)."
      />

      {/* ── Dialog de excluir operação ── */}
      <Dialog open={excluindoOperacao !== null} onOpenChange={v => { if (!v) setExcluindoOperacao(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir operação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remover <span className="font-semibold text-foreground">todas</span> as metas de{' '}
            <span className="font-semibold text-foreground">{excluindoOperacao}</span>?
            Isso apaga a operação em <span className="font-semibold text-foreground">todos os indicadores, meses e anos</span>.
            Essa ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindoOperacao(null)} disabled={excluindo}>Cancelar</Button>
            <Button variant="destructive" onClick={handleExcluirOperacao} disabled={excluindo} className="gap-2">
              {excluindo && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir tudo dessa operação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
