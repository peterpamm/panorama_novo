import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongo } from '@/hooks/useDreLongo'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useMetas } from '@/hooks/useMetas'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { MetaCard } from '@/components/farol/MetaCard'
import { IndicadorPainel } from '@/components/farol/IndicadorPainel'
import { EstouroZeroCard } from '@/components/farol/EstouroZeroCard'
import { ReducaoCard } from '@/components/farol/ReducaoCard'
import { ReducaoEvolucaoTable } from '@/components/farol/ReducaoEvolucaoTable'
import type { LinhaTabelaReducao } from '@/components/farol/ReducaoEvolucaoTable'
import { FarolFilters, type PeriodoFarol } from '@/components/farol/FarolFilters'
import {
  PACOTES, PACOTES_RESUMO, PACOTES_GENTE, PACOTES_FROTA, PACOTES_SEGURANCA, PACOTES_ADM,
  ESTOURO_ZERO_CARDS, REDUCAO_CUSTOS_CARDS,
} from '@/lib/constants'
import {
  avrPorPrefixo, calcularEstouroZero, calcularEvolucaoReducaoCustos, calcularImpactoFinanceiro,
  calcularIncrementoUnidadesNovas, calcularReceita, calcularReducaoCustos, calcularSemaforo, calcularSerieAnual,
  calcularSerieCaptura, calcularSerieCapturaReducaoCustos, calcularSerieReducaoCustos, normalizarParaCalculo,
  somaReal, somaRealAnoAnteriorComMedia,
} from '@/lib/farol-calculations'
import type { UnidadeIncremento } from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { fetchOrcamentoPaginado } from '@/lib/orcamento-fetch'
import { formatCurrencyInteiro } from '@/lib/utils'
import type { DreLongoRow, OrcamentoLinha } from '@/types'

function unicos<T>(valores: T[]): T[] {
  return Array.from(new Set(valores))
}

