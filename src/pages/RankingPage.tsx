import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useMetasTodasUnidades } from '@/hooks/useMetasTodasUnidades'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PillToggle } from '@/components/ui/pill-toggle'
import { FilterLabel, filterTriggerClass } from '@/components/farol/FarolFilters'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RankingTabelaIndicador, RankingTabelaPerdas, RankingTabelaReceita, type RankingLinhaPerda } from '@/components/ranking/RankingTabelas'
import { UnidadesMultiSelect } from '@/components/ranking/UnidadesMultiSelect'
import { usePainelPerdasAux } from '@/hooks/usePainelPerdasAux'
import { CONTA_RECEITA, PACOTES, RANKING_CUSTOS, RANKING_PERFORMANCE } from '@/lib/constants'
import { calcularRankingIndicador, calcularRankingReceita, type PeriodoRanking } from '@/lib/ranking-calculations'
import { calcularMatrizPerdas, INDICADORES_PERDAS } from '@/lib/painel-perdas-calculations'
import { fetchOrcamentoPaginado } from '@/lib/orcamento-fetch'
import { MES_ABREV } from '@/components/farol/chart-shared'
import { cn } from '@/lib/utils'
import type { OrcamentoLinha } from '@/types'

function unicos<T>(valores: T[]): T[] {
  return Array.from(new Set(valores))
}

