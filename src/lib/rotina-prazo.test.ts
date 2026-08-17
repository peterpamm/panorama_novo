import { describe, expect, it } from 'vitest'
import { agruparRotinasPorDia, gradeDoMes, interpretarPrazoTexto, resolverDiaDoMes, rotuloPrazoEstruturado } from './rotina-prazo'
import type { RotinaFinanceira } from '@/types'

describe('interpretarPrazoTexto', () => {
  it('lê dia fixo em várias escritas', () => {
    expect(interpretarPrazoTexto('Dia 10')).toEqual({ tipo: 'dia_fixo', dia: 10 })
    expect(interpretarPrazoTexto('dia 5')).toEqual({ tipo: 'dia_fixo', dia: 5 })
    expect(interpretarPrazoTexto('Até o dia 15')).toEqual({ tipo: 'dia_fixo', dia: 15 })
    expect(interpretarPrazoTexto('todo dia 20')).toEqual({ tipo: 'dia_fixo', dia: 20 })
    expect(interpretarPrazoTexto('10')).toEqual({ tipo: 'dia_fixo', dia: 10 })
  })

  it('lê n-ésimo dia útil, com ou sem acento/ordinal', () => {
    expect(interpretarPrazoTexto('4º dia útil')).toEqual({ tipo: 'dia_util', dia: 4 })
    expect(interpretarPrazoTexto('4 dia util')).toEqual({ tipo: 'dia_util', dia: 4 })
    expect(interpretarPrazoTexto('2o DIA ÚTIL')).toEqual({ tipo: 'dia_util', dia: 2 })
  })

  it('prazo que depende de outro evento fica sem data, não chuta dia', () => {
    expect(interpretarPrazoTexto('1 dia após envio da matriz')).toEqual({ tipo: 'sem_data', dia: null })
    expect(interpretarPrazoTexto('Após o fechamento')).toEqual({ tipo: 'sem_data', dia: null })
    expect(interpretarPrazoTexto('Conforme demanda')).toEqual({ tipo: 'sem_data', dia: null })
  })

  it('texto vazio ou sem número fica sem data', () => {
    expect(interpretarPrazoTexto('')).toEqual({ tipo: 'sem_data', dia: null })
    expect(interpretarPrazoTexto('   ')).toEqual({ tipo: 'sem_data', dia: null })
    expect(interpretarPrazoTexto('Semanal')).toEqual({ tipo: 'sem_data', dia: null })
  })
})

describe('resolverDiaDoMes', () => {
  it('dia fixo cai no próprio dia', () => {
    expect(resolverDiaDoMes({ tipo: 'dia_fixo', dia: 10 }, 2026, 8)).toBe(10)
  })

  it('dia fixo maior que o mês cai no último dia (dia 31 = fim do mês)', () => {
    expect(resolverDiaDoMes({ tipo: 'dia_fixo', dia: 31 }, 2026, 2)).toBe(28) // fev/2026
    expect(resolverDiaDoMes({ tipo: 'dia_fixo', dia: 31 }, 2026, 4)).toBe(30)
    expect(resolverDiaDoMes({ tipo: 'dia_fixo', dia: 31 }, 2024, 2)).toBe(29) // ano bissexto
  })

  it('dia fixo em fim de semana NÃO é empurrado (o ajuste é arrastar no calendário)', () => {
    // 2026-08-09 é domingo.
    expect(resolverDiaDoMes({ tipo: 'dia_fixo', dia: 9 }, 2026, 8)).toBe(9)
  })

  it('conta dia útil pulando sábado e domingo', () => {
    // Agosto/2026 começa num sábado: 1(sáb) 2(dom) 3(seg) 4(ter) 5(qua) 6(qui)...
    expect(resolverDiaDoMes({ tipo: 'dia_util', dia: 1 }, 2026, 8)).toBe(3)
    expect(resolverDiaDoMes({ tipo: 'dia_util', dia: 4 }, 2026, 8)).toBe(6)
  })

  it('dia útil além do total do mês cai no último dia útil', () => {
    expect(resolverDiaDoMes({ tipo: 'dia_util', dia: 30 }, 2026, 8)).toBe(31) // 31/08/2026 é segunda
  })

  it('sem data não tem dia', () => {
    expect(resolverDiaDoMes({ tipo: 'sem_data', dia: null }, 2026, 8)).toBeNull()
    expect(resolverDiaDoMes({ tipo: 'dia_fixo', dia: null }, 2026, 8)).toBeNull()
  })
})

