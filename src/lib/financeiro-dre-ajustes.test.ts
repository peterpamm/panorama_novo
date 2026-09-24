import { describe, expect, it } from 'vitest'
import { aplicarAjusteFinanceiro, buscarAjusteFinanceiro, chaveAjusteFinanceiro, mapaAjustesFinanceiro } from './financeiro-dre-ajustes'
import type { LinhaIndicador } from '@/components/rv/TabelaIndicadorGenerica'
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

describe('aplicarAjusteFinanceiro', () => {
  const celulaAutomatica = { texto: '-500', tooltip: 'Meta: dispersão ≥ 0 (sem estouro)', bateu: false }

  function linha(key: string, meses: (typeof celulaAutomatica | null)[]): LinhaIndicador {
    return { key, nome: key, meses }
  }

  it('substitui só a célula do mês/indicador ajustado, mantendo o resto igual (formato/bateu recalculado pelo valor do ajuste)', () => {
    const linhas = [linha('DIADEMA', [celulaAutomatica, celulaAutomatica])] // Jan, Fev
    const resultado = aplicarAjusteFinanceiro(
      linhas, [ajuste({ mes: 1, valor: 1234.5 })], 2026, 'multas', v => v.toFixed(0),
    )
    expect(resultado[0].meses[0]).toEqual({
      texto: '1235', // Math.round via toFixed(0) do formatador passado
      tooltip: 'Ajuste manual (bug do DRE) · dispersão ≥ 0 = meta batida',
      bateu: true,
    })
    expect(resultado[0].meses[1]).toBe(celulaAutomatica) // mês sem ajuste não muda
  })

  it('usa só o pedaço antes do "|" da key (linhas de indicador DRE vêm como unidade|negocio, ajuste é só por unidade)', () => {
    const linhas = [linha('CAMACARI|ROTA', [celulaAutomatica])]
    const resultado = aplicarAjusteFinanceiro(
      linhas, [ajuste({ unidade: 'CAMACARI', mes: 1, valor: -300 })], 2026, 'multas', v => v.toFixed(0),
    )
    expect(resultado[0].meses[0]?.bateu).toBe(false) // -300 < 0, não bateu
  })

  it('sem ajustes ou sem ano selecionado, devolve as linhas originais sem tocar (mesma referência)', () => {
    const linhas = [linha('DIADEMA', [celulaAutomatica])]
    expect(aplicarAjusteFinanceiro(linhas, [], 2026, 'multas', String)).toBe(linhas)
    expect(aplicarAjusteFinanceiro(linhas, [ajuste({})], null, 'multas', String)).toBe(linhas)
  })

  it('indicador errado (vales vs multas) não aplica — cada indicador só enxerga o próprio ajuste', () => {
    const linhas = [linha('DIADEMA', [celulaAutomatica])]
    const resultado = aplicarAjusteFinanceiro(linhas, [ajuste({ mes: 1, indicador: 'vales' })], 2026, 'multas', String)
    expect(resultado[0].meses[0]).toBe(celulaAutomatica)
  })
})
