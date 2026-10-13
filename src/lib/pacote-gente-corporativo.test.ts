import { describe, expect, it } from 'vitest'
import type { DreLongoRow, OrcamentoLinha, Unidade } from '@/types'
import {
  baseDe, calcularComparativoPorUnidade, desvioDe, desvioPercentDe, percentualDeReceita, somarLinhas,
} from './pacote-gente-corporativo'

function linha(
  unidade: string,
  conta_codigo: string,
  mes: number,
  remunerado: number,
  realizado: number,
  diferenca = 0,
): DreLongoRow {
  return {
    // ano 2026 (não 2025) de propósito: `normalizarParaCalculo` traduz
    // códigos >= 035 pra numeração nova só pra ano <= 2025 (DRE realizado
    // antigo) — com 2025 aqui, códigos como '052'/'053'/'159' seriam
    // deslocados +1 e os testes passariam a comparar o código errado.
    unidade, negocio: 'CONS', ano: 2026, mes, tipo_periodo: 'MENSAL', conta_codigo,
    remunerado, realizado, diferenca, avo: null, avr: 0,
  }
}

function orc(overrides: Partial<OrcamentoLinha>): OrcamentoLinha {
  return { unidade: 'FOZ', negocio: 'CONS', ano: 2026, mes: 1, conta_codigo: '159', conta_nome: '', orcado: 0, av: 0, ah: 0, ...overrides }
}

function unidade(codigo: string, nome: string): Unidade {
  return { id: codigo, codigo, nome, nome_ginfo: null, data_entrada: null, apelidos: null }
}

