import { describe, expect, it } from 'vitest'
import {
  calcularAcidentesTriPorUnidade, calcularPacotePerdasPorUnidade, disponibilidadesDaUnidade, linhaAcidentesTri,
  linhaDisponibilidadeArmazem, linhaDisponibilidadeRota, linhaIndicadorDre, linhaPacotePerdas, linhaScorecard,
  participaContagemEbitda, unidadesCardsFarol,
} from './farol-gerentes'
import type { RankingLinhaIndicador } from './ranking-calculations'
import type { DreLongoRow, ResultadoTri, Unidade } from '@/types'

function unidade(codigo: string, nome: string): Unidade {
  return { id: codigo, codigo, nome, nome_ginfo: null, data_entrada: null, apelidos: null }
}

function rowDre(overrides: Partial<DreLongoRow>): DreLongoRow {
  return {
    unidade: 'DIADEMA', negocio: 'CONS', ano: 2026, mes: 1,
    tipo_periodo: 'MENSAL', conta_codigo: '001',
    remunerado: null, realizado: null, diferenca: null, avo: null, avr: null,
    ...overrides,
  }
}

describe('disponibilidadesDaUnidade', () => {
  it('Ponta Grossa é ARM + EMP, sem ROTA', () => {
    expect(disponibilidadesDaUnidade('Ponta Grossa')).toEqual(['ARM', 'EMP'])
  })

  it('Estância é ARM + EMP, sem ROTA', () => {
    expect(disponibilidadesDaUnidade('Estância')).toEqual(['ARM', 'EMP'])
  })

  it('Rio de Janeiro é só ROTA', () => {
    expect(disponibilidadesDaUnidade('Rio de Janeiro')).toEqual(['ROTA'])
  })

  it('Carambeí não participa de Disponibilidade', () => {
    expect(disponibilidadesDaUnidade('Carambeí')).toEqual([])
  })

  it('demais unidades são ARM + ROTA', () => {
    expect(disponibilidadesDaUnidade('Foz do Iguaçu')).toEqual(['ARM', 'ROTA'])
    expect(disponibilidadesDaUnidade('Diadema')).toEqual(['ARM', 'ROTA'])
  })
})

describe('participaContagemEbitda', () => {
  it('Carambeí fica fora da contagem', () => {
    expect(participaContagemEbitda('Carambeí')).toBe(false)
  })

  it('demais unidades entram na contagem', () => {
    expect(participaContagemEbitda('Petrópolis')).toBe(true)
  })
})

describe('unidadesCardsFarol', () => {
  it('Camaçari e Ponta Grossa viram 2 cards cada, sem card consolidado', () => {
    const unidades = [unidade('CAMACARI', 'Camaçari'), unidade('PG', 'Ponta Grossa')]
    const cards = unidadesCardsFarol(unidades)
    expect(cards).toHaveLength(4)
    expect(cards.map(c => c.titulo)).toEqual([
      'Camaçari — Rota', 'Camaçari — Armazém',
      'Ponta Grossa — Empurrada', 'Ponta Grossa — Armazém',
    ])
    expect(cards.map(c => c.disponibilidades)).toEqual([['ROTA'], ['ARM'], ['EMP'], ['ARM']])
  })

  it('unidade sem split vira 1 card consolidado', () => {
    const cards = unidadesCardsFarol([unidade('DIADEMA', 'Diadema')])
    expect(cards).toEqual([{
      chave: 'DIADEMA', titulo: 'Diadema', unidadeCodigo: 'DIADEMA', negocio: null, disponibilidades: ['ARM', 'ROTA'],
    }])
  })

  it('AMBEV nunca vira card', () => {
    const cards = unidadesCardsFarol([unidade('AMBEV', 'AMBEV'), unidade('DIADEMA', 'Diadema')])
    expect(cards).toHaveLength(1)
  })
})

describe('calcularAcidentesTriPorUnidade', () => {
  it('soma os registros do ano por unidade', () => {
    const registros: ResultadoTri[] = [
      { unidade: 'DIADEMA', ano: 2026, mes: 2, valor: 1 },
      { unidade: 'DIADEMA', ano: 2026, mes: 5, valor: 1 },
      { unidade: 'CASCAVEL', ano: 2026, mes: 3, valor: 1 },
      { unidade: 'CASCAVEL', ano: 2025, mes: 3, valor: 1 }, // ano diferente, não conta
    ]
    const mapa = calcularAcidentesTriPorUnidade(registros, 2026, ['DIADEMA', 'CASCAVEL', 'LONDRINA'])
    expect(mapa.get('DIADEMA')).toBe(2)
    expect(mapa.get('CASCAVEL')).toBe(1)
  })

  it('unidade sem nenhum registro entra com zero, não fica de fora', () => {
    const mapa = calcularAcidentesTriPorUnidade([], 2026, ['DIADEMA'])
    expect(mapa.get('DIADEMA')).toBe(0)
  })
})

describe('linhaAcidentesTri', () => {
  it('bate quando o total do ano é zero (meta sempre 0)', () => {
    expect(linhaAcidentesTri(0)).toMatchObject({ meta: '0', real: '0', status: 'bateu' })
  })

  it('perde quando tem algum acidente registrado', () => {
    expect(linhaAcidentesTri(2)).toMatchObject({ meta: '0', real: '2', status: 'perdeu' })
  })

  it('undefined (sem registro nenhum) conta como zero, bate', () => {
    expect(linhaAcidentesTri(undefined)).toMatchObject({ real: '0', status: 'bateu' })
  })
})

