import { describe, expect, it } from 'vitest'
import { agruparEventosPorDia, eventoDaUnidade, ocorrenciasNoMes, rotuloRecorrencia } from './calendario-eventos'
import { AJUSTE_TODAS_UNIDADES, type CalendarioEvento, type CalendarioEventoAjusteDia } from '@/types'

function evento(over: Partial<CalendarioEvento>): CalendarioEvento {
  return {
    id: 'e1', titulo: 'RPS', descricao: '', unidades: ['CASCAVEL'],
    tipo: 'semanal', dia_semana: 5, dia_mes: null,
    data_inicio: '2026-01-01', data_fim: null, cor: 'roxo',
    ...over,
  }
}

function ajusteEvento(over: Partial<CalendarioEventoAjusteDia>): CalendarioEventoAjusteDia {
  return { evento_id: 'e1', unidade: 'CASCAVEL', ano: 2026, mes: 8, dia_original: 7, dia_novo: 6, ...over }
}

describe('ocorrenciasNoMes', () => {
  it('semanal cai em todos os dias daquele dia da semana', () => {
    // Sextas de agosto/2026: 7, 14, 21, 28.
    expect(ocorrenciasNoMes(evento({ dia_semana: 5 }), 2026, 8)).toEqual([7, 14, 21, 28])
  })

  it('único só aparece no próprio mês', () => {
    const e = evento({ tipo: 'unico', data_inicio: '2026-08-19' })
    expect(ocorrenciasNoMes(e, 2026, 8)).toEqual([19])
    expect(ocorrenciasNoMes(e, 2026, 9)).toEqual([])
  })

  it('mensal cai no dia pedido, limitado ao último dia do mês', () => {
    const e = evento({ tipo: 'mensal', dia_semana: null, dia_mes: 31 })
    expect(ocorrenciasNoMes(e, 2026, 8)).toEqual([31])
    expect(ocorrenciasNoMes(e, 2026, 2)).toEqual([28])
  })

  it('respeita o início da vigência dentro do próprio mês', () => {
    // Começa dia 15/08: só as sextas a partir dali (21 e 28).
    const e = evento({ dia_semana: 5, data_inicio: '2026-08-15' })
    expect(ocorrenciasNoMes(e, 2026, 8)).toEqual([21, 28])
  })

  it('respeita o fim da vigência (RPS encerrado some dos meses novos)', () => {
    const e = evento({ dia_semana: 5, data_fim: '2026-08-14' })
    expect(ocorrenciasNoMes(e, 2026, 8)).toEqual([7, 14])
    expect(ocorrenciasNoMes(e, 2026, 9)).toEqual([])
  })

  it('não é afetado por fuso (data lida como texto, não como Date UTC)', () => {
    const e = evento({ tipo: 'unico', data_inicio: '2026-08-01' })
    expect(ocorrenciasNoMes(e, 2026, 8)).toEqual([1])
  })

  it('semanal sem dia da semana não aparece', () => {
    expect(ocorrenciasNoMes(evento({ dia_semana: null }), 2026, 8)).toEqual([])
  })
})

describe('eventoDaUnidade', () => {
  it('evento da unidade aparece só nela', () => {
    expect(eventoDaUnidade(evento({ unidades: ['CASCAVEL'] }), 'CASCAVEL')).toBe(true)
    expect(eventoDaUnidade(evento({ unidades: ['CASCAVEL'] }), 'FOZ')).toBe(false)
  })

  it('evento com mais de uma unidade aparece em qualquer uma delas, e só nelas', () => {
    expect(eventoDaUnidade(evento({ unidades: ['CASCAVEL', 'FOZ'] }), 'CASCAVEL')).toBe(true)
    expect(eventoDaUnidade(evento({ unidades: ['CASCAVEL', 'FOZ'] }), 'FOZ')).toBe(true)
    expect(eventoDaUnidade(evento({ unidades: ['CASCAVEL', 'FOZ'] }), 'DIADEMA')).toBe(false)
  })

  it("evento de '*' aparece em qualquer unidade", () => {
    expect(eventoDaUnidade(evento({ unidades: [AJUSTE_TODAS_UNIDADES] }), 'FOZ')).toBe(true)
  })
})