describe('calcularComparativoPorUnidade', () => {
  it('pacote com Orçamento (159): orçado em R$ é o % orçado × receita REALIZADA do mês (não o orçado bruto da planilha) — mesma convenção de BlocoPacote/Farol de Metas', () => {
    const rowsCons: DreLongoRow[] = [
      linha('FOZ', '159', 1, -100000, -40000),
      linha('FOZ', '159', 2, -100000, -45000),
      linha('FOZ', '002', 1, 500000, 480000), // receita realizada
      linha('FOZ', '002', 2, 500000, 520000),
    ]
    const orcamentosCons: OrcamentoLinha[] = [
      orc({ unidade: 'FOZ', conta_codigo: '283', mes: 1 }), // marca unidade nova (numeração nativa)
      orc({ unidade: 'FOZ', conta_codigo: '159', av: -10, mes: 1 }), // 10% custo (ajustarSinal inverte o sinal)
      orc({ unidade: 'FOZ', conta_codigo: '159', av: -10, mes: 2 }),
    ]
    const linhas = calcularComparativoPorUnidade('159', rowsCons, orcamentosCons, [unidade('FOZ', 'Foz')], 2026, 2)
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({
      unidade: 'FOZ', nomeUnidade: 'Foz',
      orcado: 100000, // 10%×480000 + 10%×520000 = 48000+52000, NÃO o orçado bruto da planilha
      remunerado: 200000, // 100000+100000 (abs), campo próprio — não precisa bater com o realizado
      realizado: 85000, // 40000+45000
      dispersao: null,
      receitaRealizada: 1000000, // 480000+520000
    })
    expect(desvioDe(linhas[0], 'orcado')).toBe(15000) // 100000-85000, positivo = gastou menos que o orçado
    expect(desvioPercentDe(linhas[0], 'orcado')).toBeCloseTo(15, 2)
  })

  it('segmento operacional/adm: indiceSegmento 0/1 restringe a um só código do par [operacional, administrativo]', () => {
    const rowsCons: DreLongoRow[] = [
      linha('FOZ', '036', 1, -10000, -9000),
      linha('FOZ', '161', 1, -5000, -4000),
      linha('FOZ', '002', 1, 500000, 100000), // receita realizada do mês
    ]
    const orcamentosCons: OrcamentoLinha[] = [
      orc({ unidade: 'FOZ', conta_codigo: '283', mes: 1 }),
      orc({ unidade: 'FOZ', conta_codigo: '036', av: -10, mes: 1 }), // 10% × 100000 = 10000
      orc({ unidade: 'FOZ', conta_codigo: '161', av: -5, mes: 1 }), // 5% × 100000 = 5000
    ]
    const operacional = calcularComparativoPorUnidade('036', rowsCons, orcamentosCons, [unidade('FOZ', 'Foz')], 2026, 1, 0)
    const adm = calcularComparativoPorUnidade('036', rowsCons, orcamentosCons, [unidade('FOZ', 'Foz')], 2026, 1, 1)
    const consolidado = calcularComparativoPorUnidade('036', rowsCons, orcamentosCons, [unidade('FOZ', 'Foz')], 2026, 1)
    expect(operacional[0]).toMatchObject({ orcado: 10000, realizado: 9000 })
    expect(adm[0]).toMatchObject({ orcado: 5000, realizado: 4000 })
    expect(consolidado[0]).toMatchObject({ orcado: 15000, realizado: 13000 }) // 10%+5% = 15% × 100000
  })

  it('Encargos (038): soma as DUAS totalizadoras (038 operacional + 163 administrativo), não as subcontas — sem Orçado cadastrado, só Remunerado × Realizado', () => {
    const rowsCons: DreLongoRow[] = [
      linha('FOZ', '038', 1, -8000, -9000), // estourou o remunerado — operacional
      linha('FOZ', '163', 1, -2000, -1500), // administrativo, dentro do remunerado
      linha('FOZ', '043', 1, -8000, -9000), // subconta de 038 — NÃO deve ser somada de novo (dobraria o total)
    ]
    const linhas = calcularComparativoPorUnidade('038', rowsCons, [], [unidade('FOZ', 'Foz')], 2026, 1)
    expect(linhas[0]).toMatchObject({ orcado: null, remunerado: 10000, realizado: 10500, dispersao: null })
    expect(desvioDe(linhas[0], 'remunerado')).toBe(-500) // negativo = estourou
    expect(desvioDe(linhas[0], 'orcado')).toBeNull() // sem Orçado, não dá pra comparar por esse lado
  })

  it('Encargos (038): indiceSegmento 0/1 restringe a só 038 (operacional) ou só 163 (adm)', () => {
    const rowsCons: DreLongoRow[] = [linha('FOZ', '038', 1, -8000, -9000), linha('FOZ', '163', 1, -2000, -1500)]
    const operacional = calcularComparativoPorUnidade('038', rowsCons, [], [unidade('FOZ', 'Foz')], 2026, 1, 0)
    const adm = calcularComparativoPorUnidade('038', rowsCons, [], [unidade('FOZ', 'Foz')], 2026, 1, 1)
    expect(operacional[0]).toMatchObject({ remunerado: 8000, realizado: 9000 })
    expect(adm[0]).toMatchObject({ remunerado: 2000, realizado: 1500 })
  })

  it('Vales: orcado null, remunerado/realizado vêm da conta-mãe 051 (não das subcontas), dispersao vem do campo diferenca bruto de 052/053', () => {
    const rowsCons: DreLongoRow[] = [
      linha('FOZ', '051', 1, -7000, -7500), // conta-mãe totalizadora — fonte do remunerado/realizado
      linha('FOZ', '052', 1, -5000, -6000, -1000), // diferenca negativa = estourou — só entra na Dispersão, não some de novo no realizado
      linha('FOZ', '053', 1, -2000, -1500, 500),
    ]
    const linhas = calcularComparativoPorUnidade('vales', rowsCons, [], [unidade('FOZ', 'Foz')], 2026, 1)
    expect(linhas[0].orcado).toBeNull()
    expect(linhas[0].realizado).toBe(7500) // só a mãe 051, não 6000+1500
    expect(linhas[0].remunerado).toBe(7000) // só a mãe 051 — mecânico, não é a fonte de verdade
    expect(linhas[0].dispersao).toBe(-500) // -1000+500, soma direto do diferenca bruto
  })

  it('unidade sem nenhum dado no período entra com realizado 0 e orçado null — nunca some da lista', () => {
    const linhas = calcularComparativoPorUnidade('159', [], [], [unidade('XYZ', 'Unidade Sem Dado')], 2026, 1)
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({ unidade: 'XYZ', realizado: 0, remunerado: 0, orcado: null, dispersao: null, receitaRealizada: 0 })
  })

  it('orçado vira null (acumulado inteiro, não parcial) quando falta o % orçado ou a receita realizada do último mês', () => {
    const rowsCons: DreLongoRow[] = [linha('FOZ', '159', 1, -100000, -40000), linha('FOZ', '159', 2, -100000, -45000)]
    const orcamentosCons: OrcamentoLinha[] = [
      orc({ unidade: 'FOZ', conta_codigo: '283', mes: 1 }),
      orc({ unidade: 'FOZ', conta_codigo: '159', av: -10, mes: 1 }), // só janeiro tem % orçado
    ]
    const linhas = calcularComparativoPorUnidade('159', rowsCons, orcamentosCons, [unidade('FOZ', 'Foz')], 2026, 2)
    expect(linhas[0].orcado).toBeNull()
  })
})