describe('linhaIndicadorDre', () => {
  function linha(overrides: Partial<RankingLinhaIndicador>): RankingLinhaIndicador {
    return { unidade: 'DIADEMA', avr: -5, meta: -6, delta: 1, impacto: 0, rank: null, ...overrides }
  }

  it('sem linha (unidade/negócio sem dado) fica pendente', () => {
    expect(linhaIndicadorDre('Gastos Totais', undefined)).toMatchObject({ meta: '—', real: '—', status: 'pendente' })
  })

  it('delta positivo bate', () => {
    const r = linhaIndicadorDre('Gastos Totais', linha({ delta: 1 }))
    expect(r.status).toBe('bateu')
  })

  it('delta negativo perde', () => {
    const r = linhaIndicadorDre('Gastos Totais', linha({ delta: -1 }))
    expect(r.status).toBe('perdeu')
  })

  it('sem meta cadastrada (delta null) fica pendente mesmo tendo realizado', () => {
    const r = linhaIndicadorDre('Gastos Totais', linha({ meta: null, delta: null }))
    expect(r.status).toBe('pendente')
  })
})

describe('calcularPacotePerdasPorUnidade', () => {
  it('calcula % de perdas acumuladas (mesma régua do Painel de Perdas)', () => {
    const rows: DreLongoRow[] = [
      rowDre({ conta_codigo: '052', diferenca: -1000 }),
      rowDre({ conta_codigo: '001', remunerado: -100000 }),
    ]
    const mapa = calcularPacotePerdasPorUnidade(rows, [], [], 2026)
    expect(mapa.get('DIADEMA')?.realPct).toBeCloseTo(-0.01) // -1000 / 100000
  })

  it('sem nenhum mês CONS/MENSAL no ano, mapa fica vazio', () => {
    const mapa = calcularPacotePerdasPorUnidade([], [], [], 2026)
    expect(mapa.size).toBe(0)
  })
})

describe('linhaPacotePerdas', () => {
  it('sem item (unidade sem dado) fica pendente', () => {
    expect(linhaPacotePerdas(undefined)).toMatchObject({ meta: '—', real: '—', status: 'pendente' })
  })

  it('bate quando o realizado é maior/igual a meta (menos negativo é melhor)', () => {
    const r = linhaPacotePerdas({ realPct: -0.09, metaPct: -0.49 })
    expect(r.status).toBe('bateu')
  })

  it('perde quando o realizado é pior que a meta', () => {
    const r = linhaPacotePerdas({ realPct: -0.6, metaPct: -0.49 })
    expect(r.status).toBe('perdeu')
  })

  it('sem meta cadastrada fica pendente mesmo tendo realizado', () => {
    const r = linhaPacotePerdas({ realPct: -0.09, metaPct: null })
    expect(r.status).toBe('pendente')
    expect(r.real).not.toBe('—')
  })
})

describe('linhaDisponibilidadeRota', () => {
  it('sem registro importado fica pendente', () => {
    expect(linhaDisponibilidadeRota(undefined)).toMatchObject({ meta: '—', real: '—', status: 'pendente' })
  })

  it('bate quando o realizado é maior ou igual a meta', () => {
    const r = linhaDisponibilidadeRota({ unidade: 'DIADEMA', meta: 90, real: 92.5 })
    expect(r).toMatchObject({ meta: '90.0%', real: '92.5%', status: 'bateu' })
  })

  it('perde quando o realizado fica abaixo da meta', () => {
    const r = linhaDisponibilidadeRota({ unidade: 'DIADEMA', meta: 90, real: 85 })
    expect(r.status).toBe('perdeu')
  })
})

describe('linhaScorecard', () => {
  it('sem registro importado fica pendente', () => {
    expect(linhaScorecard('ROTA', undefined)).toMatchObject({ indicador: 'Scorecard Rota.', meta: '—', real: '—', status: 'pendente' })
  })

  it('bate com 80% ou mais, perde abaixo disso', () => {
    expect(linhaScorecard('ARM', { unidade: 'DIADEMA', negocio: 'ARM', score: 80 })).toMatchObject({
      indicador: 'Scorecard Arm.', meta: '80.0%', real: '80.0%', status: 'bateu',
    })
    expect(linhaScorecard('EMP', { unidade: 'ESTANCIA', negocio: 'EMP', score: 79.9 })).toMatchObject({
      indicador: 'Scorecard Empur.', real: '79.9%', status: 'perdeu',
    })
  })
})

describe('linhaDisponibilidadeArmazem', () => {
  it('sem registro importado fica pendente', () => {
    expect(linhaDisponibilidadeArmazem(undefined)).toMatchObject({ meta: '—', real: '—', status: 'pendente' })
  })

  it('sem meta salva (planilha nunca trouxe a coluna) fica pendente mesmo tendo realizado', () => {
    const r = linhaDisponibilidadeArmazem({ unidade: 'DIADEMA', meta: null, real: 85 })
    expect(r).toMatchObject({ meta: '—', real: '85.0%', status: 'pendente' })
  })

  it('bate/perde normalmente quando tem meta salva', () => {
    expect(linhaDisponibilidadeArmazem({ unidade: 'DIADEMA', meta: 90, real: 92 }).status).toBe('bateu')
    expect(linhaDisponibilidadeArmazem({ unidade: 'DIADEMA', meta: 90, real: 85 }).status).toBe('perdeu')
  })
})
