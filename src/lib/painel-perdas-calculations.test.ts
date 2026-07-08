import { describe, expect, it } from 'vitest'
import { calcularMatrizPerdas } from './painel-perdas-calculations'
import type { DreLongoRow, MetaPerdas, PainelPerdasAux } from '@/types'

function rowDre(override: Partial<DreLongoRow>): DreLongoRow {
  return {
    unidade: 'FOZ', negocio: 'CONS', ano: 2025, mes: 1,
    tipo_periodo: 'MENSAL', conta_codigo: '001',
    remunerado: null, realizado: null, diferenca: null, avo: null, avr: null,
    ...override,
  }
}

function rowAux(override: Partial<PainelPerdasAux>): PainelPerdasAux {
  return { unidade: 'FOZ', ano: 2025, mes: 1, indicador: 'indisponibilidade', valor: -100, ...override }
}

describe('calcularMatrizPerdas', () => {
  it('retorna matriz vazia para meses vazio', () => {
    const r = calcularMatrizPerdas([], [], [], 2025, [])
    expect(r.unidades).toEqual([])
    expect(r.linhas).toEqual([])
  })

  it('calcula indicador DRE (Vales = contas 051 e 052)', () => {
    const dre = [
      rowDre({ unidade: 'FOZ', conta_codigo: '051', diferenca: -500 }),
      rowDre({ unidade: 'FOZ', conta_codigo: '052', diferenca: -300 }),
    ]
    const r = calcularMatrizPerdas(dre, [], [], 2025, [1])
    const linhaVales = r.linhas.find(l => l.key === 'vales')!
    expect(linhaVales.valores['FOZ']).toBeCloseTo(-800)
  })

  it('calcula indicador AUX (Indisponibilidade) por unidade', () => {
    const dre = [rowDre({ conta_codigo: '021', diferenca: 0 })]
    const aux = [
      rowAux({ unidade: 'FOZ', indicador: 'indisponibilidade', valor: -200 }),
      rowAux({ unidade: 'RIO', indicador: 'indisponibilidade', valor: -150, mes: 1 }),
    ]
    const r = calcularMatrizPerdas(dre, aux, [], 2025, [1])
    const linhaIndisp = r.linhas.find(l => l.key === 'indisponibilidade')!
    expect(linhaIndisp.valores['FOZ']).toBeCloseTo(-200)
  })

  it('AMBEV AUX soma todas as unidades (sem filtro de unidade)', () => {
    const dre = [
      rowDre({ unidade: 'FOZ',   conta_codigo: '021', diferenca: 0 }),
      rowDre({ unidade: 'AMBEV', conta_codigo: '021', diferenca: 0 }),
    ]
    const aux = [
      rowAux({ unidade: 'FOZ',    indicador: 'devolucao', valor: -100 }),
      rowAux({ unidade: 'DIADEMA', indicador: 'devolucao', valor: -80 }),
    ]
    const r = calcularMatrizPerdas(dre, aux, [], 2025, [1])
    const linhaDev = r.linhas.find(l => l.key === 'devolucao')!
    expect(linhaDev.valores['AMBEV']).toBeCloseTo(-180)
  })

  it('TOTAL soma todos os indicadores por unidade', () => {
    const dre = [
      rowDre({ conta_codigo: '051', diferenca: -400 }),
      rowDre({ conta_codigo: '137', diferenca: -100 }),
    ]
    const r = calcularMatrizPerdas(dre, [], [], 2025, [1])
    const linhaTotal = r.linhas.find(l => l.tipo === 'total')!
    expect(linhaTotal.valores['FOZ']).toBeCloseTo(-500)
  })

  it('FATURAMENTO usa ACUMULADO_ANO, conta 001, remunerado abs do último mes', () => {
    const dre = [
      rowDre({ conta_codigo: '021', diferenca: 0 }),
      rowDre({ tipo_periodo: 'ACUMULADO_ANO', conta_codigo: '001', mes: 1, remunerado: -50000 }),
    ]
    const r = calcularMatrizPerdas(dre, [], [], 2025, [1])
    const linhaFat = r.linhas.find(l => l.tipo === 'faturamento')!
    expect(linhaFat.valores['FOZ']).toBeCloseTo(50000)
  })

  it('PERDAS % = TOTAL / FATURAMENTO', () => {
    const dre = [
      rowDre({ conta_codigo: '051', diferenca: -1000 }),
      rowDre({ tipo_periodo: 'ACUMULADO_ANO', conta_codigo: '001', mes: 1, remunerado: -100000 }),
    ]
    const r = calcularMatrizPerdas(dre, [], [], 2025, [1])
    const linhaP = r.linhas.find(l => l.tipo === 'perdas_pct')!
    expect(linhaP.valores['FOZ']).toBeCloseTo(-0.01) // -1000 / 100000
  })

  it('META (R$) = meta_anual / 12 * num_meses', () => {
    const dre = [rowDre({ conta_codigo: '021', diferenca: 0 })]
    const meta: MetaPerdas = { unidade: 'FOZ', ano: 2025, meta_pct: -2.0, meta_anual: -12000 }
    const r = calcularMatrizPerdas(dre, [], [meta], 2025, [1, 2, 3])
    const linhaMetaRs = r.linhas.find(l => l.tipo === 'meta_rs')!
    expect(linhaMetaRs.valores['FOZ']).toBeCloseTo(-3000) // -12000/12 * 3
  })

  it('AMBEV fica último na lista de unidades', () => {
    const dre = [
      rowDre({ unidade: 'FOZ', conta_codigo: '021', diferenca: 0 }),
      rowDre({ unidade: 'AMBEV', conta_codigo: '021', diferenca: 0 }),
    ]
    const r = calcularMatrizPerdas(dre, [], [], 2025, [1])
    expect(r.unidades[r.unidades.length - 1]).toBe('AMBEV')
  })
})
