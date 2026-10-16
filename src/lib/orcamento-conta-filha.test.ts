import { describe, expect, it } from 'vitest'
import type { OrcamentoLinha } from '@/types'
import { buscarOrcadoContaFilha } from './orcamento-conta-filha'

function linha(overrides: Partial<OrcamentoLinha>): OrcamentoLinha {
  return {
    unidade: 'FOZ', negocio: 'ROTA', ano: 2025, mes: 1, conta_codigo: '021',
    conta_nome: '', orcado: 0, av: 0, ah: 0, ...overrides,
  }
}

describe('buscarOrcadoContaFilha', () => {
  it('unidade antiga (esquema bespoke): traduz a conta-filha nativa pra bespoke via CONTA_FILHA_ORCAMENTO_BESPOKE', () => {
    // 200 (Bens de Pequeno Valor, nativo) -> 105 (bespoke) — exemplo conferido pelo usuário.
    const orcamentos = [linha({ conta_codigo: '105', orcado: -4200, mes: 3, ano: 2025 })]
    const orcado = buscarOrcadoContaFilha(orcamentos, { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, mes: 3 }, '200')
    expect(orcado).toBeCloseTo(4200) // custo: sinal invertido
  })

  it('unidade antiga: conta sem entrada em CONTA_FILHA_ORCAMENTO_BESPOKE (formato antigo nunca detalhou) retorna null', () => {
    // 179 (Assistência Médica e Social) não existe separada na planilha bespoke.
    const orcamentos = [linha({ conta_codigo: '179', orcado: -100, mes: 1, ano: 2025 })]
    const orcado = buscarOrcadoContaFilha(orcamentos, { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, mes: 1 }, '179')
    expect(orcado).toBeNull()
  })

  it('unidade nova (numeração nativa do DRE): busca direto pelo código nativo, sem tradução', () => {
    const orcamentos = [
      linha({ unidade: 'ARA', conta_codigo: '283', orcado: 0, mes: 1, ano: 2026 }), // marca numeração nativa
      linha({ unidade: 'ARA', conta_codigo: '200', orcado: -8000, mes: 1, ano: 2026 }),
    ]
    const orcado = buscarOrcadoContaFilha(orcamentos, { unidade: 'ARA', negocio: 'ROTA', ano: 2026, mes: 1 }, '200')
    expect(orcado).toBeCloseTo(8000)
  })

  it('unidade nova: conta sem linha importada nesse período retorna null (mesmo sendo numeração nativa)', () => {
    const orcamentos = [linha({ unidade: 'ARA', conta_codigo: '283', orcado: 0, mes: 1, ano: 2026 })]
    const orcado = buscarOrcadoContaFilha(orcamentos, { unidade: 'ARA', negocio: 'ROTA', ano: 2026, mes: 1 }, '200')
    expect(orcado).toBeNull()
  })

  it('unidade nova, aba TT deslocada: aplica o mesmo shift +1 já usado pro nível pacote', () => {
    // 200 nativo -> 105 bespoke -> 106 deslocado (105 está na faixa 22-155).
    const orcamentos = [
      linha({ unidade: 'ARA', negocio: 'CONS', conta_codigo: '156', orcado: 0, mes: 8, ano: 2026 }), // marca TT deslocado
      linha({ unidade: 'ARA', negocio: 'CONS', conta_codigo: '106', orcado: -9000, mes: 8, ano: 2026 }),
    ]
    const orcado = buscarOrcadoContaFilha(orcamentos, { unidade: 'ARA', negocio: 'CONS', ano: 2026, mes: 8 }, '200')
    expect(orcado).toBeCloseTo(9000)
  })

  it('sem linha correspondente nenhuma retorna null', () => {
    const orcado = buscarOrcadoContaFilha([], { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, mes: 1 }, '200')
    expect(orcado).toBeNull()
  })
})
