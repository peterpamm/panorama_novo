import { describe, expect, it } from 'vitest'
import type { ParsedDreRow } from '@/lib/dre-xlsx-parser'
import { detectarAlteracoes, mesesParaComparar } from './dre-diff-detector'

describe('mesesParaComparar', () => {
  it('remove o bloco total, mas mantém todos os meses (inclusive o último)', () => {
    expect(mesesParaComparar(['jan', 'fev', 'mar', 'total'])).toEqual(['jan', 'fev', 'mar'])
  })

  it('mantém o único mês quando só há 1 no arquivo', () => {
    expect(mesesParaComparar(['jan', 'total'])).toEqual(['jan'])
  })
})

describe('detectarAlteracoes', () => {
  const linhasNovas: ParsedDreRow[] = [
    { conta_codigo: '021', campos: { jan_realizado: -974827.03, jan_remunerado: -975993.99, fev_realizado: -979000, mar_realizado: -1000 } },
  ]

  it('não detecta nada quando os valores são iguais', () => {
    const existentes = new Map([['021', { jan_realizado: -974827.03, jan_remunerado: -975993.99 }]])
    expect(detectarAlteracoes(linhasNovas, existentes, ['jan'])).toEqual([])
  })

  it('detecta quando o valor de um mês antigo mudou', () => {
    const existentes = new Map([['021', { jan_realizado: -970000, jan_remunerado: -975993.99 }]])
    const alteracoes = detectarAlteracoes(linhasNovas, existentes, ['jan'])
    expect(alteracoes).toEqual([{ conta_codigo: '021', campo: 'jan_realizado', valorAntigo: -970000, valorNovo: -974827.03 }])
  })

  it('ignora diferença de arredondamento menor que 0,01', () => {
    const existentes = new Map([['021', { jan_realizado: -974827.029999 }]])
    expect(detectarAlteracoes(linhasNovas, existentes, ['jan'])).toEqual([])
  })

  it('ignora meses não incluídos na lista de comparação', () => {
    const existentes = new Map([['021', { mar_realizado: -1 }]])
    expect(detectarAlteracoes(linhasNovas, existentes, ['jan', 'fev'])).toEqual([])
  })

  it('detecta alteração mesmo no último mês do arquivo, se ele já existia no banco (reimportação/correção do mesmo período)', () => {
    const existentes = new Map([['021', { mar_realizado: -1 }]])
    const alteracoes = detectarAlteracoes(linhasNovas, existentes, ['jan', 'fev', 'mar'])
    expect(alteracoes).toEqual([{ conta_codigo: '021', campo: 'mar_realizado', valorAntigo: -1, valorNovo: -1000 }])
  })

  it('não detecta nada num mês novo (ainda sem dado no banco), mesmo passando ele na lista de comparação', () => {
    const existentes = new Map([['021', { jan_realizado: -974827.03 }]]) // sem mar_realizado: mês novo
    expect(detectarAlteracoes(linhasNovas, existentes, ['jan', 'fev', 'mar'])).toEqual([
      // só o jan é igual (sem alteração); fev/mar não existem ainda no banco, então são ignorados sozinhos
    ])
  })

  it('ignora conta nova sem linha existente pra comparar', () => {
    expect(detectarAlteracoes(linhasNovas, new Map(), ['jan'])).toEqual([])
  })

  it('ignora campo ausente do lado existente (ex: importação anterior sem AVO)', () => {
    const existentes = new Map([['021', { jan_remunerado: -975993.99 }]]) // sem jan_realizado
    expect(detectarAlteracoes(linhasNovas, existentes, ['jan'])).toEqual([])
  })
})
