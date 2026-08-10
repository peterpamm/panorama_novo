import { describe, expect, it } from 'vitest'
import {
  bonusRankingAmbev, ebitdaBatido, resolverResumoMesUnidade,
  somarAcumuladoAnual, somarBonusRankingAmbev, somarPontosExtras, somarPontuacaoSetores, totalHistoricoSetores,
} from './resumo-geral-calculations'

describe('bonusRankingAmbev', () => {
  it('1º lugar dá +50', () => {
    expect(bonusRankingAmbev(1)).toBe(50)
  })

  it('2º ao 5º lugar dá +30', () => {
    expect(bonusRankingAmbev(2)).toBe(30)
    expect(bonusRankingAmbev(5)).toBe(30)
  })

  it('demais posições dão 0', () => {
    expect(bonusRankingAmbev(6)).toBe(0)
    expect(bonusRankingAmbev(20)).toBe(0)
  })

  it('sem posição lançada dá 0', () => {
    expect(bonusRankingAmbev(null)).toBe(0)
  })
})

describe('somarBonusRankingAmbev', () => {
  it('1º nos 3 rankings dá 150', () => {
    expect(somarBonusRankingAmbev({ gente: 1, frota: 1, seguranca: 1 })).toBe(150)
  })

  it('soma posições diferentes em cada ranking', () => {
    expect(somarBonusRankingAmbev({ gente: 1, frota: 3, seguranca: null })).toBe(50 + 30 + 0)
  })

  it('sem nenhuma posição lançada dá 0', () => {
    expect(somarBonusRankingAmbev({ gente: null, frota: null, seguranca: null })).toBe(0)
  })
})

describe('ebitdaBatido', () => {
  it('bate quando AVR >= meta (performance, maior é melhor)', () => {
    expect(ebitdaBatido(15, 12)).toBe(true)
    expect(ebitdaBatido(12, 12)).toBe(true)
    expect(ebitdaBatido(10, 12)).toBe(false)
  })

  it('sem AVR ou sem meta não bate', () => {
    expect(ebitdaBatido(null, 12)).toBe(false)
    expect(ebitdaBatido(15, null)).toBe(false)
  })
})

describe('somarPontuacaoSetores', () => {
  it('soma os pontos de todos os setores/negócios da mesma unidade', () => {
    const contribuicoes = [
      { setor: 'gente', unidade: 'FOZ', negocio: 'CONS', pontos: 150 },
      { setor: 'financeiro', unidade: 'FOZ', negocio: 'CONS', pontos: 180 },
    ]
    expect(somarPontuacaoSetores(contribuicoes)).toBe(330)
  })

  it('setor sem indicador lançado (pontos null) conta como 0, não derruba a soma', () => {
    const contribuicoes = [
      { setor: 'distribuicao', unidade: 'FOZ', negocio: 'CONS', pontos: null },
      { setor: 'gente', unidade: 'FOZ', negocio: 'CONS', pontos: 150 },
    ]
    expect(somarPontuacaoSetores(contribuicoes)).toBe(150)
  })

  it('lista vazia soma 0', () => {
    expect(somarPontuacaoSetores([])).toBe(0)
  })
})

describe('somarPontosExtras', () => {
  it('soma EBITDA batido + os 3 Rankings Ambev', () => {
    expect(somarPontosExtras(true, { gente: 1, frota: null, seguranca: null })).toBe(100)
    expect(somarPontosExtras(true, { gente: 3, frota: 3, seguranca: 3 })).toBe(50 + 90)
    expect(somarPontosExtras(false, { gente: 1, frota: null, seguranca: null })).toBe(50)
    expect(somarPontosExtras(false, { gente: null, frota: null, seguranca: null })).toBe(0)
  })
})

describe('resolverResumoMesUnidade', () => {
  it('soma setores ao vivo + bonificações do mês', () => {
    const r = resolverResumoMesUnidade({
      contribuicoesSetores: [
        { setor: 'gente', unidade: 'FOZ', negocio: 'CONS', pontos: 150 },
        { setor: 'financeiro', unidade: 'FOZ', negocio: 'CONS', pontos: 180 },
      ],
      ebitdaAvr: 15,
      ebitdaMeta: 12,
      posicoesAmbev: { gente: 1, frota: null, seguranca: null },
    })
    expect(r.pontuacaoSetores).toBe(330)
    expect(r.ebitdaOk).toBe(true)
    expect(r.pontosExtras).toBe(100) // +50 EBITDA + 50 (1º Ambev Gente)
    expect(r.pontuacaoFinal).toBe(430)
  })
})

describe('somarAcumuladoAnual', () => {
  it('sem histórico: soma os 12 meses ao vivo', () => {
    const pontuacao = new Map([[1, 100], [2, 100]])
    const total = somarAcumuladoAnual(mes => pontuacao.get(mes) ?? null, null)
    expect(total).toBe(200)
  })

  it('com histórico até Junho: soma a base + só os meses depois de Junho, sem contar Jan-Jun de novo', () => {
    const pontuacaoPorMes = new Map([
      [1, 999], [2, 999], [3, 999], [4, 999], [5, 999], [6, 999], // não deve entrar, já coberto pelo histórico
      [7, 100], [8, 100],
    ])
    const total = somarAcumuladoAnual(mes => pontuacaoPorMes.get(mes) ?? null, { mesFinal: 6, pontuacaoAcumulada: 4547.25 })
    expect(total).toBe(4547.25 + 100 + 100)
  })

  it('mês sem nenhum indicador lançado (null) conta como 0, não deixa o total null', () => {
    const total = somarAcumuladoAnual(() => null, { mesFinal: 6, pontuacaoAcumulada: 500 })
    expect(total).toBe(500)
  })
})

describe('totalHistoricoSetores', () => {
  it('soma os 6 setores do histórico importado (o "Total" da planilha, recalculado)', () => {
    const h = { unidade: 'FRANBEL', ano: 2026, mes_final: 6, gente: 535, frota: 740, seguranca: 407.75, financeiro: 340, distribuicao: 75, armazem: 680 }
    expect(totalHistoricoSetores(h)).toBe(2777.75)
  })
})
