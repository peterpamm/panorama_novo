import { describe, expect, it } from 'vitest'
import type { DreLongoRow, Meta, OrcamentoLinha } from '@/types'
import {
  avrPorPrefixo,
  buscarMetaComFallback,
  calcularEstouroZero,
  calcularEvolucaoReducaoCustos,
  calcularImpactoFinanceiro,
  calcularIncrementoUnidadesNovas,
  calcularReceita,
  calcularReducaoCustos,
  calcularSemaforo,
  calcularSerieAnual,
  calcularSerieCaptura,
  calcularSerieCapturaReducaoCustos,
  calcularSerieReducaoCustos,
  mesesAtivosNoAno,
  metaPorPrefixoAvo,
  normalizarParaCalculo,
  somaRealAnoAnteriorComMedia,
} from './farol-calculations'

/**
 * Valores extraídos diretamente do arquivo real C:\Users\LOG20\Downloads\DRE23_12_2025_06_56_4.xlsx
 * (FOZ, janeiro/2025 e o bloco TOTAL acumulado até novembro/2025), exatamente como
 * o GInfo exporta: REMUNERADO/REALIZADO negativos para contas de custo, AVR(%) com
 * o mesmo sinal do REALIZADO. Usados para validar paridade com o Python original
 * (que faz abs(REAL/REMUN) e inverte o AVR de custo em tratar_dre_pro.py).
 *
 * `ano: 2026` de propósito (não o ano real do arquivo-fonte) — os códigos de
 * conta aqui (233 EBITDA, 276 Geração de Caixa, 158 Despesa Administrativa
 * etc.) são a numeração NOVA (pós-cutover, ver `codigoDreNumeracaoAtual` em
 * farol-calculations.ts), então precisam de um `ano` que não dispare a
 * tradução pra numeração antiga. O teste dedicado a essa tradução
 * (`normalizarParaCalculo — tradução pré-cutover`, mais abaixo) usa seu
 * próprio `ano: 2025` com os códigos ANTIGOS de propósito.
 */
function linha(
  conta_codigo: string,
  mes: number,
  tipo_periodo: 'MENSAL' | 'ACUMULADO_ANO',
  remunerado: number,
  realizado: number,
  diferenca: number,
  avr: number,
  avo: number | null = null,
): DreLongoRow {
  return { unidade: 'FOZ', negocio: 'ROTA', ano: 2026, mes, tipo_periodo, conta_codigo, remunerado, realizado, diferenca, avo, avr }
}

/** Linha do Orçamento (tabela `orcamentos`) — mesmo helper de orcamento-farol.test.ts. */
function orc(overrides: Partial<OrcamentoLinha>): OrcamentoLinha {
  return { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, mes: 1, conta_codigo: '002', conta_nome: '', orcado: 0, av: 0, ah: 0, ...overrides }
}

const JAN_MENSAL: DreLongoRow[] = [
  linha('002', 1, 'MENSAL', 1258969.50, 1252522.80, -6446.70, 100.00),
  linha('021', 1, 'MENSAL', -975993.99, -974827.03, 1166.96, -77.83),
  linha('158', 1, 'MENSAL', -108149.49, -108118.20, 31.29, -8.63),
  linha('233', 1, 'MENSAL', 161786.65, 148470.12, -13316.53, 11.85),
  linha('276', 1, 'MENSAL', -10694.47, 77668.03, 88362.50, 6.20),
  linha('036', 1, 'MENSAL', -242661.09, -242715.34, -54.25, -19.38),
  linha('161', 1, 'MENSAL', -55661.91, -55200.21, 461.70, -4.41),
]

const TOTAL_ACUMULADO: DreLongoRow[] = [
  linha('002', 11, 'ACUMULADO_ANO', 13133781.79, 13285586.90, 151805.11, 100.00),
  linha('021', 11, 'ACUMULADO_ANO', -9989706.37, -9690320.27, 299386.10, -72.94),
  linha('158', 11, 'ACUMULADO_ANO', -1202261.60, -1174320.12, 27941.48, -8.84),
]

describe('normalizarParaCalculo', () => {
  it('usa magnitude (abs) para real/remun e inverte o AVR de contas de custo', () => {
    const [, custo021] = normalizarParaCalculo(JAN_MENSAL)
    expect(custo021.real).toBeCloseTo(974827.03, 2)
    expect(custo021.remun).toBeCloseTo(975993.99, 2)
    expect(custo021.dif).toBeCloseTo(1166.96, 2) // DIF mantém o sinal original
    expect(custo021.avr).toBeCloseTo(77.83, 2)   // invertido: -(-77.83)
  })

  it('não inverte o AVR de EBITDA (233) e Geração de Caixa (276)', () => {
    const calc = normalizarParaCalculo(JAN_MENSAL)
    const ebitda = calc.find(r => r.conta_codigo === '233')!
    const geracaoCaixa = calc.find(r => r.conta_codigo === '276')!
    expect(ebitda.avr).toBeCloseTo(11.85, 2)
    expect(geracaoCaixa.avr).toBeCloseTo(6.20, 2)
  })
})