export function RankingPage() {
  const { unidades, loading: loadingUnidades } = useUnidades()
  const { rows, loading: loadingDre } = useDreLongoTodasUnidades()
  const { metas, loading: loadingMetas } = useMetasTodasUnidades()
  const { rows: rowsAux } = usePainelPerdasAux()

  const nomesUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  // Filtro de unidades (checkbox) — começa com todas marcadas (mesmo comportamento de
  // antes); só passa a restringir quando o usuário desmarcar alguma.
  const [selUnidades, setSelUnidades] = useState<Set<string>>(new Set())
  const [unidadesInicializadas, setUnidadesInicializadas] = useState(false)
  useEffect(() => {
    if (!unidadesInicializadas && unidades.length > 0) {
      setSelUnidades(new Set(unidades.map(u => u.codigo)))
      setUnidadesInicializadas(true)
    }
  }, [unidades, unidadesInicializadas])

  function toggleUnidade(codigo: string) {
    setSelUnidades(prev => {
      const novo = new Set(prev)
      if (novo.has(codigo)) novo.delete(codigo)
      else novo.add(codigo)
      return novo
    })
  }

  const rowsFiltradas = useMemo(
    () => (unidadesInicializadas ? rows.filter(r => selUnidades.has(r.unidade)) : rows),
    [rows, selUnidades, unidadesInicializadas],
  )

  const negociosDisponiveis = useMemo(() => unicos(rowsFiltradas.map(r => r.negocio)).sort(), [rowsFiltradas])
  const [selNegocio, setSelNegocio] = useState('')
  useEffect(() => {
    if (negociosDisponiveis.length === 0) return
    if (selNegocio && negociosDisponiveis.includes(selNegocio)) return
    setSelNegocio(negociosDisponiveis.includes('CONS') ? 'CONS' : negociosDisponiveis[0])
  }, [negociosDisponiveis, selNegocio])

  const rowsNegocio = useMemo(() => rowsFiltradas.filter(r => r.negocio === selNegocio), [rowsFiltradas, selNegocio])

  const anosDisponiveis = useMemo(() => unicos(rowsNegocio.map(r => r.ano)).sort((a, b) => a - b), [rowsNegocio])
  const [selAno, setSelAno] = useState<number | null>(null)
  useEffect(() => {
    if (anosDisponiveis.length === 0) return
    if (selAno && anosDisponiveis.includes(selAno)) return
    setSelAno(anosDisponiveis[anosDisponiveis.length - 1])
  }, [anosDisponiveis, selAno])

  const rowsNegocioAno = useMemo(() => rowsNegocio.filter(r => r.ano === selAno), [rowsNegocio, selAno])

  const mesesDisponiveis = useMemo(
    () => unicos(rowsNegocioAno.filter(r => r.tipo_periodo === 'MENSAL').map(r => r.mes)).sort((a, b) => a - b),
    [rowsNegocioAno],
  )
  const [selMes, setSelMes] = useState<number | null>(null)
  useEffect(() => {
    if (mesesDisponiveis.length === 0) return
    if (selMes && mesesDisponiveis.includes(selMes)) return
    setSelMes(mesesDisponiveis[mesesDisponiveis.length - 1])
  }, [mesesDisponiveis, selMes])

  const [periodo, setPeriodo] = useState<PeriodoRanking>('mensal')
  const isYtd = periodo === 'ytd'
  const mesDesabilitado = periodo !== 'mensal'
  const periodoTexto = periodo === 'ytd'
    ? 'YTD — acumulado do ano'
    : periodo === 's1'
      ? '1º Semestre'
      : periodo === 's2'
        ? '2º Semestre'
        : `Mensal — M${selMes ?? '-'}`

  const metasNegocioAno = useMemo(() => metas.filter(m => m.negocio === selNegocio && m.ano === selAno), [metas, selNegocio, selAno])

  // Receita Líquida Operacional orçada (tabela `orcamentos`) — todas as unidades,
  // pro ranking de Receita comparar realizado × orçado no lugar da meta manual.
  const [orcamentoRows, setOrcamentoRows] = useState<OrcamentoLinha[]>([])
  useEffect(() => {
    if (selNegocio === '' || selAno === null) { setOrcamentoRows([]); return }
    let cancelado = false
    fetchOrcamentoPaginado((from, to) =>
      supabase.from('orcamentos').select('*')
        .eq('negocio', selNegocio).eq('ano', selAno).eq('conta_codigo', CONTA_RECEITA)
        .order('id', { ascending: true })
        .range(from, to),
    )
      .then(rows => { if (!cancelado) setOrcamentoRows(rows) })
      .catch(() => { if (!cancelado) setOrcamentoRows([]) })
    return () => { cancelado = true }
  }, [selNegocio, selAno])

  const rankingReceita = useMemo(
    () => calcularRankingReceita(rowsNegocioAno, orcamentoRows, { negocio: selNegocio, ano: selAno ?? 0, periodo, mes: selMes ?? 0 }),
    [rowsNegocioAno, orcamentoRows, selNegocio, selAno, periodo, selMes],
  )

  const rankingPerformance = useMemo(
    () => RANKING_PERFORMANCE.map(codigo => ({
      codigo,
      info: PACOTES[codigo],
      linhas: calcularRankingIndicador(rowsNegocioAno, metasNegocioAno, PACOTES[codigo], codigo, {
        negocio: selNegocio, ano: selAno ?? 0, periodo, mes: selMes ?? 0,
      }),
    })),
    [rowsNegocioAno, metasNegocioAno, selNegocio, selAno, periodo, selMes],
  )

  const rankingCustos = useMemo(
    () => RANKING_CUSTOS.map(codigo => ({
      codigo,
      info: PACOTES[codigo],
      linhas: calcularRankingIndicador(rowsNegocioAno, metasNegocioAno, PACOTES[codigo], codigo, {
        negocio: selNegocio, ano: selAno ?? 0, periodo, mes: selMes ?? 0,
      }),
    })),
    [rowsNegocioAno, metasNegocioAno, selNegocio, selAno, periodo, selMes],
  )

  // ── Ranking de Perdas (indicadores do Painel de Perdas, sempre CONS) ──────
  const rankingPerdas = useMemo(() => {
    if (!selAno || !selMes) return []

    // Meses do período: mês selecionado, acumulado Jan..mês (YTD), ou os meses
    // do semestre que já tiverem dado importado.
    const mesesCons = unicos(
      rowsFiltradas
        .filter(r => r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === selAno)
        .map(r => r.mes),
    )
    const meses = periodo === 'ytd'
      ? mesesCons.filter(m => m <= selMes).sort((a, b) => a - b)
      : periodo === 's1'
        ? mesesCons.filter(m => m >= 1 && m <= 6).sort((a, b) => a - b)
        : periodo === 's2'
          ? mesesCons.filter(m => m >= 7 && m <= 12).sort((a, b) => a - b)
          : [selMes]

    const auxFiltrado = unidadesInicializadas ? rowsAux.filter(r => selUnidades.has(r.unidade)) : rowsAux
    const matriz = calcularMatrizPerdas(rowsFiltradas, auxFiltrado, [], selAno, meses)

    return INDICADORES_PERDAS.map(ind => {
      let valores = matriz.linhas.find(l => l.key === ind.key)?.valores ?? {}
      let nota: string | undefined

      // Indicadores AUX (Indisponibilidade/Devolução) vêm de import separado e podem
      // não ter o mês mais recente do DRE — no modo Mensal, cai pro último mês com dado.
      if (ind.fonte === 'AUX' && periodo === 'mensal') {
        const mesesAux = unicos(
          auxFiltrado.filter(r => r.ano === selAno && r.indicador === ind.key).map(r => r.mes),
        ).sort((a, b) => a - b)
        if (!mesesAux.includes(selMes)) {
          const ultimo = mesesAux.filter(m => m <= selMes).at(-1)
          if (ultimo !== undefined) {
            const matrizFallback = calcularMatrizPerdas(rowsFiltradas, auxFiltrado, [], selAno, [ultimo])
            valores = matrizFallback.linhas.find(l => l.key === ind.key)?.valores ?? {}
            nota = `M${ultimo} (último mês com dado)`
          }
        }
      }

      const individuais = matriz.unidades.filter(u => u !== 'AMBEV')

      // BNS é receita boa dentro do Painel de Perdas — mantém rank 1 = melhor.
      // Os demais são perdas de verdade: rank 1 = pior, pra dar destaque a quem mais perde.
      const pioresPrimeiro = ind.key !== 'bns'
      const comValor = individuais
        .map(u => ({ unidade: u, valor: valores[u] ?? null }))
        .filter((x): x is { unidade: string; valor: number } => x.valor !== null)
        .sort((a, b) => pioresPrimeiro ? a.valor - b.valor : b.valor - a.valor)
      const semValor = individuais.filter(u => (valores[u] ?? null) === null)

      let rank = 0
      const linhas: RankingLinhaPerda[] = [
        ...comValor.map(x => ({ ...x, rank: ++rank })),
        ...semValor.map(u => ({ unidade: u, valor: null, rank: null })),
      ]
      linhas.push({ unidade: 'AMBEV', valor: valores['AMBEV'] ?? null, rank: null })

      return { key: ind.key, label: ind.label, linhas, nota, pioresPrimeiro }
    })
  }, [rowsFiltradas, rowsAux, selUnidades, unidadesInicializadas, selAno, selMes, periodo])

  const carregando = loadingUnidades || loadingDre || loadingMetas

  if (carregando && rows.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum dado disponível para o seu usuário.</p>
  }

  return (
    <div className="space-y-6">
      {/* BLOCO 1: Filtros com fundo navy gradiente (mesmo padrão do Farol/Análise) */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[hsl(222,45%,20%)] to-[hsl(222,35%,30%)] dark:from-[hsl(224,28%,14%)] dark:to-[hsl(224,22%,20%)] shadow-xl shadow-blue-900/20 overflow-hidden">
        <div className="flex flex-wrap items-end gap-4 p-4 md:p-6">
          <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <FilterLabel>Unidades</FilterLabel>
              <UnidadesMultiSelect
                opcoes={unidades.map(u => ({ codigo: u.codigo, nome: u.nome }))}
                selecionadas={selUnidades}
                onToggle={toggleUnidade}
                onSelecionarTodas={() => setSelUnidades(new Set(unidades.map(u => u.codigo)))}
                onLimpar={() => setSelUnidades(new Set())}
                className={filterTriggerClass}
              />
            </div>
            <div className="space-y-1.5">
              <FilterLabel>Negócio</FilterLabel>
              <Select value={selNegocio} onValueChange={v => { setSelNegocio(v); setSelAno(null); setSelMes(null) }}>
                <SelectTrigger className={filterTriggerClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {negociosDisponiveis.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FilterLabel>Ano</FilterLabel>
              <Select value={String(selAno ?? '')} onValueChange={v => setSelAno(Number(v))}>
                <SelectTrigger className={filterTriggerClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FilterLabel>Mês</FilterLabel>
              <Select value={String(selMes ?? '')} onValueChange={v => setSelMes(Number(v))} disabled={mesDesabilitado}>
                <SelectTrigger className={cn(filterTriggerClass, mesDesabilitado && 'opacity-50')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {mesesDisponiveis.map(m => <SelectItem key={m} value={String(m)}>{MES_ABREV[m] ?? m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <FilterLabel>Período</FilterLabel>
            <div>
              <PillToggle
                variant="navy"
                opcoes={[
                  { value: 'mensal', label: 'Mensal' },
                  { value: 'ytd',    label: 'YTD'    },
                  { value: 's1',     label: '1º Sem' },
                  { value: 's2',     label: '2º Sem' },
                ] as const}
                value={periodo}
                onChange={setPeriodo}
              />
            </div>
          </div>
        </div>
      </div>

      {negociosDisponiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma unidade selecionada, ou sem dados pra essa seleção.</p>
      ) : (
        <>
          <Tabs defaultValue="receita">
            <TabsList>
              <TabsTrigger value="receita">Receita</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="custos">Custos</TabsTrigger>
              <TabsTrigger value="perdas">Perdas</TabsTrigger>
            </TabsList>

            <TabsContent value="receita" className="pt-4">
              <RankingTabelaReceita
                linhas={rankingReceita}
                nomesUnidade={nomesUnidade}
                titulo="Receita"
                subtitulo={`Receita Líquida Operacional realizada vs orçada · ${periodoTexto}`}
              />
            </TabsContent>

            <TabsContent value="performance" className="space-y-6 pt-4">
              {rankingPerformance.map(({ codigo, info, linhas }) => (
                <RankingTabelaIndicador
                  key={codigo}
                  linhas={linhas}
                  nomesUnidade={nomesUnidade}
                  titulo={info.nome}
                  subtitulo={periodoTexto}
                />
              ))}
            </TabsContent>

            <TabsContent value="custos" className="space-y-6 pt-4">
              {rankingCustos.map(({ codigo, info, linhas }) => (
                <RankingTabelaIndicador
                  key={codigo}
                  linhas={linhas}
                  nomesUnidade={nomesUnidade}
                  titulo={info.nome}
                  subtitulo={periodoTexto}
                />
              ))}
            </TabsContent>

            <TabsContent value="perdas" className="space-y-6 pt-4">
              {rankingPerdas.map(({ key, label, linhas, nota, pioresPrimeiro }) => (
                <RankingTabelaPerdas
                  key={key}
                  linhas={linhas}
                  nomesUnidade={nomesUnidade}
                  titulo={label}
                  pioresPrimeiro={pioresPrimeiro}
                  subtitulo={nota ? `Mensal — ${nota}` : periodoTexto}
                />
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
