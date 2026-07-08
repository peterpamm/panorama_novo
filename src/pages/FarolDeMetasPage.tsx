import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
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
import { FarolFilters } from '@/components/farol/FarolFilters'
import {
  PACOTES, PACOTES_RESUMO, PACOTES_GENTE, PACOTES_FROTA, PACOTES_SEGURANCA, PACOTES_ADM,
  ESTOURO_ZERO_CARDS, REDUCAO_CUSTOS_CARDS,
} from '@/lib/constants'
import {
  avrPorPrefixo, buscarMetaComFallback, calcularEstouroZero, calcularEvolucaoReducaoCustos, calcularImpactoFinanceiro,
  calcularIncrementoUnidadesNovas, calcularReceita, calcularReducaoCustos, calcularSemaforo, calcularSerieAnual,
  calcularSerieCaptura, calcularSerieCapturaReducaoCustos, calcularSerieReducaoCustos, normalizarParaCalculo,
  somaReal, somaRealAnoAnteriorComMedia,
} from '@/lib/farol-calculations'
import type { UnidadeIncremento } from '@/lib/farol-calculations'
import { formatCurrencyInteiro } from '@/lib/utils'
import type { DreLongoRow } from '@/types'

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

  // Unidades com data_entrada cadastrada (entraram no meio de algum ano) — usadas pra
  // incrementar o "ano anterior" da AMBEV (consolidado) com a média estimada dessas
  // unidades nos meses em que ainda não existiam — tanto no card/gráficos principais
  // quanto na linha totalizadora da tabela de evolução por unidade, abaixo.
  const unidadesComEntrada = useMemo(
    () => todasUnidades.filter(u => u.data_entrada && u.codigo !== 'AMBEV'),
    [todasUnidades],
  )
  // Busca o DRE de todas as unidades visíveis ao usuário (RLS já restringe: admin vê
  // todas, usuário comum só vê a própria + AMBEV) — usado pro incremento da AMBEV e
  // pra montar a tabela de evolução por unidade.
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

  // Estimativa de cada unidade parcial (data_entrada), pronta pra somar no histórico
  // de uma consolidadora (AMBEV) — calcularIncrementoUnidadesNovas soma o "extra" de
  // cada uma. Sempre calculado (usado pela linha totalizadora da tabela de evolução);
  // `unidadesIncremento` só aplica isso no card/gráficos quando a unidade selecionada
  // no filtro principal é a própria AMBEV.
  const unidadesParciais = useMemo<UnidadeIncremento[]>(() => {
    return unidadesComEntrada.map(u => ({
      dataEntrada: u.data_entrada,
      rows: rowsTodasUnidades.filter(r => r.unidade === u.codigo && r.negocio === selNegocio),
    }))
  }, [unidadesComEntrada, rowsTodasUnidades, selNegocio])
  const unidadesIncremento = selUnidade === 'AMBEV' ? unidadesParciais : []

  // Card (Frota Leve / Despesas com Viagem) atualmente selecionado no dropdown do
  // gráfico — a tabela de evolução por unidade abaixo acompanha a mesma seleção.
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

  const [isYtd, setIsYtd] = useState(false)

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

  const dfBase = isYtd ? dfBaseYtd : dfBaseMensal
  const periodoTexto = isYtd ? `YTD (M${mesAcumMax ?? '-'})` : `Mensal (M${selMes ?? '-'})`

  const calcBase = useMemo(() => normalizarParaCalculo(dfBase), [dfBase])
  const receita = useMemo(() => calcularReceita(calcBase), [calcBase])

  function calcularIndicador(codigo: string) {
    const info = PACOTES[codigo]
    const avr = avrPorPrefixo(calcBase, info.prefixos)
    const meta = selAno === null || selMes === null
      ? null
      : buscarMetaComFallback(calcBase, metas, { unidade: selUnidade, negocio: selNegocio, ano: selAno, codigo, isYtd, mes: selMes, prefixos: info.prefixos })
    const semaforo = calcularSemaforo(avr, meta, info.natureza)
    const impacto = calcularImpactoFinanceiro(avr, meta, receita, info.natureza)
    const serieAnual = selAno === null
      ? []
      : calcularSerieAnual(rowsAno, metas, { unidade: selUnidade, negocio: selNegocio, ano: selAno, codigo, prefixos: info.prefixos })
    const serieCaptura = selAno === null
      ? []
      : calcularSerieCaptura(rowsAno, metas, { unidade: selUnidade, negocio: selNegocio, ano: selAno, codigo, prefixos: info.prefixos })
    return { codigo, info, avr, meta, semaforo, impacto, serieAnual, serieCaptura }
  }

  function indicadoresPara(codigos: string[]) {
    return codigos.map(calcularIndicador)
  }

  function renderCardsGrid(indicadores: ReturnType<typeof calcularIndicador>[]) {
    if (indicadores.length === 0) {
      return <p className="text-sm text-muted-foreground">Nenhum indicador selecionado para esta categoria.</p>
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
    // No YTD usa o bloco ACUMULADO_ANO (TOTAL) que já vem pronto do GInfo, em vez de
    // somar os meses individuais — igual ao resto do painel (ver dfBaseYtd acima),
    // pra não divergir de eventuais ajustes que só aparecem no acumulado oficial.
    const tipo = isYtd ? 'ACUMULADO_ANO' : 'MENSAL'
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

  // Evolução mês a mês de cada unidade (linhas da tabela abaixo do gráfico, só na aba
  // Redução de Custos) — uma linha por unidade que o usuário tem acesso (admin: todas;
  // usuário comum: só a própria), mais a AMBEV como linha totalizadora ao final.
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
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (unidadesDisponiveis.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma unidade disponível para o seu usuário.</p>
  }

  return (
    <div className="space-y-6">
      <FarolFilters
        unidades={unidadesDisponiveis.map(u => ({ value: u.codigo, label: u.nome }))}
        negocios={negociosDisponiveis.map(n => ({ value: n, label: n }))}
        anos={anosDisponiveis}
        meses={mesesDisponiveis}
        selUnidade={selUnidade}
        selNegocio={selNegocio}
        selAno={selAno ?? 0}
        selMes={selMes ?? 0}
        isYtd={isYtd}
        onUnidadeChange={v => { setSelUnidade(v); setSelNegocio(''); setSelAno(null); setSelMes(null) }}
        onNegocioChange={v => { setSelNegocio(v); setSelAno(null); setSelMes(null) }}
        onAnoChange={setSelAno}
        onMesChange={setSelMes}
        onModoChange={setIsYtd}
      />

      {dfBase.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum DRE importado para esse período ainda.</p>
      ) : (
        <Tabs defaultValue="resumo">
          <TabsList>
            <TabsTrigger value="resumo">Resumo Geral</TabsTrigger>
            <TabsTrigger value="gente">Pacote de Gente</TabsTrigger>
            <TabsTrigger value="frota">Pacote de Frota</TabsTrigger>
            <TabsTrigger value="seguranca">Pacote de Segurança</TabsTrigger>
            <TabsTrigger value="adm">Pacote ADM</TabsTrigger>
            <TabsTrigger value="reducao">Redução de Custos</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="space-y-6 pt-4">
            {renderCardsGrid(indicadoresResumo)}
            <IndicadorPainel indicadores={paraPainel(indicadoresResumo)} ano={selAno ?? 0} />
          </TabsContent>

          <TabsContent value="gente" className="space-y-6 pt-4">
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
            <IndicadorPainel indicadores={paraPainel(indicadoresGente)} ano={selAno ?? 0} />
          </TabsContent>

          <TabsContent value="frota" className="space-y-6 pt-4">
            {renderCardsGrid(indicadoresFrota)}
            <IndicadorPainel indicadores={paraPainel(indicadoresFrota)} ano={selAno ?? 0} />
          </TabsContent>

          <TabsContent value="seguranca" className="space-y-6 pt-4">
            {renderCardsGrid(indicadoresSeguranca)}
            <IndicadorPainel indicadores={paraPainel(indicadoresSeguranca)} ano={selAno ?? 0} />
          </TabsContent>

          <TabsContent value="adm" className="space-y-6 pt-4">
            {renderCardsGrid(indicadoresAdm)}
            <IndicadorPainel indicadores={paraPainel(indicadoresAdm)} ano={selAno ?? 0} />
          </TabsContent>

          <TabsContent value="reducao" className="space-y-6 pt-4">
            {selAno !== null && (mesAcumMax !== null || selMes !== null) ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {REDUCAO_CUSTOS_CARDS.map(card => {
                  const mesLimite = isYtd ? (mesAcumMax ?? 0) : (selMes ?? 0)
                  const mesesComparar = isYtd ? Array.from({ length: mesLimite }, (_, i) => i + 1) : [mesLimite]
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
              <p className="text-sm text-muted-foreground">Nenhum indicador selecionado para esta categoria.</p>
            )}
            <IndicadorPainel
              indicadores={paraPainelReducao()}
              ano={selAno ?? 0}
              nomeSerie="Realizado"
              nomeMeta="Meta Mensal (méd.)"
              formatter={formatCurrencyInteiro}
              onSelecionadoChange={setCardEvolucao}
            />
            <ReducaoEvolucaoTable {...paraTabelaEvolucaoReducao()} nomeCard={cardEvolucao} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