describe('normalizarParaCalculo — tradução de código pré-cutover (ano <= 2025)', () => {
  /** ano <= 2025: DRE realizado ainda gravado com a numeração ANTIGA (232=EBITDA, 157=Despesa Administrativa — ver sql/seed_contas.sql). */
  function linhaAntiga(conta_codigo: string, ano: number, avr: number, realizado = 1000): DreLongoRow {
    return { unidade: 'FOZ', negocio: 'ROTA', ano, mes: 1, tipo_periodo: 'MENSAL', conta_codigo, remunerado: realizado, realizado, diferenca: 0, avo: null, avr }
  }

  it('traduz código antigo de EBITDA (232) pro novo (233) pra ano <= 2025', () => {
    const [ebitda] = normalizarParaCalculo([linhaAntiga('232', 2025, 15)])
    expect(ebitda.conta_codigo).toBe('233')
  })

  it('código já traduzido bate com CODIGOS_PERFORMANCE — AVR de EBITDA não inverte mesmo vindo do código antigo', () => {
    const [ebitda] = normalizarParaCalculo([linhaAntiga('232', 2025, 15)])
    expect(ebitda.avr).toBeCloseTo(15, 2) // não invertido — sem a tradução, cairia no ramo "custo" e viraria -15
  })

  it('traduz código antigo de Despesa Administrativa (157) pro novo (158) — conta de custo, AVR continua invertendo', () => {
    const [despesa] = normalizarParaCalculo([linhaAntiga('157', 2025, -8.63)])
    expect(despesa.conta_codigo).toBe('158')
    expect(despesa.avr).toBeCloseTo(8.63, 2) // invertido: -(-8.63)
  })

  it('código 001-034 nunca desloca, mesmo pra ano antigo', () => {
    const [conta] = normalizarParaCalculo([linhaAntiga('021', 2025, -77.83)])
    expect(conta.conta_codigo).toBe('021')
  })

  it('ano >= 2026 (já reimportado na numeração nova) não traduz nada — código passa direto', () => {
    const [ebitda] = normalizarParaCalculo([linhaAntiga('233', 2026, 11.85)])
    expect(ebitda.conta_codigo).toBe('233')
    expect(ebitda.avr).toBeCloseTo(11.85, 2)
  })

  it('código fora da faixa 035-282 não desloca, mesmo pra ano antigo (ex: id sintético)', () => {
    const [conta] = normalizarParaCalculo([linhaAntiga('900', 2025, 10)])
    expect(conta.conta_codigo).toBe('900')
  })
})

describe('avrPorPrefixo', () => {
  it('prefixo único (233, EBITDA) retorna o próprio AVR da conta', () => {
    const calc = normalizarParaCalculo(JAN_MENSAL)
    expect(avrPorPrefixo(calc, '233')).toBeCloseTo(11.85, 2)
  })

  it('múltiplos prefixos (pacote 900 = 021+158) retorna soma do REAL / receita(002) * 100', () => {
    const calc = normalizarParaCalculo(JAN_MENSAL)
    // ground truth calculado em Python: (974827.03+108118.20)/1252522.80*100
    expect(avrPorPrefixo(calc, ['021', '158'])).toBeCloseTo(86.46111911096548, 6)
  })

  it('mesmo pacote no acumulado do ano (TOTAL) usa as linhas ACUMULADO_ANO', () => {
    const calc = normalizarParaCalculo(TOTAL_ACUMULADO)
    // ground truth: (9690320.27+1174320.12)/13285586.90*100
    expect(avrPorPrefixo(calc, ['021', '158'])).toBeCloseTo(81.77764724868874, 6)
  })

  it('retorna 0 quando não há REAL para o prefixo', () => {
    expect(avrPorPrefixo([], '021')).toBe(0)
  })
})

describe('calcularReceita', () => {
  it('soma o REAL (magnitude) da conta 002', () => {
    const calc = normalizarParaCalculo(JAN_MENSAL)
    expect(calcularReceita(calc)).toBeCloseTo(1252522.80, 2)
  })
})

describe('calcularImpactoFinanceiro', () => {
  it('custo: impacto negativo quando o AVR realizado supera a meta (gastou mais que o orçado)', () => {
    const calc = normalizarParaCalculo(JAN_MENSAL)
    const avr900 = avrPorPrefixo(calc, ['021', '158']) // 86.46%
    const receita = calcularReceita(calc)
    const impacto = calcularImpactoFinanceiro(avr900, 85, receita, 'custo')
    expect(impacto).toBeCloseTo(-18300.85, 1) // ground truth Python: ((85-86.461119)/100)*1252522.80
  })

  it('retorna 0 quando não há meta cadastrada', () => {
    expect(calcularImpactoFinanceiro(50, null, 1000, 'custo')).toBe(0)
  })

  it('retorna 0 quando a receita é zero', () => {
    expect(calcularImpactoFinanceiro(50, 40, 0, 'custo')).toBe(0)
  })

  it('performance: impacto positivo quando o AVR supera a meta', () => {
    const impacto = calcularImpactoFinanceiro(15, 12, 1_000_000, 'performance')
    expect(impacto).toBeCloseTo(((15 - 12) / 100) * 1_000_000, 5)
  })
})

describe('calcularSemaforo', () => {
  it('custo: verde quando o AVR fica abaixo (ou igual) da meta', () => {
    const s = calcularSemaforo(77.83, 80, 'custo')
    expect(s.corClasse).toBe('positivo')
    expect(s.delta).toBeCloseTo(2.17, 2)
  })

  it('custo: vermelho quando o AVR supera a meta', () => {
    const s = calcularSemaforo(86.46, 85, 'custo')
    expect(s.corClasse).toBe('negativo')
  })

  it('performance: verde quando o AVR supera a meta', () => {
    const s = calcularSemaforo(16.47, 15, 'performance')
    expect(s.corClasse).toBe('positivo')
  })

  it('performance: vermelho quando o AVR fica abaixo da meta', () => {
    const s = calcularSemaforo(11.85, 15, 'performance')
    expect(s.corClasse).toBe('negativo')
  })

  it('sem meta cadastrada, fica cinza e sem delta', () => {
    const s = calcularSemaforo(50, null, 'custo')
    expect(s.corClasse).toBe('semCor')
    expect(s.delta).toBeNull()
  })
})

describe('calcularEstouroZero', () => {
  it('soma real/remun em magnitude e dif com o sinal original (Salários: 035+160, janeiro)', () => {
    const calc = normalizarParaCalculo(JAN_MENSAL)
    const r = calcularEstouroZero(calc, ['036', '161'])
    expect(r.real).toBeCloseTo(297915.55, 2)
    expect(r.remun).toBeCloseTo(298323.00, 2)
    expect(r.impacto).toBeCloseTo(407.45, 2)
  })
})

