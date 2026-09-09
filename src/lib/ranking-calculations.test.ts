import { describe, expect, it } from 'vitest'
import type { DreLongoRow, OrcamentoLinha } from '@/types'
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

function orcamento(unidade: string, mes: number, orcado: number): OrcamentoLinha {
  return { unidade, negocio: 'ROTA', ano: 2025, mes, conta_codigo: '002', conta_nome: 'Receita Líquida Operacional', orcado, av: 100, ah: 0 }
}

/**
 * Linha de orçamento pra pacote do Farol (PACOTE_CONTA_ORCAMENTO) — `av` é o
 * valor bruto da planilha, que `buscarMetaOrcamento` ajusta de sinal
 * (`ajustarSinal`): custo (não-performance) vira positivo invertendo o sinal
 * bruto, então `av` negativo aqui vira meta positiva.
 */
function orcamentoPacote(unidade: string, mes: number, contaCodigo: string, av: number): OrcamentoLinha {
  return { unidade, negocio: 'ROTA', ano: 2025, mes, conta_codigo: contaCodigo, conta_nome: 'x', orcado: 0, av, ah: 0 }
}

describe('calcularRankingReceita', () => {
  describe('modo Mensal', () => {
    const rows: DreLongoRow[] = [
      linha('A', '002', 3, 'MENSAL', 900000, 1000000),
      linha('B', '002', 3, 'MENSAL', 900000, 500000),
      linha('AMBEV', '002', 3, 'MENSAL', 1000000, 2000000),
    ]
    const orcamentos: OrcamentoLinha[] = [
      orcamento('A', 3, 900000),
      orcamento('B', 3, 900000),
      orcamento('AMBEV', 3, 1000000),
    ]

    it('compara o realizado do mês com o orçado do mesmo mês e ranqueia decrescente, AMBEV sempre por último sem rank', () => {
      const ranking = calcularRankingReceita(rows, orcamentos, { negocio: 'ROTA', ano: 2025, periodo: 'mensal', mes: 3 })
      expect(ranking.map(r => r.unidade)).toEqual(['A', 'B', 'AMBEV'])
      expect(ranking[0]).toMatchObject({ rank: 1, realizado: 1000000, orcado: 900000, impacto: 100000 })
      expect(ranking[0].percentualAtingimento).toBeCloseTo((1000000 / 900000) * 100, 5)
      expect(ranking[1]).toMatchObject({ rank: 2, impacto: -400000 })
      expect(ranking[2]).toMatchObject({ rank: null, unidade: 'AMBEV' })
    })

    it('percentualAtingimento e impacto null quando não há orçamento importado pro mês', () => {
      const ranking = calcularRankingReceita(rows, [], { negocio: 'ROTA', ano: 2025, periodo: 'mensal', mes: 3 })
      expect(ranking.every(r => r.percentualAtingimento === null && r.orcado === null && r.impacto === null)).toBe(true)
    })
  })

  describe('modo YTD', () => {
    const rows: DreLongoRow[] = [
      linha('A', '002', 3, 'ACUMULADO_ANO', 2700000, 3000000),
    ]
    // Acumulado é até o mês 3 (mesMax=3) — o orçado do YTD soma só jan/fev/mar,
    // ignorando o mês 4 mesmo que ele já tenha orçamento importado.
    const orcamentos: OrcamentoLinha[] = [
      orcamento('A', 1, 900000),
      orcamento('A', 2, 900000),
      orcamento('A', 3, 900000),
      orcamento('A', 4, 900000),
    ]

    it('soma o orçado só até o mesmo mês do acumulado realizado (mesMax)', () => {
      const ranking = calcularRankingReceita(rows, orcamentos, { negocio: 'ROTA', ano: 2025, periodo: 'ytd', mes: 0 })
      expect(ranking[0]).toMatchObject({ realizado: 3000000, orcado: 2700000 })
      expect(ranking[0].percentualAtingimento).toBeCloseTo((3000000 / 2700000) * 100, 5)
    })
  })

  describe('modo 1º/2º semestre', () => {
    it('usa o bloco recalculado (mes=13/14) quando existe', () => {
      const rows: DreLongoRow[] = [linha('A', '002', 6, 'MENSAL', 900000, 1000000)]
      const orcamentos: OrcamentoLinha[] = [orcamento('A', 13, 5400000), orcamento('A', 14, 6000000)]
      const s1 = calcularRankingReceita(rows, orcamentos, { negocio: 'ROTA', ano: 2025, periodo: 's1', mes: 0 })
      expect(s1[0].orcado).toBe(5400000)
      const s2 = calcularRankingReceita(rows, orcamentos, { negocio: 'ROTA', ano: 2025, periodo: 's2', mes: 0 })
      expect(s2[0].orcado).toBe(6000000)
    })

    it('sem o bloco recalculado, soma os 6 meses do semestre como fallback', () => {
      const rows: DreLongoRow[] = [linha('A', '002', 6, 'MENSAL', 900000, 1000000)]
      const orcamentos: OrcamentoLinha[] = [1, 2, 3, 4, 5, 6].map(mes => orcamento('A', mes, 900000))
      const s1 = calcularRankingReceita(rows, orcamentos, { negocio: 'ROTA', ano: 2025, periodo: 's1', mes: 0 })
      expect(s1[0].orcado).toBe(900000 * 6)
    })
  })
})

