import { describe, expect, it } from 'vitest'
import type { DreLongoRow, Meta } from '@/types'
import { calcularRankingIndicador, calcularRankingReceita, corClasseAtingimento } from './ranking-calculations'

function linha(
  unidade: string,
  conta_codigo: string,
  mes: number,
  tipo_periodo: 'MENSAL' | 'ACUMULADO_ANO',
  remunerado: number,
  realizado: number,
  avr = 0,
): DreLongoRow {
  return { unidade, negocio: 'ROTA', ano: 2025, mes, tipo_periodo, conta_codigo, remunerado, realizado, diferenca: realizado - remunerado, avo: null, avr }
}

function meta(unidade: string, codigo: string, mes: number, meta_avr: number): Meta {
  return { unidade, negocio: 'ROTA', ano: 2025, codigo, mes, meta_avr }
}

describe('calcularRankingReceita', () => {
  const rows: DreLongoRow[] = [
    linha('A', '002', 11, 'ACUMULADO_ANO', 900000, 1000000),
    linha('B', '002', 11, 'ACUMULADO_ANO', 900000, 500000),
    linha('AMBEV', '002', 11, 'ACUMULADO_ANO', 1000000, 2000000),
  ]
  const metas: Meta[] = [
    meta('A', '002', 0, 900000),
    meta('B', '002', 0, 900000),
    meta('AMBEV', '002', 0, 1000000),
  ]

  it('calcula % de atingimento (receita YTD / meta anual) e ranqueia decrescente, AMBEV sempre por último sem rank', () => {
    const ranking = calcularRankingReceita(rows, metas, { negocio: 'ROTA', ano: 2025 })
    expect(ranking.map(r => r.unidade)).toEqual(['A', 'B', 'AMBEV'])
    expect(ranking[0]).toMatchObject({ rank: 1, receitaYtd: 1000000 })
    expect(ranking[0].percentualAtingimento).toBeCloseTo((1000000 / 900000) * 100, 5)
    expect(ranking[1]).toMatchObject({ rank: 2 })
    expect(ranking[2]).toMatchObject({ rank: null, unidade: 'AMBEV' })
  })

  it('percentualAtingimento null quando não há meta cadastrada', () => {
    const ranking = calcularRankingReceita(rows, [], { negocio: 'ROTA', ano: 2025 })
    expect(ranking.every(r => r.percentualAtingimento === null)).toBe(true)
  })
})

describe('calcularRankingIndicador', () => {
  it('conta de custo: delta positivo (gastou menos que a meta) ranqueia primeiro', () => {
    const rows: DreLongoRow[] = [
      linha('A', '021', 1, 'MENSAL', -1000000, -900000, -90),
      linha('B', '021', 1, 'MENSAL', -1000000, -1000000, -100),
    ]
    const metas: Meta[] = [meta('A', '021', 0, 100), meta('B', '021', 0, 100)]

    const ranking = calcularRankingIndicador(rows, metas, { natureza: 'custo', prefixos: ['021'] }, '021', { negocio: 'ROTA', ano: 2025, isYtd: false, mes: 1 })

    expect(ranking.map(r => r.unidade)).toEqual(['A', 'B'])
    expect(ranking[0]).toMatchObject({ rank: 1, avr: 90, meta: 100, delta: 10 })
    expect(ranking[1]).toMatchObject({ rank: 2, avr: 100, meta: 100, delta: 0 })
  })

  it('conta de performance: delta positivo (superou a meta) ranqueia primeiro, sem inverter sinal', () => {
    const rows: DreLongoRow[] = [
      linha('A', '232', 1, 'MENSAL', 100000, 120000, 120),
      linha('B', '232', 1, 'MENSAL', 100000, 80000, 80),
    ]
    const metas: Meta[] = [meta('A', '232', 0, 100), meta('B', '232', 0, 100)]

    const ranking = calcularRankingIndicador(rows, metas, { natureza: 'performance', prefixos: ['232'] }, '232', { negocio: 'ROTA', ano: 2025, isYtd: false, mes: 1 })

    expect(ranking.map(r => r.unidade)).toEqual(['A', 'B'])
    expect(ranking[0]).toMatchObject({ delta: 20 })
    expect(ranking[1]).toMatchObject({ delta: -20 })
  })
})

describe('corClasseAtingimento', () => {
  it('positivo quando >= 100%, negativo quando < 100%, semCor quando null', () => {
    expect(corClasseAtingimento(100)).toBe('positivo')
    expect(corClasseAtingimento(99.9)).toBe('negativo')
    expect(corClasseAtingimento(null)).toBe('semCor')
  })
})