describe('calcularReducaoCustos', () => {
  it('marca "meta_atingida" quando a redução é de 15% ou mais', () => {
    const r = calcularReducaoCustos(4000, 5000)
    expect(r.realAtual).toBe(4000)
    expect(r.realAnterior).toBe(5000)
    expect(r.variacaoPct).toBeCloseTo(-20) // (4000-5000)/5000*100
    expect(r.status).toBe('meta_atingida')
    expect(r.corClasse).toBe('positivo')
  })

  it('marca "reduziu_nao_bateu" quando reduziu menos de 15%', () => {
    const r = calcularReducaoCustos(4800, 5000)
    expect(r.variacaoPct).toBeCloseTo(-4) // (4800-5000)/5000*100
    expect(r.status).toBe('reduziu_nao_bateu')
    expect(r.corClasse).toBe('atencao')
  })

  it('marca "aumentou" quando o custo cresceu', () => {
    const r = calcularReducaoCustos(6000, 5000)
    expect(r.variacaoPct).toBeCloseTo(20)
    expect(r.status).toBe('aumentou')
    expect(r.corClasse).toBe('negativo')
  })

  it('variação 0 quando não há dado do ano anterior', () => {
    const r = calcularReducaoCustos(1000, 0)
    expect(r.variacaoPct).toBe(0)
  })
})

function linhaAno(ano: number, conta_codigo: string, mes: number, realizado: number): DreLongoRow {
  return { unidade: 'FOZ', negocio: 'ROTA', ano, mes, tipo_periodo: 'MENSAL', conta_codigo, remunerado: 0, realizado, diferenca: 0, avo: null, avr: 0 }
}

function linhaAcumulado(ano: number, conta_codigo: string, mes: number, realizado: number): DreLongoRow {
  return { unidade: 'FOZ', negocio: 'ROTA', ano, mes, tipo_periodo: 'ACUMULADO_ANO', conta_codigo, remunerado: 0, realizado, diferenca: 0, avo: null, avr: 0 }
}

describe('somaRealAnoAnteriorComMedia', () => {
  it('sem data_entrada, soma direta do(s) mês(es) pedido(s) — mesmo comportamento de uma unidade sem ajuste', () => {
    const rowsNegocio: DreLongoRow[] = [linhaAno(2027, '217', 1, -5000), linhaAno(2027, '217', 2, -6000)]
    expect(somaRealAnoAnteriorComMedia(rowsNegocio, null, 2027, ['217'], [1])).toBe(5000)
    expect(somaRealAnoAnteriorComMedia(rowsNegocio, null, 2027, ['217'], [1, 2])).toBe(11000)
  })

  it('com data_entrada no meio do ano, preenche os meses anteriores com a média do período operacional', () => {
    const rowsNegocio: DreLongoRow[] = [
      linhaAno(2027, '217', 7, -1500), linhaAno(2027, '217', 8, -1500), linhaAno(2027, '217', 9, -1500),
      linhaAno(2027, '217', 10, -3000), linhaAno(2027, '217', 11, -3000), linhaAno(2027, '217', 12, -3000),
    ] // total 13500 / 6 meses = média 2250
    expect(somaRealAnoAnteriorComMedia(rowsNegocio, '2027-07-01', 2027, ['217'], [1])).toBe(2250) // jan: antes da entrada, usa a média
    expect(somaRealAnoAnteriorComMedia(rowsNegocio, '2027-07-01', 2027, ['217'], [10])).toBe(3000) // out: real, mesmo sendo diferente da média
  })

  it('gasto real igual a zero num mês operacional não cai na média — soma 0 mesmo', () => {
    const rowsNegocio: DreLongoRow[] = [
      linhaAno(2027, '217', 7, 0), linhaAno(2027, '217', 8, -2000),
    ]
    expect(somaRealAnoAnteriorComMedia(rowsNegocio, '2027-07-01', 2027, ['217'], [7])).toBe(0)
  })

  it('retorna null quando a unidade não existia nesse ano (data_entrada é de um ano posterior)', () => {
    const rowsNegocio: DreLongoRow[] = [linhaAno(2028, '217', 1, -1000)]
    expect(somaRealAnoAnteriorComMedia(rowsNegocio, '2028-01-01', 2027, ['217'], [1])).toBeNull()
  })

  it('retorna null quando não há nenhum dado real no ano, mesmo sem data_entrada', () => {
    expect(somaRealAnoAnteriorComMedia([], null, 2027, ['217'], [1])).toBeNull()
  })

  it('intervalo desde o mês 1 prefere o bloco ACUMULADO_ANO oficial, em vez de somar os meses', () => {
    const rowsNegocio: DreLongoRow[] = [
      linhaAno(2027, '217', 1, -1000), linhaAno(2027, '217', 2, -1000), // soma dos meses = 2000
      linhaAcumulado(2027, '217', 2, -2050), // acumulado oficial (ex: arredondamento/reclass) = 2050
    ]
    expect(somaRealAnoAnteriorComMedia(rowsNegocio, null, 2027, ['217'], [1, 2])).toBe(2050)
  })

  it('sem o bloco ACUMULADO_ANO no mês de corte, cai de volta pra somar os meses (ano encerrado sem snapshot mês a mês)', () => {
    const rowsNegocio: DreLongoRow[] = [
      linhaAno(2027, '217', 1, -1000), linhaAno(2027, '217', 2, -1500),
      linhaAcumulado(2027, '217', 12, -9999), // só tem acumulado de dezembro, não do mês 2 pedido
    ]
    expect(somaRealAnoAnteriorComMedia(rowsNegocio, null, 2027, ['217'], [1, 2])).toBe(2500)
  })

  it('não prefere ACUMULADO_ANO quando o intervalo não começa em 1 (mês isolado/YTD parcial fora do início)', () => {
    const rowsNegocio: DreLongoRow[] = [
      linhaAno(2027, '217', 2, -1000),
      linhaAcumulado(2027, '217', 2, -9999),
    ]
    expect(somaRealAnoAnteriorComMedia(rowsNegocio, null, 2027, ['217'], [2])).toBe(1000)
  })

  it('com data_entrada no meio do ano, não prefere ACUMULADO_ANO (precisa da granularidade mensal pra aplicar a média)', () => {
    const rowsNegocio: DreLongoRow[] = [
      linhaAno(2027, '217', 7, -1500), linhaAno(2027, '217', 8, -1500),
      linhaAcumulado(2027, '217', 8, -9999),
    ]
    expect(somaRealAnoAnteriorComMedia(rowsNegocio, '2027-07-01', 2027, ['217'], [1, 2])).toBe(3000) // jan+fev = 2x a média (1500 cada)
  })
})

