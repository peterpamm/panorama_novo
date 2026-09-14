import { describe, expect, it } from 'vitest'
import { agruparPorValor, distribuirColunas } from './RankingAderenciaGlass'
import type { RankingLinhaAderencia } from './RankingTabelas'

function linha(unidade: string, percentual: number | null): RankingLinhaAderencia {
  return { unidade, percentual, rank: null }
}

describe('agruparPorValor', () => {
  it('cada valor distinto vira um grupo, ordenado do maior pro menor', () => {
    const { grupos, semValor } = agruparPorValor([linha('A', 90), linha('B', 80), linha('C', 100)])
    expect(grupos.map(g => ({ posicao: g.posicao, valor: g.valor, unidades: g.itens.map(i => i.unidade) }))).toEqual([
      { posicao: 1, valor: 100, unidades: ['C'] },
      { posicao: 2, valor: 90, unidades: ['A'] },
      { posicao: 3, valor: 80, unidades: ['B'] },
    ])
    expect(semValor).toEqual([])
  })

  it('unidades com o mesmo % compartilham a mesma posição (empate de verdade, sem critério de desempate)', () => {
    const { grupos } = agruparPorValor([linha('A', 100), linha('B', 100), linha('C', 90)])
    expect(grupos).toEqual([
      { posicao: 1, valor: 100, itens: [linha('A', 100), linha('B', 100)] },
      { posicao: 2, valor: 90, itens: [linha('C', 90)] },
    ])
  })

  it('unidade sem resultado (percentual null) fica separada, fora dos grupos', () => {
    const { grupos, semValor } = agruparPorValor([linha('A', 90), linha('B', null)])
    expect(grupos).toEqual([{ posicao: 1, valor: 90, itens: [linha('A', 90)] }])
    expect(semValor).toEqual([linha('B', null)])
  })
})

describe('distribuirColunas', () => {
  it('divide os grupos em 2 colunas por quantidade de unidades, o mais equilibrado possível', () => {
    const grupos = [
      { posicao: 4, valor: 70, itens: [linha('A', 70)] },
      { posicao: 5, valor: 60, itens: [linha('B', 60)] },
      { posicao: 6, valor: 50, itens: [linha('C', 50)] },
      { posicao: 7, valor: 40, itens: [linha('D', 40)] },
    ]
    const { esquerda, direita } = distribuirColunas(grupos)
    expect(esquerda.map(g => g.posicao)).toEqual([4, 5])
    expect(direita.map(g => g.posicao)).toEqual([6, 7])
  })

  it('nunca separa um grupo empatado entre as duas colunas, mesmo que isso desequilibre um pouco a contagem', () => {
    const grupos = [
      { posicao: 4, valor: 70, itens: [linha('A', 70), linha('B', 70), linha('C', 70)] }, // grupo de 3, sozinho já passa da metade
      { posicao: 5, valor: 60, itens: [linha('D', 60)] },
    ]
    const { esquerda, direita } = distribuirColunas(grupos)
    expect(esquerda.map(g => g.posicao)).toEqual([4])
    expect(esquerda[0].itens).toHaveLength(3)
    expect(direita.map(g => g.posicao)).toEqual([5])
  })
})
