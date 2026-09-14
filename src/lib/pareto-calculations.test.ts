import { describe, expect, it } from 'vitest'
import { calcularParetoContas, calcularParetoUnidades } from './pareto-calculations'
import type { DreCalculoRow } from '@/types'

function row(conta_codigo: string, real: number, dif: number): DreCalculoRow {
  return { conta_codigo, real, dif } as DreCalculoRow
}

describe('calcularParetoContas', () => {
  it('ordena pelo maior realizado primeiro (não pelo pior gap, diferente de topContasFaixa)', () => {
    const linhas = calcularParetoContas([
      row('119', 100, -900), // pior gap, mas menor realizado
      row('120', 500, -50),
    ], 119, 130)
    expect(linhas.map(l => l.codigo)).toEqual(['120', '119'])
  })

  it('calcula % do total e % acumulado — a curva de Pareto', () => {
    const linhas = calcularParetoContas([
      row('119', 600, 0),
      row('120', 300, 0),
      row('121', 100, 0),
    ], 119, 130)
    expect(linhas).toEqual([
      { codigo: '119', realizado: 600, percentualDoTotal: 60, percentualAcumulado: 60 },
      { codigo: '120', realizado: 300, percentualDoTotal: 30, percentualAcumulado: 90 },
      { codigo: '121', realizado: 100, percentualDoTotal: 10, percentualAcumulado: 100 },
    ])
  })

  it('exclui totalizadoras (evita contar o mesmo custo duas vezes)', () => {
    const linhas = calcularParetoContas([
      row('118', 1000, 0), // totalizadora de Manutenções
      row('119', 600, 0),
      row('120', 400, 0),
    ], 118, 130, { excluir: ['118'] })
    expect(linhas.map(l => l.codigo)).toEqual(['119', '120'])
  })

  it('conta zerada (sem realizado nem gap) não entra no ranking', () => {
    const linhas = calcularParetoContas([row('119', 100, 0), row('120', 0, 0)], 119, 130)
    expect(linhas.map(l => l.codigo)).toEqual(['119'])
  })

  it('faixa vazia retorna lista vazia, sem dividir por zero', () => {
    expect(calcularParetoContas([], 119, 130)).toEqual([])
  })
})

describe('calcularParetoUnidades', () => {
  it('agrega por unidade em vez de por conta, mesma curva de Pareto', () => {
    const linhas = calcularParetoUnidades(new Map([['FOZ', 800], ['CAS', 200]]))
    expect(linhas).toEqual([
      { codigo: 'FOZ', realizado: 800, percentualDoTotal: 80, percentualAcumulado: 80 },
      { codigo: 'CAS', realizado: 200, percentualDoTotal: 20, percentualAcumulado: 100 },
    ])
  })

  it('unidade com valor zero fica de fora', () => {
    const linhas = calcularParetoUnidades(new Map([['FOZ', 100], ['CAS', 0]]))
    expect(linhas.map(l => l.codigo)).toEqual(['FOZ'])
  })
})