describe('calcularSerieReducaoCustos', () => {
  it('cada mês compara o realizado atual com -15% do realizado do mesmo mês no ano anterior', () => {
    const rowsNegocio: DreLongoRow[] = [
      linhaAno(2026, '217', 1, -5000),
      linhaAno(2026, '217', 2, -6000),
      linhaAno(2027, '217', 1, -4000),
      linhaAno(2027, '217', 2, -5500),
    ]
    const serie = calcularSerieReducaoCustos(rowsNegocio, null, 2027, ['217'])
    expect(serie).toEqual([
      { mes: 1, avr: 4000, meta: 4250 }, // 5000*0.85
      { mes: 2, avr: 5500, meta: 5100 }, // 6000*0.85
    ])
  })

  it('meta null quando o mês não tem dado no ano anterior e a unidade não tem data_entrada', () => {
    const rowsNegocio: DreLongoRow[] = [linhaAno(2027, '217', 1, -4000)]
    const serie = calcularSerieReducaoCustos(rowsNegocio, null, 2027, ['217'])
    expect(serie).toEqual([{ mes: 1, avr: 4000, meta: null }])
  })

  it('com data_entrada, meses antes da entrada no ano anterior usam a meta estimada pela média', () => {
    const rowsNegocio: DreLongoRow[] = [
      linhaAno(2027, '217', 7, -2000), linhaAno(2027, '217', 8, -2000), // ano anterior: média 2000 (jul-dez, mas só 2 meses com dado aqui)
      linhaAno(2028, '217', 1, -1800),
    ]
    const serie = calcularSerieReducaoCustos(rowsNegocio, '2027-07-01', 2028, ['217'])
    expect(serie).toEqual([{ mes: 1, avr: 1800, meta: 1700 }]) // meta = 2000 (média) * 0.85
  })

  it('com unidadesIncremento, soma o incremento ao histórico do mês antes de aplicar -15%', () => {
    const rowsNegocio: DreLongoRow[] = [
      linhaAno(2026, '217', 1, -4000),
      linhaAno(2027, '217', 1, -3000),
    ]
    // unidade parcial: entrou em mar/2026, então jan/2026 usa a média (estimada aqui em 1000)
    const unidadeNova: DreLongoRow[] = [
      linhaAno(2026, '217', 3, -1000), linhaAno(2026, '217', 4, -1000),
    ]
    const serie = calcularSerieReducaoCustos(rowsNegocio, null, 2027, ['217'], [
      { dataEntrada: '2026-03-01', rows: unidadeNova },
    ])
    expect(serie).toEqual([{ mes: 1, avr: 3000, meta: (4000 + 1000) * 0.85 }])
  })
})