export function FarolDeMetasPage() {
  const { role, unidade: minhaUnidade } = useAuth()
  const { unidades: todasUnidades, loading: loadingUnidades } = useUnidades()

  const unidadesDisponiveis = useMemo(() => {
    if (role === 'admin') return todasUnidades
    return todasUnidades.filter(u => u.codigo === minhaUnidade || u.codigo === 'AMBEV')
  }, [role, minhaUnidade, todasUnidades])

  const [selUnidade, setSelUnidade] = useState('')
  useEffect(() => {
    if (!selUnidade && unidadesDisponiveis.length > 0) setSelUnidade(unidadesDisponiveis[0].codigo)
  }, [unidadesDisponiveis, selUnidade])

  const dataEntradaUnidade = useMemo(
    () => unidadesDisponiveis.find(u => u.codigo === selUnidade)?.data_entrada ?? null,
    [unidadesDisponiveis, selUnidade],
  )

  const unidadesComEntrada = useMemo(
    () => todasUnidades.filter(u => u.data_entrada && u.codigo !== 'AMBEV'),
    [todasUnidades],
  )
  const { rows: rowsTodasUnidades } = useDreLongoTodasUnidades()

  const { rows: rowsUnidade, loading: loadingDre } = useDreLongo(selUnidade || null)
  const { metas } = useMetas(selUnidade || null)

  const negociosDisponiveis = useMemo(() => unicos(rowsUnidade.map(r => r.negocio)).sort(), [rowsUnidade])
  const [selNegocio, setSelNegocio] = useState('')
  useEffect(() => {
    if (negociosDisponiveis.length === 0) return
    if (selNegocio && negociosDisponiveis.includes(selNegocio)) return
    setSelNegocio(negociosDisponiveis.includes('CONS') ? 'CONS' : negociosDisponiveis[0])
  }, [negociosDisponiveis, selNegocio])

  const rowsNegocio = useMemo(() => rowsUnidade.filter(r => r.negocio === selNegocio), [rowsUnidade, selNegocio])

  const unidadesParciais = useMemo<UnidadeIncremento[]>(() => {
    return unidadesComEntrada.map(u => ({
      dataEntrada: u.data_entrada,
      rows: rowsTodasUnidades.filter(r => r.unidade === u.codigo && r.negocio === selNegocio),
    }))
  }, [unidadesComEntrada, rowsTodasUnidades, selNegocio])
  const unidadesIncremento = selUnidade === 'AMBEV' ? unidadesParciais : []

  const [cardEvolucao, setCardEvolucao] = useState(REDUCAO_CUSTOS_CARDS[0]?.nome ?? '')

  const anosDisponiveis = useMemo(() => unicos(rowsNegocio.map(r => r.ano)).sort((a, b) => a - b), [rowsNegocio])
  const [selAno, setSelAno] = useState<number | null>(null)
  useEffect(() => {
    if (anosDisponiveis.length === 0) return
    if (selAno && anosDisponiveis.includes(selAno)) return
    setSelAno(anosDisponiveis[anosDisponiveis.length - 1])
  }, [anosDisponiveis, selAno])

  const rowsAno = useMemo(() => rowsNegocio.filter(r => r.ano === selAno), [rowsNegocio, selAno])

  const mesesDisponiveis = useMemo(
    () => unicos(rowsAno.filter(r => r.tipo_periodo === 'MENSAL').map(r => r.mes)).sort((a, b) => a - b),
    [rowsAno],
  )
  const [selMes, setSelMes] = useState<number | null>(null)
  useEffect(() => {
    if (mesesDisponiveis.length === 0) return
    if (selMes && mesesDisponiveis.includes(selMes)) return
    setSelMes(mesesDisponiveis[mesesDisponiveis.length - 1])
  }, [mesesDisponiveis, selMes])

  const [periodo, setPeriodo] = useState<PeriodoFarol>('mensal')
  const isYtd = periodo === 'ytd'

  const mesAcumMax = useMemo(() => {
    const acumRows = rowsAno.filter(r => r.tipo_periodo === 'ACUMULADO_ANO')
    return acumRows.length > 0 ? Math.max(...acumRows.map(r => r.mes)) : null
  }, [rowsAno])

  const dfBaseMensal = useMemo(
    () => rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === selMes),
    [rowsAno, selMes],
  )
  const dfBaseYtd = useMemo(
    () => (mesAcumMax === null ? [] : rowsAno.filter(r => r.tipo_periodo === 'ACUMULADO_ANO' && r.mes === mesAcumMax)),
    [rowsAno, mesAcumMax],
  )
  // 1º semestre: enquanto o acumulado do banco ainda é Jan–Jun (mesAcumMax <= 6), usa
  // ele direto (número exato do GInfo). Depois de julho importado, reconstrói com os
  // meses Jan–Jun (soma exata pra R$; AVR de pacote mono-prefixo vira média ponderada).
  const dfBaseS1 = useMemo(() => {
    if (mesAcumMax !== null && mesAcumMax <= 6) return dfBaseYtd
    return rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes <= 6)
  }, [rowsAno, mesAcumMax, dfBaseYtd])

  // 2º semestre: não existe atalho "acumulado" (o ACUMULADO_ANO da view é sempre desde
  // janeiro) — sempre reconstrói somando os meses de Jul a Dez já importados.
  const dfBaseS2 = useMemo(
    () => rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes >= 7 && r.mes <= 12),
    [rowsAno],
  )

  const dfBase = periodo === 'ytd' ? dfBaseYtd : periodo === 's1' ? dfBaseS1 : periodo === 's2' ? dfBaseS2 : dfBaseMensal
  const periodoTexto = periodo === 'ytd'
    ? `YTD (M${mesAcumMax ?? '-'})`
    : periodo === 's1'
      ? '1º Semestre'
      : periodo === 's2'
        ? '2º Semestre'
        : `Mensal (M${selMes ?? '-'})`

  const calcBase = useMemo(() => normalizarParaCalculo(dfBase), [dfBase])
  const receita = useMemo(() => calcularReceita(calcBase), [calcBase])

  // Meta mensal/anual/semestral direto do orçamento (pacotes mapeados em
  // PACOTE_CONTA_ORCAMENTO) em vez da tabela `metas` — ver src/lib/orcamento-farol.ts.
  const [orcamentoRows, setOrcamentoRows] = useState<OrcamentoLinha[]>([])
  useEffect(() => {
    if (selUnidade === '' || selNegocio === '' || selAno === null) { setOrcamentoRows([]); return }
    let cancelado = false
    fetchOrcamentoPaginado((from, to) =>
      supabase.from('orcamentos').select('*')
        .eq('unidade', selUnidade).eq('negocio', selNegocio).eq('ano', selAno)
        .order('id', { ascending: true })
        .range(from, to),
    )
      .then(rows => { if (!cancelado) setOrcamentoRows(rows) })
      .catch(() => { if (!cancelado) setOrcamentoRows([]) })
    return () => { cancelado = true }
  }, [selUnidade, selNegocio, selAno])

  function calcularIndicador(codigo: string) {
    const info = PACOTES[codigo]
    const avr = avrPorPrefixo(calcBase, info.prefixos)
    // Meta vem só do Orçamento — sem fallback pra tabela `metas`/AVO do DRE
    // (nem no anual, nem no mensal, nem no semestre): null quando o Orçamento
    // não tem linha pra essa unidade/ano/período, em vez de exibir um valor
    // de uma fonte diferente da que o usuário está de fato mantendo.
    const meta = selAno === null
      ? null
      : buscarMetaOrcamento(orcamentoRows, {
          unidade: selUnidade, negocio: selNegocio, ano: selAno, codigo,
          mes: periodo === 's1' ? 13 : periodo === 's2' ? 14 : isYtd ? 0 : (selMes ?? 0),
        })
    const semaforo = calcularSemaforo(avr, meta, info.natureza)
    const impacto = calcularImpactoFinanceiro(avr, meta, receita, info.natureza)
    const serieAnualBase = selAno === null
      ? []
      : calcularSerieAnual(rowsAno, metas, { unidade: selUnidade, negocio: selNegocio, ano: selAno, codigo, prefixos: info.prefixos })
    const serieAnual = serieAnualBase.map(ponto => {
      const metaOrcMes = buscarMetaOrcamento(orcamentoRows, { unidade: selUnidade, negocio: selNegocio, ano: selAno ?? 0, codigo, mes: ponto.mes })
      return { ...ponto, meta: metaOrcMes }
    })
    // Curva de Captura: a meta anual (e o ritmo necessário calculado a partir
    // dela) vem só do orçamento — `metaOrcamentoAnual` é passado direto
    // (mesmo quando null) pra `calcularSerieCaptura` nunca cair no fallback
    // interno dela pra tabela `metas` (só cai quando o argumento é omitido).
    const metaOrcamentoAnual = selAno === null
      ? null
      : buscarMetaOrcamento(orcamentoRows, { unidade: selUnidade, negocio: selNegocio, ano: selAno, codigo, mes: 0 })
    const serieCaptura = selAno === null
      ? []
      : calcularSerieCaptura(
          rowsAno, metas, { unidade: selUnidade, negocio: selNegocio, ano: selAno, codigo, prefixos: info.prefixos },
          metaOrcamentoAnual,
        )
    return { codigo, info, avr, meta, semaforo, impacto, serieAnual, serieCaptura }
  }

  function indicadoresPara(codigos: string[]) {
    return codigos.map(calcularIndicador)
  }

  function renderCardsGrid(indicadores: ReturnType<typeof calcularIndicador>[]) {
    if (indicadores.length === 0) {
      return <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum indicador selecionado para esta categoria.</p>
    }
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {indicadores.map(({ codigo, info, avr, meta, semaforo, impacto }) => (
          <MetaCard
            key={codigo}
            nome={info.nome}
            periodoTexto={periodoTexto}
            avr={avr}
            meta={meta}
            impacto={impacto}
            semaforo={semaforo}
          />
        ))}
      </div>
    )
  }

  function rowsParaReducao(ano: number, contas: string[], mesLimite: number): DreLongoRow[] {
    // 1º semestre com julho+ já importado: o acumulado do banco passou de junho,
    // então reconstrói somando os meses Jan..mesLimite.
    if (periodo === 's1' && (mesAcumMax ?? 0) > 6) {
      return rowsNegocio.filter(r =>
        r.tipo_periodo === 'MENSAL' && r.ano === ano && r.mes <= mesLimite
        && contas.some(c => r.conta_codigo.startsWith(c)),
      )
    }
    const tipo = periodo === 'mensal' ? 'MENSAL' : 'ACUMULADO_ANO'
    return rowsNegocio.filter(r =>
      r.tipo_periodo === tipo && r.ano === ano && r.mes === mesLimite
      && contas.some(c => r.conta_codigo.startsWith(c)),
    )
  }

  function paraPainel(indicadores: ReturnType<typeof calcularIndicador>[]) {
    return indicadores.map(({ codigo, info, serieAnual, serieCaptura }) => ({
      codigo, nome: info.nome, natureza: info.natureza, serieAnual, serieCaptura,
    }))
  }

  function paraPainelReducao() {
    if (selAno === null) return []
    return REDUCAO_CUSTOS_CARDS.map(card => ({
      codigo: card.nome,
      nome: card.nome,
      natureza: 'custo' as const,
      serieAnual: calcularSerieReducaoCustos(rowsNegocio, dataEntradaUnidade, selAno, card.contas, unidadesIncremento),
      serieCaptura: calcularSerieCapturaReducaoCustos(rowsNegocio, dataEntradaUnidade, selAno, card.contas, unidadesIncremento),
    }))
  }

  function paraTabelaEvolucaoReducao(): { meses: number[]; linhas: LinhaTabelaReducao[] } {
    const card = REDUCAO_CUSTOS_CARDS.find(c => c.nome === cardEvolucao)
    if (selAno === null || !card) return { meses: [], linhas: [] }

    const linhasReais = unidadesDisponiveis
      .filter(u => u.codigo !== 'AMBEV')
      .map(u => {
        const rows = rowsTodasUnidades.filter(r => r.unidade === u.codigo && r.negocio === selNegocio)
        const evolucao = calcularEvolucaoReducaoCustos(rows, u.data_entrada, selAno, card.contas)
        return {
          codigo: u.codigo,
          nome: u.nome,
          porMes: new Map(evolucao.meses.map(p => [p.mes, p.resultado])),
          anual: evolucao.anual,
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome))

    const rowsAmbev = rowsTodasUnidades.filter(r => r.unidade === 'AMBEV' && r.negocio === selNegocio)
    const evolucaoAmbev = calcularEvolucaoReducaoCustos(rowsAmbev, null, selAno, card.contas, unidadesParciais)
    const linhaAmbev: LinhaTabelaReducao = {
      codigo: 'AMBEV',
      nome: 'AMBEV (consolidado)',
      porMes: new Map(evolucaoAmbev.meses.map(p => [p.mes, p.resultado])),
      anual: evolucaoAmbev.anual,
      destaque: true,
    }

    const meses = unicos(linhasReais.flatMap(l => [...l.porMes.keys()])).sort((a, b) => a - b)

    return { meses, linhas: [...linhasReais, linhaAmbev] }
  }

  const indicadoresResumo = indicadoresPara(PACOTES_RESUMO)
  const indicadoresGente = indicadoresPara(PACOTES_GENTE)
  const indicadoresFrota = indicadoresPara(PACOTES_FROTA)
  const indicadoresSeguranca = indicadoresPara(PACOTES_SEGURANCA)
  const indicadoresAdm = indicadoresPara(PACOTES_ADM)

  const carregando = loadingUnidades || loadingDre

  if (carregando && !selUnidade) {
    return (
      <div className="space-y-6 p-4 md:p-6 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gray-200/20 dark:bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gray-200/20 dark:bg-white/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 space-y-4">
          <Skeleton className="h-24 w-full bg-gray-200/50 dark:bg-gray-700/50 rounded-2xl" />
          <Skeleton className="h-64 w-full bg-gray-200/50 dark:bg-gray-700/50 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (unidadesDisponiveis.length === 0) {
    return (
      <div className="p-4 md:p-6 relative">
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-gray-200/30 dark:border-gray-700/30 shadow-xl shadow-gray-200/20 dark:shadow-black/20 p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma unidade disponível para o seu usuário.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 relative">
      {/* Elementos decorativos sutis */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gray-200/20 dark:bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gray-200/20 dark:bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* BLOCO 1: Filtros com fundo azul gradiente */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[hsl(222,45%,20%)] to-[hsl(222,35%,30%)] dark:from-[hsl(224,28%,14%)] dark:to-[hsl(224,22%,20%)] shadow-xl shadow-blue-900/20 overflow-hidden">
          <div className="p-4 md:p-6">
            <FarolFilters
              unidades={unidadesDisponiveis.map(u => ({ value: u.codigo, label: u.nome }))}
              negocios={negociosDisponiveis.map(n => ({ value: n, label: n }))}
              anos={anosDisponiveis}
              meses={mesesDisponiveis}
              selUnidade={selUnidade}
              selNegocio={selNegocio}
              selAno={selAno ?? 0}
              selMes={selMes ?? 0}
              periodo={periodo}
              onUnidadeChange={v => { setSelUnidade(v); setSelNegocio(''); setSelAno(null); setSelMes(null) }}
              onNegocioChange={v => { setSelNegocio(v); setSelAno(null); setSelMes(null) }}
              onAnoChange={setSelAno}
              onMesChange={setSelMes}
              onPeriodoChange={setPeriodo}
            />
          </div>
        </div>

        {/* CONTEÚDO: Direto no fundo, sem container extra */}
        {dfBase.length === 0 ? (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/30 dark:border-gray-700/30 shadow-xl shadow-gray-200/20 dark:shadow-black/20 p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum DRE importado para esse período ainda.</p>
          </div>
        ) : (
          <Tabs defaultValue="resumo" className="w-full">
            <TabsList className="bg-gray-200/70 dark:bg-gray-700/70 p-1 rounded-xl inline-flex w-full md:w-auto">
              <TabsTrigger 
                value="resumo" 
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex-1 md:flex-none"
              >
                Resumo Geral
              </TabsTrigger>
              <TabsTrigger 
                value="gente" 
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex-1 md:flex-none"
              >
                Pacote de Gente
              </TabsTrigger>
              <TabsTrigger 
                value="frota" 
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex-1 md:flex-none"
              >
                Pacote de Frota
              </TabsTrigger>
              <TabsTrigger 
                value="seguranca" 
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex-1 md:flex-none"
              >
                Pacote de Segurança
              </TabsTrigger>
              <TabsTrigger 
                value="adm" 
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex-1 md:flex-none"
              >
                Pacote ADM
              </TabsTrigger>
              <TabsTrigger 
                value="reducao" 
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex-1 md:flex-none"
              >
                Redução de Custos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="space-y-6 pt-6">
              {renderCardsGrid(indicadoresResumo)}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/30 dark:border-gray-700/30 shadow-xl shadow-gray-200/20 dark:shadow-black/20 p-4">
                <IndicadorPainel indicadores={paraPainel(indicadoresResumo)} ano={selAno ?? 0} />
              </div>
            </TabsContent>

            <TabsContent value="gente" className="space-y-6 pt-6">
              {renderCardsGrid(indicadoresGente)}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {ESTOURO_ZERO_CARDS.map(card => (
                  <EstouroZeroCard
                    key={card.nome}
                    nome={card.nome}
                    periodoTexto={periodoTexto}
                    resultado={calcularEstouroZero(calcBase, card.prefixos)}
                  />
                ))}
              </div>
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/30 dark:border-gray-700/30 shadow-xl shadow-gray-200/20 dark:shadow-black/20 p-4">
                <IndicadorPainel indicadores={paraPainel(indicadoresGente)} ano={selAno ?? 0} />
              </div>
            </TabsContent>

            <TabsContent value="frota" className="space-y-6 pt-6">
              {renderCardsGrid(indicadoresFrota)}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/30 dark:border-gray-700/30 shadow-xl shadow-gray-200/20 dark:shadow-black/20 p-4">
                <IndicadorPainel indicadores={paraPainel(indicadoresFrota)} ano={selAno ?? 0} />
              </div>
            </TabsContent>

            <TabsContent value="seguranca" className="space-y-6 pt-6">
              {renderCardsGrid(indicadoresSeguranca)}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/30 dark:border-gray-700/30 shadow-xl shadow-gray-200/20 dark:shadow-black/20 p-4">
                <IndicadorPainel indicadores={paraPainel(indicadoresSeguranca)} ano={selAno ?? 0} />
              </div>
            </TabsContent>

            <TabsContent value="adm" className="space-y-6 pt-6">
              {renderCardsGrid(indicadoresAdm)}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/30 dark:border-gray-700/30 shadow-xl shadow-gray-200/20 dark:shadow-black/20 p-4">
                <IndicadorPainel indicadores={paraPainel(indicadoresAdm)} ano={selAno ?? 0} />
              </div>
            </TabsContent>

            <TabsContent value="reducao" className="space-y-6 pt-6">
              {selAno !== null && (mesAcumMax !== null || selMes !== null) ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {REDUCAO_CUSTOS_CARDS.map(card => {
                    const mesLimite = periodo === 'ytd'
                      ? (mesAcumMax ?? 0)
                      : periodo === 's1'
                        ? Math.min(mesAcumMax ?? 0, 6)
                        : (selMes ?? 0)
                    const mesesComparar = periodo === 'mensal' ? [mesLimite] : Array.from({ length: mesLimite }, (_, i) => i + 1)
                    const realAtual = somaReal(normalizarParaCalculo(rowsParaReducao(selAno, card.contas, mesLimite)), card.contas)
                    const realAnteriorBruto = somaRealAnoAnteriorComMedia(rowsNegocio, null, selAno - 1, card.contas, mesesComparar) ?? 0
                    const ajusteIndividual = (somaRealAnoAnteriorComMedia(rowsNegocio, dataEntradaUnidade, selAno - 1, card.contas, mesesComparar) ?? 0) - realAnteriorBruto
                    const extraAmbev = calcularIncrementoUnidadesNovas(unidadesIncremento, selAno - 1, card.contas, mesesComparar)
                    const realAnterior = realAnteriorBruto + ajusteIndividual + extraAmbev
                    return (
                      <ReducaoCard
                        key={card.nome}
                        nome={card.nome}
                        periodoTexto={periodoTexto}
                        resultado={calcularReducaoCustos(realAtual, realAnterior)}
                        realAnteriorBruto={realAnteriorBruto}
                      />
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum indicador selecionado para esta categoria.</p>
              )}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/30 dark:border-gray-700/30 shadow-xl shadow-gray-200/20 dark:shadow-black/20 p-4">
                <IndicadorPainel
                  indicadores={paraPainelReducao()}
                  ano={selAno ?? 0}
                  nomeSerie="Realizado"
                  nomeMeta="Meta Mensal (méd.)"
                  formatter={formatCurrencyInteiro}
                  onSelecionadoChange={setCardEvolucao}
                />
              </div>
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/30 dark:border-gray-700/30 shadow-xl shadow-gray-200/20 dark:shadow-black/20 p-4">
                <ReducaoEvolucaoTable {...paraTabelaEvolucaoReducao()} nomeCard={cardEvolucao} />
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}