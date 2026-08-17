import { describe, expect, it } from 'vitest'
import { topContasFaixa } from './top-contas'
import type { DreCalculoRow } from '@/types'

function row(conta_codigo: string, real: number, dif: number): DreCalculoRow {
  return { conta_codigo, real, dif } as DreCalculoRow
}

describe('topContasFaixa', () => {
  it('ordena pelo pior gap e ignora conta fora da faixa', () => {
    const linhas = topContasFaixa([
      row('160', 100, -50),
      row('165', 100, -900),
      row('300', 100, -9999), // fora da faixa
    ], 157, 227)
    expect(linhas.map(l => l.codigo)).toEqual(['165', '160'])
  })

  it('soma as linhas da mesma conta', () => {
    const linhas = topContasFaixa([row('160', 100, -50), row('160', 40, -10)], 157, 227)
    expect(linhas).toEqual([{ codigo: '160', realizado: 140, gap: -60 }])
  })

  it('excluir tira as contas totalizadoras do ranking sem mexer na faixa', () => {
    const linhas = topContasFaixa([
      row('157', 1000, -5000), // totalizadora, seria o pior gap
      row('165', 100, -900),
    ], 157, 227, { excluir: ['157'] })
    expect(linhas.map(l => l.codigo)).toEqual(['165'])
  })

  it('excluir casa por número, então "0157" também sai', () => {
    const linhas = topContasFaixa([row('0157', 1000, -5000), row('165', 100, -900)], 157, 227, { excluir: ['157'] })
    expect(linhas.map(l => l.codigo)).toEqual(['165'])
  })

  it('respeita o topN', () => {
    const linhas = topContasFaixa([row('160', 1, -3), row('165', 1, -2), row('170', 1, -1)], 157, 227, { topN: 2 })
    expect(linhas.map(l => l.codigo)).toEqual(['160', '165'])
  })
})
