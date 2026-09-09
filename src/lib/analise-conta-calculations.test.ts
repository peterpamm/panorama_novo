import { describe, expect, it } from 'vitest'
import type { DreCalculoRow, DreLongoRow, OrcamentoLinha } from '@/types'
import {
  calcularAberturaDetalheMensal,
  calcularAberturaResumo,
  calcularComparativoAnual,
  calcularPorUnidadeConta,
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

describe('calcularPorUnidadeConta', () => {
  function linhaUnidade(unidade: string, mes: number, remunerado: number, realizado: number, extra?: Partial<DreLongoRow>): DreLongoRow {
    return { ...linha('021', mes, remunerado, realizado), unidade, ...extra }
  }

  /** Receita (conta 002) da unidade no mês — base do impacto em R$. */
  function receita(unidade: string, mes: number, valor: number): DreLongoRow {
    return { ...linha('002', mes, valor, valor), unidade }
  }

  /** Linha do orçamento importado — `conta_codigo` é a numeração própria da planilha de orçamento. */
  function orcamento(unidade: string, conta_codigo: string, mes: number, av: number): OrcamentoLinha {
    return { unidade, negocio: 'ROTA', ano: 2025, mes, conta_codigo, av, orcado: 0 } as OrcamentoLinha
  }

  const SEM_ORCAMENTO = { negocio: 'ROTA', ano: 2025, mesOrcamento: 0 }

  it('soma os meses de cada unidade e calcula o gap % sobre o remunerado dela', () => {
    const linhas = calcularPorUnidadeConta([
      linhaUnidade('FOZ', 1, -1000, -900),
      linhaUnidade('FOZ', 2, -1000, -900),
      linhaUnidade('DIADEMA', 1, -2000, -2200),
    ], '021', [], SEM_ORCAMENTO)
    expect(linhas.map(l => ({ unidade: l.unidade, remunerado: l.remunerado, realizado: l.realizado, gap: l.gap, gapPercent: l.gapPercent }))).toEqual([
      { unidade: 'DIADEMA', remunerado: 2000, realizado: 2200, gap: -200, gapPercent: -10 },
      { unidade: 'FOZ', remunerado: 2000, realizado: 1800, gap: 200, gapPercent: 10 },
    ])
  })

  it('ordena pelo pior gap primeiro', () => {
    const linhas = calcularPorUnidadeConta([
      linhaUnidade('A', 1, -100, -100),
      linhaUnidade('B', 1, -100, -180),
      linhaUnidade('C', 1, -100, -50),
    ], '021', [], SEM_ORCAMENTO)
    expect(linhas.map(l => l.unidade)).toEqual(['B', 'A', 'C'])
  })

  it('unidade sem remunerado no período fica com gap % zero em vez de dividir por zero', () => {
    const linhas = calcularPorUnidadeConta([linhaUnidade('A', 1, 0, -500)], '021', [], SEM_ORCAMENTO)
    expect(linhas[0]).toMatchObject({ remunerado: 0, gapPercent: 0 })
    expect(Number.isFinite(linhas[0].gapPercent)).toBe(true)
  })

  it('meta vem do orçamento importado, não do AVO do DRE', () => {
    const linhas = calcularPorUnidadeConta([
      // AVO do GInfo diz 5% — deve ser ignorado; o orçamento importado diz 10%.
      linhaUnidade('A', 1, -100, -120, { avo: -5, avr: -12 }),
      receita('A', 1, 1000),
    ], '021', [orcamento('A', '012', 0, -10)], SEM_ORCAMENTO)
    expect(linhas[0]).toMatchObject({ remunerado: 100, realizado: 120, meta: 10, avr: 12 })
    // Custo: gastou 12% da receita contra 10% orçado — Δ = -2 p.p. e impacto = -2% de 1000.
    expect(linhas[0].deltaPp).toBeCloseTo(-2)
    expect(linhas[0].impacto).toBeCloseTo(-20)
  })

  it('conta de performance (EBITDA) inverte o sinal: superar a meta é bom', () => {
    const linhas = calcularPorUnidadeConta([
      { ...linha('233', 1, 100, 150), unidade: 'A', avr: 15 },
      receita('A', 1, 1000),
    ], '233', [orcamento('A', '133', 0, 10)], SEM_ORCAMENTO)
    expect(linhas[0].deltaPp).toBeCloseTo(5)
    expect(linhas[0].impacto).toBeCloseTo(50)
  })

  it('conta sem orçamento importado fica sem meta: Δ null e impacto zero, mas o R$ continua', () => {
    const linhas = calcularPorUnidadeConta([
      linhaUnidade('A', 1, -100, -120, { avr: -12 }),
      receita('A', 1, 1000),
    ], '021', [], SEM_ORCAMENTO)
    expect(linhas[0].meta).toBeNull()
    expect(linhas[0].deltaPp).toBeNull()
    expect(linhas[0].impacto).toBe(0)
    expect(linhas[0].gap).toBe(-20)
  })

  it('usa o bloco do mês do orçamento quando o período é um mês específico', () => {
    const orcamentos = [orcamento('A', '012', 0, -10), orcamento('A', '012', 3, -8)]
    const rows = [linhaUnidade('A', 3, -100, -120, { avr: -12 }), receita('A', 3, 1000)]
    expect(calcularPorUnidadeConta(rows, '021', orcamentos, { ...SEM_ORCAMENTO, mesOrcamento: 3 })[0].meta).toBe(8)
    expect(calcularPorUnidadeConta(rows, '021', orcamentos, SEM_ORCAMENTO)[0].meta).toBe(10)
  })

  it('AVR de vários meses entra como média ponderada pelo realizado', () => {
    const linhas = calcularPorUnidadeConta([
      linhaUnidade('A', 1, -100, -100, { avr: -10 }),
      linhaUnidade('A', 2, -100, -300, { avr: -20 }),
    ], '021', [], SEM_ORCAMENTO)
    // (10×100 + 20×300) / 400 = 17,5 — não a média simples (15).
    expect(linhas[0].avr).toBeCloseTo(17.5)
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