describe('calcularRankingIndicador', () => {
  it('conta de custo: delta positivo (gastou menos que a meta) ranqueia primeiro — meta vem do Orçamento (conta 012, sinal invertido)', () => {
    const rows: DreLongoRow[] = [
      linha('A', '021', 1, 'MENSAL', -1000000, -900000, -90),
      linha('B', '021', 1, 'MENSAL', -1000000, -1000000, -100),
    ]
    const orcamentos: OrcamentoLinha[] = [orcamentoPacote('A', 1, '012', -100), orcamentoPacote('B', 1, '012', -100)]

    const ranking = calcularRankingIndicador(rows, orcamentos, { natureza: 'custo', prefixos: ['021'] }, '021', { negocio: 'ROTA', ano: 2025, periodo: 'mensal', mes: 1 })

    expect(ranking.map(r => r.unidade)).toEqual(['A', 'B'])
    expect(ranking[0]).toMatchObject({ rank: 1, avr: 90, meta: 100, delta: 10 })
    expect(ranking[1]).toMatchObject({ rank: 2, avr: 100, meta: 100, delta: 0 })
  })

  it('conta de performance: delta positivo (superou a meta) ranqueia primeiro, sem inverter sinal — meta vem do Orçamento (conta 133)', () => {
    const rows: DreLongoRow[] = [
      linha('A', '233', 1, 'MENSAL', 100000, 120000, 120),
      linha('B', '233', 1, 'MENSAL', 100000, 80000, 80),
    ]
    const orcamentos: OrcamentoLinha[] = [orcamentoPacote('A', 1, '133', 100), orcamentoPacote('B', 1, '133', 100)]

    const ranking = calcularRankingIndicador(rows, orcamentos, { natureza: 'performance', prefixos: ['233'] }, '233', { negocio: 'ROTA', ano: 2025, periodo: 'mensal', mes: 1 })

    expect(ranking.map(r => r.unidade)).toEqual(['A', 'B'])
    expect(ranking[0]).toMatchObject({ delta: 20 })
    expect(ranking[1]).toMatchObject({ delta: -20 })
  })

  it('1º semestre: usa o bloco recalculado do Orçamento (mes=13) e reconstrói o realizado somando jan-jun', () => {
    const rows: DreLongoRow[] = [
      linha('A', '021', 1, 'MENSAL', -500000, -450000, -90),
      linha('A', '021', 2, 'MENSAL', -500000, -460000, -92),
    ]
    const orcamentos: OrcamentoLinha[] = [orcamentoPacote('A', 13, '012', -100)]

    const ranking = calcularRankingIndicador(rows, orcamentos, { natureza: 'custo', prefixos: ['021'] }, '021', { negocio: 'ROTA', ano: 2025, periodo: 's1', mes: 0 })

    expect(ranking[0].meta).toBe(100)
  })

  it('sem linha de orçamento pro período, meta é null (sem fallback pra tabela metas/AVO)', () => {
    const rows: DreLongoRow[] = [linha('A', '021', 6, 'MENSAL', -500000, -450000, -90)]
    const ranking = calcularRankingIndicador(rows, [], { natureza: 'custo', prefixos: ['021'] }, '021', { negocio: 'ROTA', ano: 2025, periodo: 'mensal', mes: 6 })
    expect(ranking[0].meta).toBeNull()
  })
})

describe('corClasseAtingimento', () => {
  it('positivo quando >= 100%, negativo quando < 100%, semCor quando null', () => {
    expect(corClasseAtingimento(100)).toBe('positivo')
    expect(corClasseAtingimento(99.9)).toBe('negativo')
    expect(corClasseAtingimento(null)).toBe('semCor')
  })
})