describe('desvioDe / desvioPercentDe / baseDe', () => {
  it('tipo "orcado" usa o campo orcado; tipo "remunerado" usa remunerado — nunca mistura os dois', () => {
    const x = { orcado: 100, remunerado: 80, realizado: 90 }
    expect(baseDe(x, 'orcado')).toBe(100)
    expect(baseDe(x, 'remunerado')).toBe(80)
    expect(desvioDe(x, 'orcado')).toBe(10) // 100-90
    expect(desvioDe(x, 'remunerado')).toBe(-10) // 80-90
    expect(desvioPercentDe(x, 'orcado')).toBeCloseTo(10, 2)
  })

  it('sem orcado, tipo "orcado" devolve null em tudo', () => {
    const x = { orcado: null, remunerado: 80, realizado: 90 }
    expect(baseDe(x, 'orcado')).toBeNull()
    expect(desvioDe(x, 'orcado')).toBeNull()
    expect(desvioPercentDe(x, 'orcado')).toBeNull()
  })
})

describe('percentualDeReceita', () => {
  it('divide o valor pela receita, * 100 — null-safe', () => {
    expect(percentualDeReceita(130000, 1000000)).toBeCloseTo(13, 2)
    expect(percentualDeReceita(null, 1000000)).toBeNull()
    expect(percentualDeReceita(130000, null)).toBeNull()
    expect(percentualDeReceita(130000, 0)).toBeNull()
  })
})

describe('somarLinhas', () => {
  it('realizado/remunerado/receitaRealizada somam todas as unidades; orcado só soma quem tem', () => {
    const linhas = [
      { unidade: 'A', nomeUnidade: 'A', orcado: 100, remunerado: 90, realizado: 80, dispersao: null, receitaRealizada: 900 },
      { unidade: 'B', nomeUnidade: 'B', orcado: 200, remunerado: 220, realizado: 210, dispersao: null, receitaRealizada: 2100 },
      { unidade: 'C', nomeUnidade: 'C', orcado: null, remunerado: 55, realizado: 50, dispersao: null, receitaRealizada: 500 }, // sem Orçado cadastrado
    ]
    const total = somarLinhas(linhas)
    expect(total.realizado).toBe(340) // 80+210+50, TODAS as unidades
    expect(total.remunerado).toBe(365) // 90+220+55
    expect(total.receitaRealizada).toBe(3500) // 900+2100+500
    expect(total.orcado).toBe(300) // 100+200, só A e B
    // desvio/desvioPercent do total vêm de desvioDe/desvioPercentDe aplicado no total, consistente com as linhas
    expect(desvioDe(total, 'orcado')).toBe(300 - 340)
  })

  it('nenhuma unidade com orçado devolve total.orcado null', () => {
    const linhas = [
      { unidade: 'A', nomeUnidade: 'A', orcado: null, remunerado: 10, realizado: 10, dispersao: null, receitaRealizada: 100 },
    ]
    expect(somarLinhas(linhas)).toMatchObject({ orcado: null })
  })

  it('dispersao (só existe pra Vales) soma só quem tem — null quando nenhuma linha tem', () => {
    const linhas = [
      { unidade: 'A', nomeUnidade: 'A', orcado: null, remunerado: 10, realizado: 10, dispersao: -500, receitaRealizada: 100 },
      { unidade: 'B', nomeUnidade: 'B', orcado: null, remunerado: 20, realizado: 25, dispersao: 300, receitaRealizada: 200 },
    ]
    expect(somarLinhas(linhas).dispersao).toBe(-200) // -500+300
    expect(somarLinhas([{ unidade: 'A', nomeUnidade: 'A', orcado: null, remunerado: 10, realizado: 10, dispersao: null, receitaRealizada: 100 }]).dispersao).toBeNull()
  })
})
