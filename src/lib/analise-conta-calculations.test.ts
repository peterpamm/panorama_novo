import { describe, expect, it } from 'vitest'
import type { DreCalculoRow, DreLongoRow } from '@/types'
import {
  calcularAberturaDetalheMensal,
  calcularAberturaResumo,
  calcularComparativoAnual,
  calcularResumoConta,
  calcularSerieMensalConta,
  corClasseGap,
  corClasseGapReal,
} from './analise-conta-calculations'

function linha(conta_codigo: string, mes: number, remunerado: number, realizado: number): DreLongoRow {
  return {
    unidade: 'FOZ', negocio: 'ROTA', ano: 2025, mes, tipo_periodo: 'MENSAL', conta_codigo,
    remunerado, realizado, diferenca: realizado - remunerado, avo: null, avr: 0,
  }
}

describe('calcularSerieMensalConta', () => {
  it('conta de custo: gastar menos que o remunerado dá gap positivo (bom)', () => {
    const serie = calcularSerieMensalConta([linha('021', 1, -1000000, -900000)])
    expect(serie).toEqual([{ mes: 1, remunerado: 1000000, realizado: 900000, gap: 100000 }])
  })

  it('conta de performance (EBITDA): superar o remunerado também dá gap positivo, sem precisar inverter nada', () => {
    const serie = calcularSerieMensalConta([linha('232', 1, 100000, 150000)])
    expect(serie).toEqual([{ mes: 1, remunerado: 100000, realizado: 150000, gap: 50000 }])
  })

  it('conta de custo que gastou mais que o remunerado dá gap negativo (mau)', () => {
    const serie = calcularSerieMensalConta([linha('021', 1, -1000000, -1100000)])
    expect(serie[0].gap).toBe(-100000)
  })

  it('soma múltiplas linhas do mesmo mês (caso defensivo)', () => {
    const serie = calcularSerieMensalConta([
      linha('021', 1, -500000, -450000),
      linha('021', 1, -500000, -450000),
    ])
    expect(serie).toEqual([{ mes: 1, remunerado: 1000000, realizado: 900000, gap: 100000 }])
  })

  it('ordena os meses', () => {
    const serie = calcularSerieMensalConta([
      linha('021', 3, -100, -100),
      linha('021', 1, -100, -100),
      linha('021', 2, -100, -100),
    ])
    expect(serie.map(p => p.mes)).toEqual([1, 2, 3])
  })
})

describe('calcularResumoConta', () => {
  const rowsAtual: DreCalculoRow[] = [
    { conta_codigo: '021', remun: 1000, real: 900, dif: 100, avr: 0, avo: null },
    { conta_codigo: '021', remun: 2000, real: 1700, dif: 300, avr: 0, avo: null },
  ]

  it('soma remunerado/realizado/gap e calcula gapPercent sobre o remunerado total', () => {
    const r = calcularResumoConta(rowsAtual, [])
    expect(r.remunerado).toBe(3000)
    expect(r.realizado).toBe(2600)
    expect(r.gap).toBe(400)
    expect(r.gapPercent).toBeCloseTo((400 / 3000) * 100, 5)
  })

  it('calcula variação % vs ano anterior quando há dado', () => {
    const rowsAnoAnterior: DreCalculoRow[] = [
      { conta_codigo: '021', remun: 2500, real: 2400, dif: 100, avr: 0, avo: null },
    ]
    const r = calcularResumoConta(rowsAtual, rowsAnoAnterior)
    expect(r.variacaoRemun).toBeCloseTo(((3000 - 2500) / 2500) * 100, 5)
    expect(r.variacaoReal).toBeCloseTo(((2600 - 2400) / 2400) * 100, 5)
  })

  it('variação null quando não há dado do ano anterior', () => {
    const r = calcularResumoConta(rowsAtual, [])
    expect(r.variacaoRemun).toBeNull()
    expect(r.variacaoReal).toBeNull()
  })
})

describe('calcularAberturaResumo', () => {
  it('agrupa por conta e soma remun/real/gap, AVR é a média', () => {
    const resumo = calcularAberturaResumo([
      linha('021', 1, -1000000, -900000),
      linha('033', 1, -200000, -250000),
    ])
    expect(resumo).toHaveLength(2)
    const c021 = resumo.find(r => r.codigo === '021')!
    expect(c021).toMatchObject({ remunerado: 1000000, realizado: 900000, gap: 100000 })
    const c033 = resumo.find(r => r.codigo === '033')!
    expect(c033).toMatchObject({ remunerado: 200000, realizado: 250000, gap: -50000 })
  })
})

describe('calcularAberturaDetalheMensal', () => {
  it('ignora contas sem movimento no ano (remun e real ambos zero)', () => {
    const detalhe = calcularAberturaDetalheMensal([
      linha('021', 1, -1000, -900),
      linha('033', 1, 0, 0),
      linha('033', 2, 0, 0),
    ])
    expect(detalhe.map(d => d.codigo)).toEqual(['021'])
  })

  it('monta a série mensal e o total por conta, ordenado por código', () => {
    const detalhe = calcularAberturaDetalheMensal([
      linha('033', 2, -1000, -900),
      linha('021', 1, -500, -400),
      linha('033', 1, -1000, -1100),
    ])
    expect(detalhe.map(d => d.codigo)).toEqual(['021', '033'])
    const c033 = detalhe.find(d => d.codigo === '033')!
    expect(c033.meses.map(m => m.mes)).toEqual([1, 2])
    expect(c033.total.remunerado).toBe(2000)
    expect(c033.total.realizado).toBe(2000)
    expect(c033.total.gap).toBe(0)
  })
})

describe('calcularComparativoAnual', () => {
  it('soma remun/real por mês e calcula gapRemun/gapReal como anoB - anoA', () => {
    const serie = calcularComparativoAnual(
      [linha('021', 1, -1000, -900)],
      [linha('021', 1, -1200, -1000)],
    )
    expect(serie).toEqual([{ mes: 1, remunA: 1000, remunB: 1200, gapRemun: 200, realA: 900, realB: 1000, gapReal: 100 }])
  })

  it('mescla meses presentes só em um dos anos, tratando o ausente como zero', () => {
    const serie = calcularComparativoAnual(
      [linha('021', 1, -1000, -900)],
      [linha('021', 2, -1200, -1000)],
    )
    expect(serie.map(p => p.mes)).toEqual([1, 2])
    expect(serie[0]).toMatchObject({ remunA: 1000, realA: 900, remunB: 0, realB: 0 })
    expect(serie[1]).toMatchObject({ remunA: 0, realA: 0, remunB: 1200, realB: 1000 })
  })
})

describe('corClasseGapReal', () => {
  it('é o inverso de corClasseGap pro mesmo valor', () => {
    expect(corClasseGapReal(50)).toBe('negativo')
    expect(corClasseGap(50)).toBe('positivo')
    expect(corClasseGapReal(-50)).toBe('positivo')
    expect(corClasseGap(-50)).toBe('negativo')
  })
})

describe('corClasseGap', () => {
  it('positivo quando gap >= 0', () => {
    expect(corClasseGap(50)).toBe('positivo')
    expect(corClasseGap(0)).toBe('positivo')
  })

  it('negativo quando gap < 0', () => {
    expect(corClasseGap(-1)).toBe('negativo')
  })
})