describe('gradeDoMes', () => {
  it('monta semanas de 7 dias, começando no domingo', () => {
    // Agosto/2026 começa num sábado.
    const semanas = gradeDoMes(2026, 8)
    expect(semanas.every(s => s.length === 7)).toBe(true)
    expect(semanas[0].map(c => c.dia)).toEqual([null, null, null, null, null, null, 1])
  })

  it('marca sábado e domingo como fim de semana', () => {
    const semanas = gradeDoMes(2026, 8)
    const dia1 = semanas.flat().find(c => c.dia === 1)
    const dia3 = semanas.flat().find(c => c.dia === 3)
    expect(dia1?.fimDeSemana).toBe(true)  // sábado
    expect(dia3?.fimDeSemana).toBe(false) // segunda
  })

  it('cobre todos os dias do mês e fecha a grade em semanas inteiras', () => {
    for (const [ano, mes, totalDias] of [[2026, 2, 28], [2026, 8, 31], [2024, 2, 29]] as const) {
      const celulas = gradeDoMes(ano, mes).flat()
      expect(celulas.filter(c => c.dia !== null)).toHaveLength(totalDias)
      expect(celulas.length % 7).toBe(0)
      // Fev/2026 começa num domingo e tem 28 dias: fecha em 4 semanas exatas, sem célula vazia.
      expect(celulas.map(c => c.dia).filter(d => d !== null)).toEqual(
        Array.from({ length: totalDias }, (_, i) => i + 1),
      )
    }
  })
})

describe('agruparRotinasPorDia', () => {
  function rotina(nome: string, prazo_tipo: RotinaFinanceira['prazo_tipo'], prazo_dia: number | null): RotinaFinanceira {
    return { id: nome, setor: 'OCs', nome, prazo: '', prazo_tipo, prazo_dia, ordem: 0, ativo: true }
  }

  it('agrupa pelo dia resolvido e junta as que caem no mesmo dia', () => {
    const { porDia } = agruparRotinasPorDia([
      rotina('a', 'dia_fixo', 10),
      rotina('b', 'dia_fixo', 10),
      rotina('c', 'dia_fixo', 20),
    ], 2026, 8)
    expect(porDia.get(10)?.map(r => r.nome)).toEqual(['a', 'b'])
    expect(porDia.get(20)?.map(r => r.nome)).toEqual(['c'])
  })

  it('rotina sem data sai na lista separada, não some', () => {
    const { porDia, semData } = agruparRotinasPorDia([rotina('x', 'sem_data', null)], 2026, 8)
    expect(porDia.size).toBe(0)
    expect(semData.map(r => r.nome)).toEqual(['x'])
  })

  it('dia útil cai no dia certo do mês pedido', () => {
    // Agosto/2026: 1(sáb) 2(dom) 3(seg) — o 1º dia útil é 3.
    const { porDia } = agruparRotinasPorDia([rotina('a', 'dia_util', 1)], 2026, 8)
    expect(porDia.get(3)?.map(r => r.nome)).toEqual(['a'])
  })
})

describe('rotuloPrazoEstruturado', () => {
  it('descreve cada tipo', () => {
    expect(rotuloPrazoEstruturado({ tipo: 'dia_fixo', dia: 10 })).toBe('Dia 10')
    expect(rotuloPrazoEstruturado({ tipo: 'dia_util', dia: 4 })).toBe('4º dia útil')
    expect(rotuloPrazoEstruturado({ tipo: 'sem_data', dia: null })).toBe('Sem data')
  })
})