describe('agruparEventosPorDia', () => {
  it('junta eventos da unidade e os de todas, ignorando os de outra unidade', () => {
    const eventos = [
      evento({ id: 'rps', unidades: ['CASCAVEL'], dia_semana: 5 }),
      evento({ id: 'global', unidades: [AJUSTE_TODAS_UNIDADES], tipo: 'mensal', dia_semana: null, dia_mes: 7 }),
      evento({ id: 'outra', unidades: ['FOZ'], tipo: 'mensal', dia_semana: null, dia_mes: 7 }),
    ]
    const porDia = agruparEventosPorDia(eventos, [], 'CASCAVEL', 2026, 8)
    expect(porDia.get(7)?.map(o => o.evento.id)).toEqual(['rps', 'global'])
    expect(porDia.get(14)?.map(o => o.evento.id)).toEqual(['rps'])
  })

  it('sem ajuste, diaOriginal é o próprio dia da ocorrência', () => {
    const eventos = [evento({ id: 'rps', unidades: ['CASCAVEL'], dia_semana: 5 })]
    const porDia = agruparEventosPorDia(eventos, [], 'CASCAVEL', 2026, 8)
    expect(porDia.get(7)?.[0].diaOriginal).toBe(7)
  })

  it('aplica o ajuste de dia (arrastar) só na ocorrência ajustada, mantendo as outras no dia normal', () => {
    // Sextas de agosto/2026: 7, 14, 21, 28 — só a do dia 7 foi arrastada pro dia 6.
    const eventos = [evento({ id: 'rps', unidades: ['CASCAVEL'], dia_semana: 5 })]
    const ajustes = [ajusteEvento({ evento_id: 'rps', dia_original: 7, dia_novo: 6 })]
    const porDia = agruparEventosPorDia(eventos, ajustes, 'CASCAVEL', 2026, 8)
    expect(porDia.get(6)?.map(o => o.evento.id)).toEqual(['rps'])
    expect(porDia.get(6)?.[0].diaOriginal).toBe(7) // upsert de um novo arrastar sobrescreve pela chave original, não pelo dia exibido
    expect(porDia.get(7)).toBeUndefined()
    expect(porDia.get(14)?.map(o => o.evento.id)).toEqual(['rps'])
  })

  it('ajuste de outra unidade não afeta quem está vendo', () => {
    const eventos = [evento({ id: 'rps', unidades: ['CASCAVEL'], dia_semana: 5 })]
    const ajustes = [ajusteEvento({ evento_id: 'rps', unidade: 'FOZ', dia_original: 7, dia_novo: 6 })]
    const porDia = agruparEventosPorDia(eventos, ajustes, 'CASCAVEL', 2026, 8)
    expect(porDia.get(7)?.map(o => o.evento.id)).toEqual(['rps'])
    expect(porDia.get(6)).toBeUndefined()
  })

  it("ajuste com unidade '*' vale pra qualquer unidade do evento", () => {
    const eventos = [evento({ id: 'rps', unidades: ['CASCAVEL'], dia_semana: 5 })]
    const ajustes = [ajusteEvento({ evento_id: 'rps', unidade: AJUSTE_TODAS_UNIDADES, dia_original: 7, dia_novo: 6 })]
    const porDia = agruparEventosPorDia(eventos, ajustes, 'CASCAVEL', 2026, 8)
    expect(porDia.get(6)?.map(o => o.evento.id)).toEqual(['rps'])
  })
})

describe('rotuloRecorrencia', () => {
  it('descreve cada tipo em português', () => {
    expect(rotuloRecorrencia(evento({ dia_semana: 5 }))).toBe('Toda sexta')
    expect(rotuloRecorrencia(evento({ dia_semana: 6 }))).toBe('Todo sábado')
    expect(rotuloRecorrencia(evento({ tipo: 'mensal', dia_semana: null, dia_mes: 10 }))).toBe('Todo dia 10')
    expect(rotuloRecorrencia(evento({ tipo: 'unico', data_inicio: '2026-08-19' }))).toBe('19/08/2026')
  })
})
