import { describe, expect, it } from 'vitest'
import { calcularMatrizPerdas } from './painel-perdas-calculations'
import type { DreLongoRow, MetaPerdaIndicador, PainelPerdasAux } from '@/types'

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

  it('calcula indicador DRE (Vales = contas 052 e 053)', () => {
    const dre = [
      rowDre({ unidade: 'FOZ', conta_codigo: '052', diferenca: -500 }),
      rowDre({ unidade: 'FOZ', conta_codigo: '053', diferenca: -300 }),
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
      rowDre({ conta_codigo: '052', diferenca: -400 }),
      rowDre({ conta_codigo: '138', diferenca: -100 }),
    ]
    const r = calcularMatrizPerdas(dre, [], [], 2025, [1])
    const linhaTotal = r.linhas.find(l => l.tipo === 'total')!
    expect(linhaTotal.valores['FOZ']).toBeCloseTo(-500)
  })

  it('FATURAMENTO usa MENSAL, conta 001, soma do remunerado abs dos meses selecionados', () => {
    const dre = [
      rowDre({ conta_codigo: '021', diferenca: 0 }),
      rowDre({ conta_codigo: '001', mes: 1, remunerado: -50000 }),
    ]
    const r = calcularMatrizPerdas(dre, [], [], 2025, [1])
    const linhaFat = r.linhas.find(l => l.tipo === 'faturamento')!
    expect(linhaFat.valores['FOZ']).toBeCloseTo(50000)
  })

  it('FATURAMENTO soma só os meses selecionados no filtro, não o ano inteiro', () => {
    const dre = [
      rowDre({ conta_codigo: '001', mes: 1, remunerado: -50000 }),
      rowDre({ conta_codigo: '001', mes: 2, remunerado: -60000 }),
      rowDre({ conta_codigo: '001', mes: 3, remunerado: -70000 }),
    ]
    const r = calcularMatrizPerdas(dre, [], [], 2025, [2])
    const linhaFat = r.linhas.find(l => l.tipo === 'faturamento')!
    expect(linhaFat.valores['FOZ']).toBeCloseTo(60000)
  })

  it('PERDAS % = TOTAL / FATURAMENTO (mesmo recorte de meses nos dois)', () => {
    const dre = [
      rowDre({ conta_codigo: '052', diferenca: -1000 }),
      rowDre({ conta_codigo: '001', mes: 1, remunerado: -100000 }),
    ]
    const r = calcularMatrizPerdas(dre, [], [], 2025, [1])
    const linhaP = r.linhas.find(l => l.tipo === 'perdas_pct')!
    expect(linhaP.valores['FOZ']).toBeCloseTo(-0.01) // -1000 / 100000
  })

  it('META (R$) = soma dos indicadores (meta_anual) / 12 * num_meses', () => {
    const dre = [rowDre({ conta_codigo: '021', diferenca: 0 })]
    const metas: MetaPerdaIndicador[] = [
      { unidade: 'FOZ', ano: 2025, indicador: 'vales', meta_anual: -8000 },
      { unidade: 'FOZ', ano: 2025, indicador: 'multas', meta_anual: -4000 },
    ]
    const r = calcularMatrizPerdas(dre, [], metas, 2025, [1, 2, 3])
    const linhaMetaRs = r.linhas.find(l => l.tipo === 'meta_rs')!
    expect(linhaMetaRs.valores['FOZ']).toBeCloseTo(-3000) // (-8000-4000)/12 * 3
  })

  it('META (%) = META (R$) / FATURAMENTO', () => {
    const dre = [
      rowDre({ conta_codigo: '021', diferenca: 0 }),
      rowDre({ conta_codigo: '001', mes: 1, remunerado: -120000 }),
    ]
    const metas: MetaPerdaIndicador[] = [
      { unidade: 'FOZ', ano: 2025, indicador: 'vales', meta_anual: -12000 },
    ]
    const r = calcularMatrizPerdas(dre, [], metas, 2025, [1])
    const linhaMetaPct = r.linhas.find(l => l.tipo === 'meta_pct')!
    expect(linhaMetaPct.valores['FOZ']).toBeCloseTo(-1000 / 120000) // metaRs = -12000/12*1
  })

  it('META (R$) do AMBEV soma as unidades individuais (sem linha própria na planilha)', () => {
    const dre = [
      rowDre({ unidade: 'FOZ', conta_codigo: '021', diferenca: 0 }),
      rowDre({ unidade: 'RIO', conta_codigo: '021', diferenca: 0 }),
    ]
    const metas: MetaPerdaIndicador[] = [
      { unidade: 'FOZ', ano: 2025, indicador: 'vales', meta_anual: -12000 },
      { unidade: 'RIO', ano: 2025, indicador: 'vales', meta_anual: -6000 },
    ]
    const r = calcularMatrizPerdas(dre, [], metas, 2025, [1, 2, 3])
    const linhaMetaRs = r.linhas.find(l => l.tipo === 'meta_rs')!
    expect(linhaMetaRs.valores['AMBEV']).toBeCloseTo(-4500) // (-12000-6000)/12 * 3
  })

  it('AMBEV fica último na lista de unidades', () => {
    const dre = [
      rowDre({ unidade: 'FOZ', conta_codigo: '021', diferenca: 0 }),
      rowDre({ unidade: 'AMBEV', conta_codigo: '021', diferenca: 0 }),
    ]
    const r = calcularMatrizPerdas(dre, [], [], 2025, [1])
    expect(r.unidades[r.unidades.length - 1]).toBe('AMBEV')
  })

  it('META (R$) divide pelos meses ativos da unidade (data_entrada), não sempre por 12', () => {
    const dre = [rowDre({ unidade: 'ARA', conta_codigo: '021', diferenca: 0, ano: 2026, mes: 6 })]
    const metas: MetaPerdaIndicador[] = [
      { unidade: 'ARA', ano: 2026, indicador: 'vales', meta_anual: -8000 },
    ]
    // Aracaju entrou em maio/2026 -> 8 meses ativos
    const dataEntradaPorUnidade = new Map([['ARA', '2026-05-01']])
    const r = calcularMatrizPerdas(dre, [], metas, 2026, [6], dataEntradaPorUnidade)
    const linhaMetaRs = r.linhas.find(l => l.tipo === 'meta_rs')!
    expect(linhaMetaRs.valores['ARA']).toBeCloseTo(-1000) // -8000/8 * 1 mês selecionado
  })

  it('META (R$) do AMBEV: cada unidade usa seu próprio divisor de meses ativos, não um só pra todas', () => {
    const dre = [
      rowDre({ unidade: 'FOZ', conta_codigo: '021', diferenca: 0, ano: 2026, mes: 6 }), // unidade antiga, 12 meses
      rowDre({ unidade: 'ARA', conta_codigo: '021', diferenca: 0, ano: 2026, mes: 6 }), // entrou em maio, 8 meses
    ]
    const metas: MetaPerdaIndicador[] = [
      { unidade: 'FOZ', ano: 2026, indicador: 'vales', meta_anual: -12000 }, // -1000/mês
      { unidade: 'ARA', ano: 2026, indicador: 'vales', meta_anual: -8000 },  // -1000/mês (8 meses, não 12)
    ]
    const dataEntradaPorUnidade = new Map([['ARA', '2026-05-01']])
    const r = calcularMatrizPerdas(dre, [], metas, 2026, [6], dataEntradaPorUnidade)
    const linhaMetaRs = r.linhas.find(l => l.tipo === 'meta_rs')!
    expect(linhaMetaRs.valores['AMBEV']).toBeCloseTo(-2000) // -1000 (FOZ) + -1000 (ARA), 1 mês
  })

  it('sem dataEntradaPorUnidade (omitido), comportamento idêntico a antes: sempre /12', () => {
    const dre = [rowDre({ unidade: 'ARA', conta_codigo: '021', diferenca: 0, ano: 2026, mes: 1 })]
    const metas: MetaPerdaIndicador[] = [
      { unidade: 'ARA', ano: 2026, indicador: 'vales', meta_anual: -12000 },
    ]
    const r = calcularMatrizPerdas(dre, [], metas, 2026, [1])
    const linhaMetaRs = r.linhas.find(l => l.tipo === 'meta_rs')!
    expect(linhaMetaRs.valores['ARA']).toBeCloseTo(-1000) // -12000/12 * 1
  })
})