describe('calcularSerieCapturaReducaoCustos', () => {
  it('campo metaAnual carrega a média MENSAL (total do ano anterior * 0.85 / 12); ritmo necessário usa o total cheio', () => {
    const rowsNegocio: DreLongoRow[] = [
      linhaAno(2026, '217', 1, -5000),
      linhaAno(2026, '217', 2, -5000),
      linhaAno(2027, '217', 1, -4000),
      linhaAno(2027, '217', 2, -4500),
    ]
    const serie = calcularSerieCapturaReducaoCustos(rowsNegocio, null, 2027, ['217'])
    expect(serie.map(p => p.mes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(serie[0]).toMatchObject({ mes: 1, avrRealizado: 4000, avrNecessario: null, metaAnual: 8500 / 12 }) // 10000*0.85, /12 na exibição
    expect(serie[1].avrRealizado).toBeCloseTo(4500, 2)
    expect(serie[1].avrNecessario).toBeCloseTo(4500, 2)
    // ritmo: (8500 - (4000+4500)) / 10 = 0 (usa o total anual de verdade, não a média exibida)
    for (let i = 2; i < 12; i++) {
      expect(serie[i].avrRealizado).toBeNull()
      expect(serie[i].avrNecessario).toBeCloseTo(0, 2)
    }
  })

  it('sem dado do ano anterior, meta fica null e não projeta meses futuros', () => {
    const rowsNegocio: DreLongoRow[] = [linhaAno(2027, '217', 1, -4000)]
    const serie = calcularSerieCapturaReducaoCustos(rowsNegocio, null, 2027, ['217'])
    expect(serie).toHaveLength(1)
    expect(serie[0]).toMatchObject({ mes: 1, avrRealizado: 4000, avrNecessario: null, metaAnual: null })
  })

  it('retorna lista vazia quando o ano atual não tem nenhum mês', () => {
    const serie = calcularSerieCapturaReducaoCustos([], null, 2027, ['217'])
    expect(serie).toEqual([])
  })

  it('com data_entrada, a meta extrapola a média mensal pros 12 meses (não soma só os meses reais)', () => {
    const rowsNegocio: DreLongoRow[] = [
      linhaAno(2027, '217', 7, -1500), linhaAno(2027, '217', 8, -1500), linhaAno(2027, '217', 9, -1500),
      linhaAno(2027, '217', 10, -1500), linhaAno(2027, '217', 11, -1500), linhaAno(2027, '217', 12, -1500),
      linhaAno(2028, '217', 1, -1000),
    ] // ano anterior: média 1500/mês * 12 = 18000 -> meta anual 15300, exibida como 15300/12 = 1275
    const serie = calcularSerieCapturaReducaoCustos(rowsNegocio, '2027-07-01', 2028, ['217'])
    expect(serie[0].metaAnual).toBeCloseTo(1275, 2)
  })

  it('com unidadesIncremento, soma o incremento ao histórico antes de aplicar -15% e dividir por 12', () => {
    const rowsNegocio: DreLongoRow[] = [
      linhaAno(2026, '217', 1, -5000), linhaAno(2026, '217', 2, -5000), // ano anterior real: 10000
      linhaAno(2027, '217', 1, -4000),
    ]
    // unidade parcial: entrou em jul/2026, gastou 6000 (jul-dez), média 1000/mês -> incremento jan-jun = 6000
    const unidadeNova: DreLongoRow[] = [
      linhaAno(2026, '217', 7, -1000), linhaAno(2026, '217', 8, -1000), linhaAno(2026, '217', 9, -1000),
      linhaAno(2026, '217', 10, -1000), linhaAno(2026, '217', 11, -1000), linhaAno(2026, '217', 12, -1000),
    ]
    const serieSemIncremento = calcularSerieCapturaReducaoCustos(rowsNegocio, null, 2027, ['217'])
    const serieComIncremento = calcularSerieCapturaReducaoCustos(rowsNegocio, null, 2027, ['217'], [
      { dataEntrada: '2026-07-01', rows: unidadeNova },
    ])
    expect(serieSemIncremento[0].metaAnual).toBeCloseTo((10000 * 0.85) / 12, 2) // 708.33
    expect(serieComIncremento[0].metaAnual).toBeCloseTo((16000 * 0.85) / 12, 2) // 1133.33 (10000+6000 de incremento)
  })
})

describe('calcularIncrementoUnidadesNovas', () => {
  it('lista vazia retorna 0', () => {
    expect(calcularIncrementoUnidadesNovas([], 2027, ['217'], [1])).toBe(0)
  })

  it('soma o incremento (ajustado - bruto) de cada unidade da lista', () => {
    const unidadeA: DreLongoRow[] = [linhaAno(2027, '217', 7, -1500), linhaAno(2027, '217', 8, -1500)] // média 1500
    const unidadeB: DreLongoRow[] = [linhaAno(2027, '217', 9, -900)] // média 900
    const incremento = calcularIncrementoUnidadesNovas(
      [{ dataEntrada: '2027-07-01', rows: unidadeA }, { dataEntrada: '2027-09-01', rows: unidadeB }],
      2027, ['217'], [1],
    )
    // mês 1: unidadeA usa a média (1500, antes da entrada em jul) + unidadeB usa a média (900, antes da entrada em set)
    // bruto (sem data_entrada) pra ambas no mês 1 = 0 (nenhuma linha em jan)
    expect(incremento).toBeCloseTo(1500 + 900, 2)
  })
})

describe('normalizarParaCalculo (avo)', () => {
  it('inverte o sinal do avo de custo, igual ao avr (avo vem negativo do GInfo)', () => {
    const calc = normalizarParaCalculo([linha('021', 1, 'MENSAL', -975993.99, -974827.03, 1166.96, -77.83, -85.00)])
    expect(calc[0].avo).toBeCloseTo(85.00, 2)
  })

  it('não inverte o avo de EBITDA/Geração de Caixa', () => {
    const calc = normalizarParaCalculo([linha('233', 1, 'MENSAL', 161786.65, 148470.12, -13316.53, 11.85, 15.00)])
    expect(calc[0].avo).toBeCloseTo(15.00, 2)
  })

  it('preserva null quando o período não tem avo (arquivo antigo, sem a coluna)', () => {
    const calc = normalizarParaCalculo([linha('021', 1, 'MENSAL', -975993.99, -974827.03, 1166.96, -77.83)])
    expect(calc[0].avo).toBeNull()
  })
})

describe('metaPorPrefixoAvo', () => {
  it('prefixo único: retorna o avo (já invertido) da própria conta', () => {
    const calc = normalizarParaCalculo([linha('021', 1, 'MENSAL', 0, 0, 0, 0, -85.00)])
    expect(metaPorPrefixoAvo(calc, '021')).toBeCloseTo(85.00, 2)
  })

  it('múltiplos prefixos (pacote 900 = 021+158): soma direta dos avo de cada conta', () => {
    const calc = normalizarParaCalculo([
      linha('021', 1, 'MENSAL', 0, 0, 0, 0, -85.00),
      linha('158', 1, 'MENSAL', 0, 0, 0, 0, -8.50),
    ])
    expect(metaPorPrefixoAvo(calc, ['021', '158'])).toBeCloseTo(93.50, 2)
  })

  it('retorna null quando nenhuma conta do pacote tem avo no período', () => {
    const calc = normalizarParaCalculo([linha('021', 1, 'MENSAL', 0, 0, 0, 0)])
    expect(metaPorPrefixoAvo(calc, '021')).toBeNull()
  })

  it('soma só as contas que têm avo, ignorando as que não têm', () => {
    const calc = normalizarParaCalculo([
      linha('021', 1, 'MENSAL', 0, 0, 0, 0, -85.00),
      linha('158', 1, 'MENSAL', 0, 0, 0, 0), // sem avo
    ])
    expect(metaPorPrefixoAvo(calc, ['021', '158'])).toBeCloseTo(85.00, 2)
  })
})

describe('buscarMetaComFallback', () => {
  const metasManuais: Meta[] = [
    { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', mes: 0, meta_avr: 70 },
    { unidade: 'FOZ', negocio: 'ROTA', ano: 2026, codigo: '021', mes: 0, meta_avr: 70 },
    { unidade: 'FOZ', negocio: 'ROTA', ano: 2026, codigo: '021', mes: 1, meta_avr: 65 },
  ]

  it('em anos >=2026 (regime com meta por mês), usa o avo do período quando disponível, ignorando a tabela manual', () => {
    const calc = normalizarParaCalculo([linha('021', 1, 'MENSAL', 0, 0, 0, 0, -85.00)])
    const meta = buscarMetaComFallback(calc, metasManuais, {
      unidade: 'FOZ', negocio: 'ROTA', ano: 2026, codigo: '021', isYtd: false, mes: 1, prefixos: '021',
    })
    expect(meta).toBeCloseTo(85.00, 2)
  })

  it('em anos >=2026, cai para a tabela manual (do próprio mês) quando o mês não tem avo', () => {
    const calc = normalizarParaCalculo([linha('021', 1, 'MENSAL', 0, 0, 0, 0)])
    const meta = buscarMetaComFallback(calc, metasManuais, {
      unidade: 'FOZ', negocio: 'ROTA', ano: 2026, codigo: '021', isYtd: false, mes: 1, prefixos: '021',
    })
    expect(meta).toBe(65)
  })

  it('em anos anteriores a 2026, ignora o avo mesmo quando presente no período — só existia meta anual nesse regime', () => {
    const calc = normalizarParaCalculo([linha('021', 1, 'MENSAL', 0, 0, 0, 0, -85.00)])
    const meta = buscarMetaComFallback(calc, metasManuais, {
      unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', isYtd: false, mes: 1, prefixos: '021',
    })
    expect(meta).toBe(70) // meta manual anual (mes=0), não o avo (85) que porventura tenha vindo no arquivo
  })

  it('no modo YTD, ignora o avo (que seria só o orçado acumulado até o último mês) e usa a meta manual (mes=0)', () => {
    const calc = normalizarParaCalculo([linha('021', 11, 'ACUMULADO_ANO', 0, 0, 0, 0, -90.00)])
    const meta = buscarMetaComFallback(calc, metasManuais, {
      unidade: 'FOZ', negocio: 'ROTA', ano: 2026, codigo: '021', isYtd: true, mes: 11, prefixos: '021',
    })
    expect(meta).toBe(70)
  })

  it('retorna null quando não há avo nem meta manual cadastrada', () => {
    const calc = normalizarParaCalculo([linha('999', 1, 'MENSAL', 0, 0, 0, 0)])
    const meta = buscarMetaComFallback(calc, [], {
      unidade: 'FOZ', negocio: 'ROTA', ano: 2026, codigo: '999', isYtd: false, mes: 1, prefixos: '999',
    })
    expect(meta).toBeNull()
  })
})

describe('calcularSerieAnual', () => {
  it('em anos >=2026, monta 1 ponto por mês presente, com avr e meta (avo do mês, modo mensal)', () => {
    const rowsAno: DreLongoRow[] = [
      ...JAN_MENSAL,
      linha('021', 2, 'MENSAL', -1000000, -900000, 100000, -90, -85),
    ]
    const serie = calcularSerieAnual(rowsAno, [], { unidade: 'FOZ', negocio: 'ROTA', ano: 2026, codigo: '021', prefixos: '021' })
    expect(serie.map(p => p.mes)).toEqual([1, 2])
    expect(serie[0].avr).toBeCloseTo(77.83, 2) // janeiro, do JAN_MENSAL
    expect(serie[0].meta).toBeNull()           // janeiro não tem avo no fixture
    expect(serie[1].avr).toBeCloseTo(90, 2)
    expect(serie[1].meta).toBeCloseTo(85, 2)   // fevereiro tem avo
  })

  it('em anos anteriores a 2026, ignora o avo mesmo quando presente — só existia meta anual nesse regime', () => {
    const rowsAno: DreLongoRow[] = [
      ...JAN_MENSAL,
      linha('021', 2, 'MENSAL', -1000000, -900000, 100000, -90, -85),
    ]
    const metasManuais: Meta[] = [{ unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', mes: 0, meta_avr: 70 }]
    const serie = calcularSerieAnual(rowsAno, metasManuais, { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', prefixos: '021' })
    expect(serie[0].meta).toBe(70) // janeiro: cai na manual (mesmo sem avo)
    expect(serie[1].meta).toBe(70) // fevereiro: ignora o avo (-85) presente no fixture, usa a manual anual
  })

  it('ignora linhas ACUMULADO_ANO ao montar a série (só meses MENSAL)', () => {
    const rowsAno: DreLongoRow[] = [...JAN_MENSAL, ...TOTAL_ACUMULADO]
    const serie = calcularSerieAnual(rowsAno, [], { unidade: 'FOZ', negocio: 'ROTA', ano: 2026, codigo: '021', prefixos: '021' })
    expect(serie.map(p => p.mes)).toEqual([1])
  })

  it('cai para a meta manual (mes=0) quando o mês não tem avo', () => {
    const rowsAno: DreLongoRow[] = [linha('021', 3, 'MENSAL', -1000000, -800000, 200000, -80)]
    const metasManuais: Meta[] = [{ unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', mes: 0, meta_avr: 70 }]
    const serie = calcularSerieAnual(rowsAno, metasManuais, { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', prefixos: '021' })
    expect(serie[0].meta).toBe(70)
  })

  it('cada ponto carrega a receita do próprio mês (pra dar pra calcular impacto financeiro sob demanda)', () => {
    const rowsAno: DreLongoRow[] = [
      linha('002', 1, 'MENSAL', 1000000, 1200000, 200000, 100),
      linha('021', 1, 'MENSAL', -1000000, -800000, 200000, -80),
      linha('002', 2, 'MENSAL', 1000000, 900000, -100000, 100),
      linha('021', 2, 'MENSAL', -1000000, -900000, 100000, -90),
    ]
    const serie = calcularSerieAnual(rowsAno, [], { unidade: 'FOZ', negocio: 'ROTA', ano: 2026, codigo: '021', prefixos: '021' })
    expect(serie[0].receita).toBeCloseTo(1200000, 2)
    expect(serie[1].receita).toBeCloseTo(900000, 2)
  })
})

describe('calcularSerieCaptura', () => {
  // codigo '021' (ano 2025, esquema bespoke ≤ 2026) -> PACOTE_CONTA_ORCAMENTO['021'] = ['012'] pra Meta %;
  // Receita Orçada (conta '002') não passa por tradução nenhuma, mesmo código em qualquer esquema.
  function orcamentosBase(): OrcamentoLinha[] {
    const receitaMensal = Array.from({ length: 12 }, (_, i) => orc({ mes: i + 1, conta_codigo: '002', orcado: 100000 }))
    return [
      ...receitaMensal,
      orc({ mes: 1, conta_codigo: '012', av: -10 }), // Meta % Jan = 10 (custo: av bruto negativo, ajustarSinal inverte)
      orc({ mes: 2, conta_codigo: '012', av: -20 }), // Meta % Fev = 20
    ]
  }

  it('meses realizados mostram o AVR do próprio mês (igual ao gráfico de Acompanhamento mensal); meses futuros mostram a curva de captura ponderada pela massa de receita', () => {
    const metasManuais: Meta[] = [{ unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', mes: 0, meta_avr: 90 }]
    const rowsAno: DreLongoRow[] = [
      linha('002', 1, 'MENSAL', 100000, 100000, 0, 100),
      linha('021', 1, 'MENSAL', -1000000, -30000, 0, -80),
      linha('002', 2, 'MENSAL', 100000, 100000, 0, 100),
      linha('021', 2, 'MENSAL', -1000000, -30000, 0, -70),
    ]
    const serie = calcularSerieCaptura(rowsAno, metasManuais, orcamentosBase(), { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', prefixos: '021', natureza: 'custo' })

    expect(serie.map(p => p.mes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

    expect(serie[0]).toMatchObject({ mes: 1, avrRealizado: 80, avrNecessario: null, metaAnual: 90 })
    // mes 2 (último realizado): o próprio AVR de fevereiro (70) E ponto de conexão do necessário
    expect(serie[1].avrRealizado).toBeCloseTo(70, 2)
    expect(serie[1].avrNecessario).toBeCloseTo(70, 2)
    // massa de meta = 100000(receita realizada jan)*10% + 100000(fev)*20% = 30000; meta acumulada ponderada = 30000/200000 = 15%
    // massa permitida = receita orçada anual (1200000) * 15% = 180000; despesa já realizada = 30000+30000 = 60000
    // massa disponível = 180000-60000 = 120000; receita restante = orçada anual (1200000) - realizada acumulada (200000) = 1000000
    // curva de captura = 120000/1000000*100 = 12%, repetido mar..dez
    for (let i = 2; i < 12; i++) {
      expect(serie[i].avrRealizado).toBeNull()
      expect(serie[i].avrNecessario).toBeCloseTo(12, 2)
      expect(serie[i].metaAnual).toBe(90)
    }
  })

  it('sem Orçamento (nem Receita Orçada nem Meta %), retorna só os meses realizados (sem ritmo necessário)', () => {
    const rowsAno: DreLongoRow[] = [linha('021', 1, 'MENSAL', -1000000, -800000, 200000, -80)]
    const serie = calcularSerieCaptura(rowsAno, [], [], { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', prefixos: '021', natureza: 'custo' })
    expect(serie).toHaveLength(1)
    expect(serie[0]).toMatchObject({ mes: 1, avrRealizado: 80, avrNecessario: null, metaAnual: null })
  })

  it('retorna lista vazia quando não há nenhum mês realizado', () => {
    const serie = calcularSerieCaptura([], [], [], { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', prefixos: '021', natureza: 'custo' })
    expect(serie).toEqual([])
  })

  it('sem meses restantes (dezembro já realizado), não projeta nenhum mês futuro', () => {
    const metasManuais: Meta[] = [{ unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', mes: 0, meta_avr: 90 }]
    const rowsAno: DreLongoRow[] = [linha('021', 12, 'MENSAL', -1000000, -800000, 200000, -80)]
    const serie = calcularSerieCaptura(rowsAno, metasManuais, orcamentosBase(), { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', prefixos: '021', natureza: 'custo' })
    expect(serie).toHaveLength(1)
    expect(serie[0].mes).toBe(12)
  })

  it('meses realizados carregam a receita do próprio mês; meses futuros/projetados ficam com receita null', () => {
    const metasManuais: Meta[] = [{ unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', mes: 0, meta_avr: 90 }]
    const rowsAno: DreLongoRow[] = [
      linha('002', 1, 'MENSAL', 1000000, 1100000, 100000, 100),
      linha('021', 1, 'MENSAL', -1000000, -1000000, 0, -80),
    ]
    const serie = calcularSerieCaptura(rowsAno, metasManuais, orcamentosBase(), { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', prefixos: '021', natureza: 'custo' })
    expect(serie[0].receita).toBeCloseTo(1100000, 2) // janeiro, realizado
    expect(serie[1].receita).toBeNull()               // fevereiro em diante, projetado
  })

  it('trava o ritmo necessário na própria meta anual quando economizar antes deixaria o ritmo pedir um % PIOR que ela (custo: nunca libera gastar mais que a meta)', () => {
    const rowsAno: DreLongoRow[] = [
      linha('002', 1, 'MENSAL', 100000, 100000, 0, 100),
      linha('021', 1, 'MENSAL', -1000000, -30000, 0, -80),
      linha('002', 2, 'MENSAL', 100000, 100000, 0, 100),
      linha('021', 2, 'MENSAL', -1000000, -30000, 0, -70),
    ]
    // Mesmos números do primeiro teste (ritmo bruto = 12%) — meta anual informada agora é 5%, bem menor: trava em 5, não deixa subir pra 12.
    const serie = calcularSerieCaptura(
      rowsAno, [], orcamentosBase(), { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', prefixos: '021', natureza: 'custo' }, 5,
    )
    expect(serie[11].avrNecessario).toBeCloseTo(5, 2)
  })

  it('trava o ritmo necessário na própria meta anual quando ficaria PIOR que ela (performance, ex: EBITDA: nunca libera cair abaixo da meta)', () => {
    const rowsAno: DreLongoRow[] = [
      linha('002', 1, 'MENSAL', 100000, 100000, 0, 100),
      linha('021', 1, 'MENSAL', -1000000, -30000, 0, -80),
      linha('002', 2, 'MENSAL', 100000, 100000, 0, 100),
      linha('021', 2, 'MENSAL', -1000000, -30000, 0, -70),
    ]
    // Mesmo ritmo bruto (12%) — meta anual informada agora é 20%, maior: em performance o ritmo trava subindo pra 20 (não pode pedir menos que a meta).
    const serie = calcularSerieCaptura(
      rowsAno, [], orcamentosBase(), { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', prefixos: '021', natureza: 'performance' }, 20,
    )
    expect(serie[11].avrNecessario).toBeCloseTo(20, 2)
  })

  it('meses sem Meta % no Orçamento ficam de fora da Meta Acumulada Ponderada (não zeram a média)', () => {
    // Só janeiro tem Meta % (10%); fevereiro fica de fora do passo 1-2 (sem linha de Meta), mas
    // sua receita realizada ainda entra na Receita Realizada Acumulada do passo 5.
    const orcamentos: OrcamentoLinha[] = [
      ...Array.from({ length: 12 }, (_, i) => orc({ mes: i + 1, conta_codigo: '002', orcado: 100000 })),
      orc({ mes: 1, conta_codigo: '012', av: -10 }),
    ]
    const rowsAno: DreLongoRow[] = [
      linha('002', 1, 'MENSAL', 100000, 100000, 0, 100),
      linha('021', 1, 'MENSAL', -1000000, -5000, 0, -80),
      linha('002', 2, 'MENSAL', 100000, 100000, 0, 100),
      linha('021', 2, 'MENSAL', -1000000, -5000, 0, -70),
    ]
    const serie = calcularSerieCaptura(rowsAno, [], orcamentos, { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', prefixos: '021', natureza: 'custo' })
    // meta acumulada ponderada = só janeiro = 100000(receita realizada)*10% / 100000 = 10%
    // massa permitida = 1200000*10% = 120000; despesa já realizada = 5000+5000 = 10000; massa disponível = 110000
    // receita restante = orçada anual (1200000) - realizada acumulada (100000+100000=200000) = 1000000
    // curva de captura = 110000/1000000*100 = 11%
    expect(serie[11].avrNecessario).toBeCloseTo(11, 2)
  })
})

describe('calcularEvolucaoReducaoCustos', () => {
  it('um ponto por mês já realizado, comparando com -15% do mesmo mês no ano anterior', () => {
    const rowsUnidade: DreLongoRow[] = [
      linhaAno(2026, '217', 1, -5000), linhaAno(2026, '217', 2, -5000),
      linhaAno(2027, '217', 1, -4000), linhaAno(2027, '217', 2, -5500),
    ]
    const evolucao = calcularEvolucaoReducaoCustos(rowsUnidade, null, 2027, ['217'])
    expect(evolucao.meses).toHaveLength(2)
    expect(evolucao.meses[0]).toMatchObject({ mes: 1, resultado: { status: 'meta_atingida' } }) // 4000 vs 5000: -20%
    expect(evolucao.meses[1]).toMatchObject({ mes: 2, resultado: { status: 'aumentou' } }) // 5500 vs 5000: +10%
  })

  it('campo anual acumula até o último mês realizado', () => {
    const rowsUnidade: DreLongoRow[] = [
      linhaAno(2026, '217', 1, -5000), linhaAno(2026, '217', 2, -5000),
      linhaAno(2027, '217', 1, -4000), linhaAno(2027, '217', 2, -4500),
    ]
    const evolucao = calcularEvolucaoReducaoCustos(rowsUnidade, null, 2027, ['217'])
    expect(evolucao.anual?.realAtual).toBeCloseTo(8500, 2) // 4000+4500
    expect(evolucao.anual?.realAnterior).toBeCloseTo(10000, 2) // 5000+5000
  })

  it('sem nenhum mês realizado no ano, retorna meses vazio e anual null', () => {
    const evolucao = calcularEvolucaoReducaoCustos([], null, 2027, ['217'])
    expect(evolucao).toEqual({ meses: [], anual: null })
  })

  it('com data_entrada, meses antes da entrada no ano anterior usam a média (igual ao card)', () => {
    const rowsUnidade: DreLongoRow[] = [
      linhaAno(2027, '217', 7, -1500), linhaAno(2027, '217', 8, -1500),
      linhaAno(2028, '217', 1, -1800),
    ]
    const evolucao = calcularEvolucaoReducaoCustos(rowsUnidade, '2027-07-01', 2028, ['217'])
    expect(evolucao.meses[0].resultado.realAnterior).toBeCloseTo(1500, 2) // média jul-ago
    expect(evolucao.anual?.realAnterior).toBeCloseTo(1500, 2)
  })

  it('com unidadesIncremento (linha totalizadora AMBEV), soma o incremento ao histórico de cada mês', () => {
    const rowsAmbev: DreLongoRow[] = [
      linhaAno(2026, '217', 1, -5000),
      linhaAno(2027, '217', 1, -4000),
    ]
    const unidadeNova: DreLongoRow[] = [
      linhaAno(2026, '217', 3, -1000), linhaAno(2026, '217', 4, -1000),
    ]
    const semIncremento = calcularEvolucaoReducaoCustos(rowsAmbev, null, 2027, ['217'])
    const comIncremento = calcularEvolucaoReducaoCustos(rowsAmbev, null, 2027, ['217'], [
      { dataEntrada: '2026-03-01', rows: unidadeNova },
    ])
    expect(semIncremento.meses[0].resultado.realAnterior).toBeCloseTo(5000, 2)
    expect(comIncremento.meses[0].resultado.realAnterior).toBeCloseTo(6000, 2) // +1000 de incremento (média jan, antes da entrada em mar)
  })
})

describe('mesesAtivosNoAno', () => {
  it('sem data_entrada (unidade antiga) sempre 12', () => {
    expect(mesesAtivosNoAno(null, 2026)).toBe(12)
  })

  it('entrou em maio de 2026: 12 − 5 + 1 = 8 meses ativos', () => {
    expect(mesesAtivosNoAno('2026-05-12', 2026)).toBe(8)
  })

  it('entrou em janeiro: 12 meses ativos, igual a não ter data_entrada', () => {
    expect(mesesAtivosNoAno('2026-01-01', 2026)).toBe(12)
  })

  it('entrou em dezembro: só 1 mês ativo', () => {
    expect(mesesAtivosNoAno('2026-12-15', 2026)).toBe(1)
  })

  it('entrada em ano anterior ao consultado: unidade já operava o ano inteiro, 12 meses', () => {
    expect(mesesAtivosNoAno('2025-05-12', 2026)).toBe(12)
  })

  it('unidade que nem existia ainda nesse ano (entrada é no ano seguinte): cai no padrão de 12', () => {
    expect(mesesAtivosNoAno('2027-01-01', 2026)).toBe(12)
  })
})
