import { describe, expect, it } from 'vitest'
import type { OrcamentoLinha } from '@/types'
import { buscarMetaOrcamento } from './orcamento-farol'

function linha(overrides: Partial<OrcamentoLinha>): OrcamentoLinha {
  return {
    unidade: 'FOZ', negocio: 'ROTA', ano: 2025, mes: 1, conta_codigo: '021',
    conta_nome: '', orcado: 0, av: 0, ah: 0, ...overrides,
  }
}

describe('buscarMetaOrcamento', () => {
  it('unidade antiga (esquema bespoke): traduz o código novo pro antigo pra indexar PACOTE_CONTA_ORCAMENTO (ano ≤ 2026)', () => {
    // EBITDA = pacote novo '233' -> traduzido pra '232' -> PACOTE_CONTA_ORCAMENTO['232'] = ['133']
    const orcamentos = [linha({ conta_codigo: '133', av: 15, mes: 1, ano: 2025 })]
    const meta = buscarMetaOrcamento(orcamentos, { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '233', mes: 1 })
    expect(meta).toBeCloseTo(15)
  })

  it('unidade antiga: sem tradução, ano ≥ 2027 já usa o código novo direto (mas ainda no esquema bespoke — não native)', () => {
    // Sem nenhuma linha ≥ 200 pra essa unidade/ano, então cai no ramo bespoke;
    // ano > ULTIMO_ANO_ORCAMENTO_ESTRUTURA_ANTIGA não traduz — busca direto por '233'.
    const orcamentos = [linha({ conta_codigo: '233', av: 20, mes: 1, ano: 2027 })]
    const meta = buscarMetaOrcamento(orcamentos, { unidade: 'FOZ', negocio: 'ROTA', ano: 2027, codigo: '233', mes: 1 })
    expect(meta).toBeCloseTo(20)
  })

  it('unidade nova (numeração nativa do DRE): soma direto pelos prefixos de PACOTES, sem tradução nem PACOTE_CONTA_ORCAMENTO', () => {
    const orcamentos = [
      // linha ≥ 200 marca essa unidade/negócio/ano como numeração nativa
      linha({ unidade: 'ARA', conta_codigo: '283', av: 0, mes: 1, ano: 2026 }),
      linha({ unidade: 'ARA', conta_codigo: '233', av: 8.07, mes: 1, ano: 2026 }),
    ]
    const meta = buscarMetaOrcamento(orcamentos, { unidade: 'ARA', negocio: 'ROTA', ano: 2026, codigo: '233', mes: 1 })
    expect(meta).toBeCloseTo(8.07)
  })

  it('unidade nova: pacote de custo (021) soma direto, sem cair no esquema bespoke mesmo com código baixo', () => {
    const orcamentos = [
      linha({ unidade: 'ARA', conta_codigo: '283', av: 0, mes: 1, ano: 2026 }),
      linha({ unidade: 'ARA', conta_codigo: '021', av: -78.13, mes: 1, ano: 2026 }),
    ]
    const meta = buscarMetaOrcamento(orcamentos, { unidade: 'ARA', negocio: 'ROTA', ano: 2026, codigo: '021', mes: 1 })
    // custo: sinal invertido (ajustarSinal) -> positivo
    expect(meta).toBeCloseTo(78.13)
  })

  it('unidade antiga (sem linha ≥ 200) nunca cai no ramo de numeração nativa, mesmo com código baixo coincidente', () => {
    // Sem nenhuma linha ≥ 200 pra FOZ/2025 -> ramo bespoke. Código '021' bespoke
    // não é mapeado em PACOTE_CONTA_ORCAMENTO (só '012'), então dá null mesmo
    // havendo uma linha '021' nessa planilha (evita falso positivo).
    const orcamentos = [linha({ unidade: 'FOZ', conta_codigo: '021', av: 999, mes: 1, ano: 2025 })]
    const meta = buscarMetaOrcamento(orcamentos, { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', mes: 1 })
    expect(meta).toBeNull()
  })

  it('sem linha correspondente e sem mapeamento retorna null', () => {
    const meta = buscarMetaOrcamento([], { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '900', mes: 1 })
    expect(meta).toBeNull()
  })

  it("id sintético '900' (Gastos Totais, nunca existiu no plano de contas) não é deslocado pela tradução pré-cutover", () => {
    // Regressão: paraCodigoPreCutover não pode tratar '900' como conta real
    // e devolver '899' — PACOTE_CONTA_ORCAMENTO['900'] tem que continuar
    // sendo encontrado igual (ano ≤ 2026, unidade antiga).
    const orcamentos = [linha({ conta_codigo: '012', av: -71.4, mes: 1, ano: 2025 })]
    const meta = buscarMetaOrcamento(orcamentos, { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '900', mes: 1 })
    expect(meta).toBeCloseTo(71.4) // custo: sinal invertido
  })

  it('unidade nova, aba TT (consolidado): esquema bespoke deslocado (+1 a partir da conta 022, "GASTOS COM SALÁRIOS" inserida nessa numeração própria também) — EBITDA (133 vira 134)', () => {
    // Caso real: Aracaju CONS, EBITDA (133 no esquema bespoke antigo) ->
    // conferido contra o arquivo real, virou 134 nessa aba TT específica.
    const orcamentos = [
      // linha > 155 marca esse unidade/negócio/ano como TT deslocado (o
      // esquema bespoke antigo nunca passa de 155 contas)
      linha({ unidade: 'ARA', negocio: 'CONS', conta_codigo: '156', av: 0, mes: 8, ano: 2026 }),
      linha({ unidade: 'ARA', negocio: 'CONS', conta_codigo: '134', av: 12.76, mes: 8, ano: 2026 }),
    ]
    const meta = buscarMetaOrcamento(orcamentos, { unidade: 'ARA', negocio: 'CONS', ano: 2026, codigo: '233', mes: 8 })
    expect(meta).toBeCloseTo(12.76)
  })

  it('unidade nova, aba TT: sem a linha > 155 (esquema não deslocado pra esse unidade/negócio/ano), busca pelo código bespoke original — evita falso positivo entre unidades', () => {
    const orcamentos = [linha({ unidade: 'ARA', negocio: 'CONS', conta_codigo: '133', av: 30, mes: 1, ano: 2026 })]
    const meta = buscarMetaOrcamento(orcamentos, { unidade: 'ARA', negocio: 'CONS', ano: 2026, codigo: '233', mes: 1 })
    expect(meta).toBeCloseTo(30)
  })
})
