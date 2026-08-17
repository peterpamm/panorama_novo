import { describe, expect, it } from 'vitest'
import { agruparRotinasComAjustes, ajusteVigente, diaDaRotinaNoMes } from './rotina-ajuste-dia'
import { AJUSTE_TODAS_UNIDADES, type RotinaAjusteDia, type RotinaFinanceira } from '@/types'

function rotina(id: string, prazo_tipo: RotinaFinanceira['prazo_tipo'] = 'dia_fixo', prazo_dia: number | null = 10): RotinaFinanceira {
  return { id, setor: 'OCs', nome: id, prazo: '', prazo_tipo, prazo_dia, ordem: 0, ativo: true }
}

function ajuste(over: Partial<RotinaAjusteDia>): RotinaAjusteDia {
  return { rotina_id: 'r1', unidade: 'CASCAVEL', ano: 2026, mes: 8, dia: 15, permanente: false, ...over }
}

describe('ajusteVigente', () => {
  it('sem ajuste nenhum, devolve null', () => {
    expect(ajusteVigente([], 'r1', 'CASCAVEL', 2026, 8)).toBeNull()
  })

  it('ignora ajuste de outra rotina, de outra unidade e de outro mês', () => {
    const ajustes = [
      ajuste({ rotina_id: 'r2' }),
      ajuste({ unidade: 'FOZ' }),
      ajuste({ mes: 7 }),
    ]
    expect(ajusteVigente(ajustes, 'r1', 'CASCAVEL', 2026, 8)).toBeNull()
  })

  it('pontual da unidade vence o pontual de todas', () => {
    const ajustes = [
      ajuste({ unidade: AJUSTE_TODAS_UNIDADES, dia: 11 }),
      ajuste({ unidade: 'CASCAVEL', dia: 15 }),
    ]
    expect(ajusteVigente(ajustes, 'r1', 'CASCAVEL', 2026, 8)?.dia).toBe(15)
  })

  it('pontual vence permanente, mesmo o permanente sendo da unidade', () => {
    const ajustes = [
      ajuste({ unidade: 'CASCAVEL', dia: 12, permanente: true, mes: 3 }),
      ajuste({ unidade: AJUSTE_TODAS_UNIDADES, dia: 11 }),
    ]
    expect(ajusteVigente(ajustes, 'r1', 'CASCAVEL', 2026, 8)?.dia).toBe(11)
  })

  it('permanente da unidade vence permanente de todas', () => {
    const ajustes = [
      ajuste({ unidade: AJUSTE_TODAS_UNIDADES, dia: 20, permanente: true, mes: 3 }),
      ajuste({ unidade: 'CASCAVEL', dia: 12, permanente: true, mes: 3 }),
    ]
    expect(ajusteVigente(ajustes, 'r1', 'CASCAVEL', 2026, 8)?.dia).toBe(12)
  })

  it('entre permanentes do mesmo escopo, o de vigência mais recente manda', () => {
    const ajustes = [
      ajuste({ dia: 12, permanente: true, mes: 3 }),
      ajuste({ dia: 18, permanente: true, mes: 6 }),
    ]
    expect(ajusteVigente(ajustes, 'r1', 'CASCAVEL', 2026, 8)?.dia).toBe(18)
  })

  it('permanente ainda não vigente não vale (mês anterior mantém o dia da época)', () => {
    const ajustes = [ajuste({ dia: 18, permanente: true, ano: 2026, mes: 8 })]
    expect(ajusteVigente(ajustes, 'r1', 'CASCAVEL', 2026, 7)).toBeNull()
    expect(ajusteVigente(ajustes, 'r1', 'CASCAVEL', 2026, 8)?.dia).toBe(18)
    expect(ajusteVigente(ajustes, 'r1', 'CASCAVEL', 2027, 1)?.dia).toBe(18)
  })

  it('pontual não vaza pros meses seguintes', () => {
    const ajustes = [ajuste({ dia: 15, permanente: false, mes: 8 })]
    expect(ajusteVigente(ajustes, 'r1', 'CASCAVEL', 2026, 9)).toBeNull()
  })
})

describe('diaDaRotinaNoMes', () => {
  it('sem ajuste, cai no dia do cadastro', () => {
    expect(diaDaRotinaNoMes(rotina('r1'), [], 'CASCAVEL', 2026, 8)).toBe(10)
  })

  it('com ajuste, o ajuste manda', () => {
    expect(diaDaRotinaNoMes(rotina('r1'), [ajuste({ dia: 15 })], 'CASCAVEL', 2026, 8)).toBe(15)
  })

  it('ajuste pra um dia que não existe no mês cai no último dia', () => {
    const permanente = [ajuste({ dia: 31, permanente: true, mes: 1 })]
    expect(diaDaRotinaNoMes(rotina('r1'), permanente, 'CASCAVEL', 2026, 2)).toBe(28)
  })

  it('rotina sem data continua sem data mesmo com ajuste de outra rotina', () => {
    expect(diaDaRotinaNoMes(rotina('r9', 'sem_data', null), [ajuste({})], 'CASCAVEL', 2026, 8)).toBeNull()
  })

  it('arrastar dá dia pra rotina que era sem data', () => {
    const ajustes = [ajuste({ rotina_id: 'r9', dia: 22 })]
    expect(diaDaRotinaNoMes(rotina('r9', 'sem_data', null), ajustes, 'CASCAVEL', 2026, 8)).toBe(22)
  })
})

describe('agruparRotinasComAjustes', () => {
  it('move só a rotina ajustada, mantendo as outras no dia do cadastro', () => {
    const { porDia } = agruparRotinasComAjustes(
      [rotina('r1'), rotina('r2')],
      [ajuste({ rotina_id: 'r1', dia: 15 })],
      'CASCAVEL', 2026, 8,
    )
    expect(porDia.get(15)?.map(r => r.id)).toEqual(['r1'])
    expect(porDia.get(10)?.map(r => r.id)).toEqual(['r2'])
  })

  it('unidade sem ajuste continua vendo o dia original', () => {
    const { porDia } = agruparRotinasComAjustes(
      [rotina('r1')],
      [ajuste({ rotina_id: 'r1', unidade: 'CASCAVEL', dia: 15 })],
      'FOZ', 2026, 8,
    )
    expect(porDia.get(10)?.map(r => r.id)).toEqual(['r1'])
    expect(porDia.has(15)).toBe(false)
  })
})
