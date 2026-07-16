import { useEffect, useMemo, useState } from 'react'
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
import { PACOTES, RANKING_CUSTOS, RANKING_PERFORMANCE } from '@/lib/constants'
import { calcularRankingIndicador, calcularRankingReceita } from '@/lib/ranking-calculations'
import { calcularMatrizPerdas, INDICADORES_PERDAS } from '@/lib/painel-perdas-calculations'
import { MES_ABREV } from '@/components/farol/chart-shared'
import { cn } from '@/lib/utils'

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

  const [isYtd, setIsYtd] = useState(false)

  const metasNegocioAno = useMemo(() => metas.filter(m => m.negocio === selNegocio && m.ano === selAno), [metas, selNegocio, selAno])

  const rankingReceita = useMemo(
    () => calcularRankingReceita(rowsNegocioAno, metasNegocioAno, { negocio: selNegocio, ano: selAno ?? 0 }),
    [rowsNegocioAno, metasNegocioAno, selNegocio, selAno],
  )

  const rankingPerformance = useMemo(
    () => RANKING_PERFORMANCE.map(codigo => ({
      codigo,
      info: PACOTES[codigo],
      linhas: calcularRankingIndicador(rowsNegocioAno, metasNegocioAno, PACOTES[codigo], codigo, {
        negocio: selNegocio, ano: selAno ?? 0, isYtd, mes: selMes ?? 0,
      }),
    })),
    [rowsNegocioAno, metasNegocioAno, selNegocio, selAno, isYtd, selMes],
  )

  const rankingCustos = useMemo(
    () => RANKING_CUSTOS.map(codigo => ({
      codigo,
      info: PACOTES[codigo],
      linhas: calcularRankingIndicador(rowsNegocioAno, metasNegocioAno, PACOTES[codigo], codigo, {
        negocio: selNegocio, ano: selAno ?? 0, isYtd, mes: selMes ?? 0,
      }),
    })),
    [rowsNegocioAno, metasNegocioAno, selNegocio, selAno, isYtd, selMes],
  )

  // ── Ranking de Perdas (indicadores do Painel de Perdas, sempre CONS) ──────
  const rankingPerdas = useMemo(() => {
    if (!selAno || !selMes) return []

    // Meses do período: mês selecionado ou acumulado Jan..mês (YTD).
    const mesesCons = unicos(
      rowsFiltradas
        .filter(r => r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === selAno)
        .map(r => r.mes),
    )
    const meses = isYtd ? mesesCons.filter(m => m <= selMes).sort((a, b) => a - b) : [selMes]

    const auxFiltrado = unidadesInicializadas ? rowsAux.filter(r => selUnidades.has(r.unidade)) : rowsAux
    const matriz = calcularMatrizPerdas(rowsFiltradas, auxFiltrado, [], selAno, meses)

    return INDICADORES_PERDAS.map(ind => {
      let valores = matriz.linhas.find(l => l.key === ind.key)?.valores ?? {}
      let nota: string | undefined

      // Indicadores AUX (Indisponibilidade/Devolução) vêm de import separado e podem
      // não ter o mês mais recente do DRE — no modo Mensal, cai pro último mês com dado.
      if (ind.fonte === 'AUX' && !isYtd) {
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

      const ordenadas = individuais
        .map(u => ({ unidade: u, valor: valores[u] ?? null }))
        .sort((a, b) => (b.valor ?? -Infinity) - (a.valor ?? -Infinity))

      let rank = 0
      const linhas: RankingLinhaPerda[] = ordenadas.map(x => ({
        ...x,
        rank: x.valor === null ? null : ++rank,
      }))
      linhas.push({ unidade: 'AMBEV', valor: valores['AMBEV'] ?? null, rank: null })

      return { key: ind.key, label: ind.label, linhas, nota }
    })
  }, [rowsFiltradas, rowsAux, selUnidades, unidadesInicializadas, selAno, selMes, isYtd])

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
              <Select value={String(selMes ?? '')} onValueChange={v => setSelMes(Number(v))} disabled={isYtd}>
                <SelectTrigger className={cn(filterTriggerClass, isYtd && 'opacity-50')}><SelectValue /></SelectTrigger>
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
                ] as const}
                value={isYtd ? 'ytd' : 'mensal'}
                onChange={v => setIsYtd(v === 'ytd')}
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
                subtitulo="Ranqueado por % de atingimento da meta anual de receita (sempre acumulado do ano, independente do modo Mensal/YTD)"
              />
            </TabsContent>

            <TabsContent value="performance" className="space-y-6 pt-4">
              {rankingPerformance.map(({ codigo, info, linhas }) => (
                <RankingTabelaIndicador
                  key={codigo}
                  linhas={linhas}
                  nomesUnidade={nomesUnidade}
                  titulo={info.nome}
                  subtitulo={isYtd ? `YTD — acumulado do ano` : `Mensal — M${selMes ?? '-'}`}
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
                  subtitulo={isYtd ? `YTD — acumulado do ano` : `Mensal — M${selMes ?? '-'}`}
                />
              ))}
            </TabsContent>

            <TabsContent value="perdas" className="space-y-6 pt-4">
              {rankingPerdas.map(({ key, label, linhas, nota }) => (
                <RankingTabelaPerdas
                  key={key}
                  linhas={linhas}
                  nomesUnidade={nomesUnidade}
                  titulo={label}
                  subtitulo={nota
                    ? `Mensal — ${nota}`
                    : isYtd ? `YTD — Jan a M${selMes ?? '-'}` : `Mensal — M${selMes ?? '-'}`}
                />
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
