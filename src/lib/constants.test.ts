import { describe, expect, it } from 'vitest'
import { CONTAS_ORCAMENTO_USADAS } from './constants'

describe('CONTAS_ORCAMENTO_USADAS', () => {
  it('inclui código > 155 (marcador do esquema TT deslocado das unidades novas — usaOrcamentoTtDeslocado)', () => {
    expect(CONTAS_ORCAMENTO_USADAS.some((c) => Number(c) > 155)).toBe(true)
  })

  it('inclui código ≥ 200 (marcador da numeração nativa do DRE das unidades novas — usaNumeracaoDreNativa)', () => {
    expect(CONTAS_ORCAMENTO_USADAS.some((c) => Number(c) >= 200)).toBe(true)
  })

  it('o alvo deslocado (156, Geração de Caixa da aba TT das unidades novas) está na lista', () => {
    // PACOTE_CONTA_ORCAMENTO['275'] = ['155'] -> deslocado +1 = '156'
    expect(CONTAS_ORCAMENTO_USADAS).toContain('156')
  })
})
