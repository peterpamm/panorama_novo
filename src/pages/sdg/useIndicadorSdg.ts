import { useMemo } from 'react'
import {
  normalizarParaCalculo, calcularReceita, avrPorPrefixo,
  calcularSemaforo, calcularImpactoFinanceiro, buscarMetaComFallback,
  calcularSerieAnual, calcularSerieCaptura,
} from '@/lib/farol-calculations'
import { PACOTES } from '@/lib/constants'
import type { DreCalculoRow, DreLongoRow, Meta } from '@/types'

export interface IndicadorSdgParams {
  codigo: string
  rowsAno: DreLongoRow[]
  metas: Meta[]
  unidade: string
  negocio: string
  ano: number
  mes: number
  mesAcumMax: number | null
}

/** Cálculos compartilhados dos slides de indicador (cards mensal/YTD + séries dos gráficos). */
export function useIndicadorSdg({ codigo, rowsAno, metas, unidade, negocio, ano, mes, mesAcumMax }: IndicadorSdgParams) {
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

  const ctx = { unidade, negocio, ano, codigo, prefixos: info.prefixos }

  const mensal = useMemo(() => {
    const avr  = avrPorPrefixo(calcMensal, info.prefixos)
    const meta = buscarMetaComFallback(calcMensal, metas, { ...ctx, isYtd: false, mes })
    return { avr, meta, semaforo: calcularSemaforo(avr, meta, info.natureza), impacto: calcularImpactoFinanceiro(avr, meta, receitaMensal, info.natureza) }
  }, [calcMensal, metas, mes, receitaMensal])

  const ytd = useMemo(() => {
    const avr  = avrPorPrefixo(calcYtd, info.prefixos)
    const meta = buscarMetaComFallback(calcYtd, metas, { ...ctx, isYtd: true, mes: mesAcumMax ?? mes })
    return { avr, meta, semaforo: calcularSemaforo(avr, meta, info.natureza), impacto: calcularImpactoFinanceiro(avr, meta, receitaYtd, info.natureza) }
  }, [calcYtd, metas, mes, mesAcumMax, receitaYtd])

  const serieAnual = useMemo(
    () => calcularSerieAnual(rowsAno, metas, { ...ctx }),
    [rowsAno, metas],
  )
  const serieCaptura = useMemo(
    () => calcularSerieCaptura(rowsAno, metas, { ...ctx }),
    [rowsAno, metas],
  )

  return { info, calcMensal, calcYtd, mensal, ytd, serieAnual, serieCaptura }
}
