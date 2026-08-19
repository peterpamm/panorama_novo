import { describe, expect, it } from 'vitest'
import { buscarAjusteFinanceiro, chaveAjusteFinanceiro, mapaAjustesFinanceiro } from './financeiro-dre-ajustes'
import type { FinanceiroDreAjuste } from '@/types'

function ajuste(over: Partial<FinanceiroDreAjuste>): FinanceiroDreAjuste {
  return { unidade: 'DIADEMA', ano: 2026, mes: 6, indicador: 'multas', valor: 5000, observacao: null, ...over }
}

describe('chaveAjusteFinanceiro', () => {
  it('monta a chave composta unidade|ano|mes|indicador', () => {
    expect(chaveAjusteFinanceiro('DIADEMA', 2026, 6, 'multas')).toBe('DIADEMA|2026|6|multas')
  })
})

describe('buscarAjusteFinanceiro', () => {
  it('encontra o ajuste certo entre vários', () => {
    const mapa = mapaAjustesFinanceiro([
      ajuste({}),
      ajuste({ indicador: 'vales', valor: 1200 }),
      ajuste({ unidade: 'CAMACARI', mes: 7 }),
    ])
    expect(buscarAjusteFinanceiro(mapa, 'DIADEMA', 2026, 6, 'multas')?.valor).toBe(5000)
    expect(buscarAjusteFinanceiro(mapa, 'DIADEMA', 2026, 6, 'vales')?.valor).toBe(1200)
  })

  it('unidade/ano/mes/indicador sem ajuste cadastrado devolve undefined — usa o valor automático do DRE', () => {
    const mapa = mapaAjustesFinanceiro([ajuste({})])
    expect(buscarAjusteFinanceiro(mapa, 'DIADEMA', 2026, 7, 'multas')).toBeUndefined()
    expect(buscarAjusteFinanceiro(mapa, 'CAMACARI', 2026, 6, 'multas')).toBeUndefined()
  })
})
