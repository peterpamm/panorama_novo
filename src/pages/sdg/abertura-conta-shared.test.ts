import { describe, expect, it } from 'vitest'
import type { DreCalculoRow } from '@/types'
import { agruparContasBrutas, agruparContasBrutasPorGrupo, comPercentualEDelta, type GrupoAberturaConta } from './abertura-conta-shared'

function row(overrides: Partial<DreCalculoRow>): DreCalculoRow {
  return { conta_codigo: '200', real: 0, remun: 0, dif: 0, avr: 0, avo: null, ...overrides }
}

describe('agruparContasBrutas', () => {
  it('soma realizado/remunerado por conta e busca o orçado no mapa pré-calculado', () => {
    const calc = [row({ conta_codigo: '200', real: 100, remun: 90 }), row({ conta_codigo: '200', real: 50, remun: 40 })]
    const orcadoPorConta = new Map([['200', 120]])
    const brutas = agruparContasBrutas(calc, [200], orcadoPorConta)
    expect(brutas).toEqual([{ codigo: '200', realizado: 150, realizadoComSinal: 150, remunerado: 130, orcado: 120 }])
  })

  it('realizadoComSinal soma o sinal original do GInfo (realComSinal), não a magnitude', () => {
    // Conta com mais crédito que débito no período: realComSinal positivo mesmo com `real` (abs) também positivo aqui — mas em outro mês pode divergir do sinal de `real`.
    const calc = [row({ conta_codigo: '200', real: 100, remun: 0, realComSinal: -40 })]
    const brutas = agruparContasBrutas(calc, [200])
    expect(brutas[0].realizado).toBe(100)
    expect(brutas[0].realizadoComSinal).toBe(-40)
  })

  it('conta sem entrada no mapa de orçado vira 0, não null/erro', () => {
    const brutas = agruparContasBrutas([row({ conta_codigo: '200', real: 10, remun: 10 })], [200])
    expect(brutas[0].orcado).toBe(0)
  })

  it('filtra fora contas zeradas (sem realizado nem remunerado)', () => {
    const brutas = agruparContasBrutas([row({ conta_codigo: '200', real: 0, remun: 0 })], [200])
    expect(brutas).toEqual([])
  })
})

describe('agruparContasBrutasPorGrupo', () => {
  it('soma os códigos de um grupo (ex: Vale Refeição = 057 op + 173 adm) numa única linha, orçado incluso', () => {
    const calc = [row({ conta_codigo: '057', real: 100, remun: 80 }), row({ conta_codigo: '173', real: 50, remun: 40 })]
    const orcadoPorConta = new Map([['057', 70], ['173', 30]])
    const grupos: GrupoAberturaConta[] = [{ rotulo: 'Vale Refeição', codigos: [57, 173] }]
    const brutas = agruparContasBrutasPorGrupo(calc, grupos, orcadoPorConta)
    expect(brutas).toEqual([{ codigo: 'Vale Refeição', realizado: 150, realizadoComSinal: 150, remunerado: 120, orcado: 100 }])
  })
})

describe('comPercentualEDelta', () => {
  // Caso normal: conta de custo, GInfo manda o realizado negativo (débito >
  // crédito) — `realizadoComSinal` reflete isso (-100), enquanto `realizado`
  // (magnitude, usado só pra barra/%) continua positivo (100).
  const brutas = [{ codigo: '200', realizado: 100, realizadoComSinal: -100, remunerado: 90, orcado: 120 }]

  it('comparativo "orcado" (padrão): delta = orçado + realizadoComSinal (equivale a orçado - magnitude no caso normal)', () => {
    const [linha] = comPercentualEDelta(brutas, 1000, 'orcado')
    expect(linha.delta).toBe(20) // 120 + (-100)
  })

  it('comparativo "remunerado": delta = remunerado + realizadoComSinal', () => {
    const [linha] = comPercentualEDelta(brutas, 1000, 'remunerado')
    expect(linha.delta).toBe(-10) // 90 + (-100)
  })

  it('conta com mais crédito que débito no período (realizadoComSinal positivo): Gap também fica positivo, não "estourado"', () => {
    // Caso real reportado pelo usuário: Vales Financeiros em Praia Grande —
    // Realizado = +1.537 (sobrou/creditou), Orçado = 0. Gap tinha que dar
    // +1.537 (bom), não -1.537 (como dava usando a magnitude).
    const valesFinanceiros = [{ codigo: '052', realizado: 1537, realizadoComSinal: 1537, remunerado: 0, orcado: 0 }]
    const [linha] = comPercentualEDelta(valesFinanceiros, 1000, 'orcado')
    expect(linha.delta).toBe(1537)
  })

  it('percentualDoCusto é sobre o realizadoMae informado (usa a magnitude, não o sinal), 0 quando realizadoMae é 0', () => {
    const [linha] = comPercentualEDelta(brutas, 0, 'orcado')
    expect(linha.percentualDoCusto).toBe(0)
    const [linha2] = comPercentualEDelta(brutas, 200, 'orcado')
    expect(linha2.percentualDoCusto).toBe(50)
  })
})
