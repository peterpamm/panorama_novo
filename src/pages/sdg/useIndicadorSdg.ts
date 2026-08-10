import { useMemo } from 'react'
import {
  normalizarParaCalculo, calcularReceita, avrPorPrefixo,
  calcularSemaforo, calcularImpactoFinanceiro,
  calcularSerieAnual, calcularSerieCaptura,
} from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { PACOTES } from '@/lib/constants'
import type { DreCalculoRow, DreLongoRow, OrcamentoLinha } from '@/types'

export interface IndicadorSdgParams {
  codigo: string
  rowsAno: DreLongoRow[]
  orcamentoRows: OrcamentoLinha[]
  unidade: string
  negocio: string
  ano: number
  mes: number
  mesAcumMax: number | null
}

/** Cálculos compartilhados dos slides de indicador (cards mensal/YTD + séries dos gráficos). Meta vem só do Orçamento — ver orcamento-farol.ts (mesma fonte do Farol de Metas). */
export function useIndicadorSdg({ codigo, rowsAno, orcamentoRows, unidade, negocio, ano, mes, mesAcumMax }: IndicadorSdgParams) {
  const info = PACOTES[codigo]

  const dfMensal = useMemo(
    () => rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === mes),
    [rowsAno, mes],
  )
  const dfYtd = useMemo(
    () => mesAcumMax === null ? [] : rowsAno.filter(r => r.tipo_periodo === 'ACUMULADO_ANO' && r.mes === mesAcumMax),
    [rowsAno, mesAcumMax],
  )

  const calcMensal: DreCalculoRow[] = useMemo(() => normalizarParaCalculo(dfMensal), [dfMensal])
  const calcYtd: DreCalculoRow[]    = useMemo(() => normalizarParaCalculo(dfYtd),    [dfYtd])

  const receitaMensal = useMemo(() => calcularReceita(calcMensal), [calcMensal])
  const receitaYtd    = useMemo(() => calcularReceita(calcYtd),    [calcYtd])

  const ctx = { unidade, negocio, ano, codigo }

  const mensal = useMemo(() => {
    const avr  = avrPorPrefixo(calcMensal, info.prefixos)
    const meta = buscarMetaOrcamento(orcamentoRows, { ...ctx, mes })
    return { avr, meta, semaforo: calcularSemaforo(avr, meta, info.natureza), impacto: calcularImpactoFinanceiro(avr, meta, receitaMensal, info.natureza) }
  }, [calcMensal, orcamentoRows, mes, receitaMensal])

  const ytd = useMemo(() => {
    const avr  = avrPorPrefixo(calcYtd, info.prefixos)
    const meta = buscarMetaOrcamento(orcamentoRows, { ...ctx, mes: 0 })
    return { avr, meta, semaforo: calcularSemaforo(avr, meta, info.natureza), impacto: calcularImpactoFinanceiro(avr, meta, receitaYtd, info.natureza) }
  }, [calcYtd, orcamentoRows, receitaYtd])

  const serieAnual = useMemo(() => {
    const base = calcularSerieAnual(rowsAno, [], { ...ctx, prefixos: info.prefixos })
    return base.map(ponto => ({ ...ponto, meta: buscarMetaOrcamento(orcamentoRows, { ...ctx, mes: ponto.mes }) }))
  }, [rowsAno, orcamentoRows])

  const serieCaptura = useMemo(() => {
    const metaAnual = buscarMetaOrcamento(orcamentoRows, { ...ctx, mes: 0 })
    return calcularSerieCaptura(rowsAno, [], { ...ctx, prefixos: info.prefixos }, metaAnual)
  }, [rowsAno, orcamentoRows])

  return { info, calcMensal, calcYtd, mensal, ytd, serieAnual, serieCaptura }
}
