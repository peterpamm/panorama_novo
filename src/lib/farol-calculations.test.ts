import { describe, expect, it } from 'vitest'
import type { DreLongoRow, Meta } from '@/types'
import {
  avrPorPrefixo,
  buscarMetaComFallback,
  calcularEstouroZero,
  calcularImpactoFinanceiro,
  calcularReceita,
  calcularReducaoCustos,
  calcularSemaforo,
  calcularSerieAnual,
  metaPorPrefixoAvo,
  normalizarParaCalculo,
} from './farol-calculations'

/**
 * Valores extraídos diretamente do arquivo real C:\Users\LOG20\Downloads\DRE23_12_2025_06_56_4.xlsx
 * (FOZ, janeiro/2025 e o bloco TOTAL acumulado até novembro/2025), exatamente como
 * o GInfo exporta: REMUNERADO/REALIZADO negativos para contas de custo, AVR(%) com
 * o mesmo sinal do REALIZADO. Usados para validar paridade com o Python original
 * (que faz abs(REAL/REMUN) e inverte o AVR de custo em tratar_dre_pro.py).
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
  return { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, mes, tipo_periodo, conta_codigo, remunerado, realizado, diferenca, avo, avr }
}

const JAN_MENSAL: DreLongoRow[] = [
  linha('002', 1, 'MENSAL', 1258969.50, 1252522.80, -6446.70, 100.00),
  linha('021', 1, 'MENSAL', -975993.99, -974827.03, 1166.96, -77.83),
  linha('157', 1, 'MENSAL', -108149.49, -108118.20, 31.29, -8.63),
  linha('232', 1, 'MENSAL', 161786.65, 148470.12, -13316.53, 11.85),
  linha('275', 1, 'MENSAL', -10694.47, 77668.03, 88362.50, 6.20),
  linha('035', 1, 'MENSAL', -242661.09, -242715.34, -54.25, -19.38),
  linha('160', 1, 'MENSAL', -55661.91, -55200.21, 461.70, -4.41),
]

const TOTAL_ACUMULADO: DreLongoRow[] = [
  linha('002', 11, 'ACUMULADO_ANO', 13133781.79, 13285586.90, 151805.11, 100.00),
  linha('021', 11, 'ACUMULADO_ANO', -9989706.37, -9690320.27, 299386.10, -72.94),
  linha('157', 11, 'ACUMULADO_ANO', -1202261.60, -1174320.12, 27941.48, -8.84),
]

describe('normalizarParaCalculo', () => {
  it('usa magnitude (abs) para real/remun e inverte o AVR de contas de custo', () => {
    const [, custo021] = normalizarParaCalculo(JAN_MENSAL)
    expect(custo021.real).toBeCloseTo(974827.03, 2)
    expect(custo021.remun).toBeCloseTo(975993.99, 2)
    expect(custo021.dif).toBeCloseTo(1166.96, 2) // DIF mantém o sinal original
    expect(custo021.avr).toBeCloseTo(77.83, 2)   // invertido: -(-77.83)
  })

  it('não inverte o AVR de EBITDA (232) e Geração de Caixa (275)', () => {
    const calc = normalizarParaCalculo(JAN_MENSAL)
    const ebitda = calc.find(r => r.conta_codigo === '232')!
    const geracaoCaixa = calc.find(r => r.conta_codigo === '275')!
    expect(ebitda.avr).toBeCloseTo(11.85, 2)
    expect(geracaoCaixa.avr).toBeCloseTo(6.20, 2)
  })
})

describe('avrPorPrefixo', () => {
  it('prefixo único (232, EBITDA) retorna o próprio AVR da conta', () => {
    const calc = normalizarParaCalculo(JAN_MENSAL)
    expect(avrPorPrefixo(calc, '232')).toBeCloseTo(11.85, 2)
  })

  it('múltiplos prefixos (pacote 900 = 021+157) retorna soma do REAL / receita(002) * 100', () => {
    const calc = normalizarParaCalculo(JAN_MENSAL)
    // ground truth calculado em Python: (974827.03+108118.20)/1252522.80*100
    expect(avrPorPrefixo(calc, ['021', '157'])).toBeCloseTo(86.46111911096548, 6)
  })

  it('mesmo pacote no acumulado do ano (TOTAL) usa as linhas ACUMULADO_ANO', () => {
    const calc = normalizarParaCalculo(TOTAL_ACUMULADO)
    // ground truth: (9690320.27+1174320.12)/13285586.90*100
    expect(avrPorPrefixo(calc, ['021', '157'])).toBeCloseTo(81.77764724868874, 6)
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
    const avr900 = avrPorPrefixo(calc, ['021', '157']) // 86.46%
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
    const r = calcularEstouroZero(calc, ['035', '160'])
    expect(r.real).toBeCloseTo(297915.55, 2)
    expect(r.remun).toBeCloseTo(298323.00, 2)
    expect(r.impacto).toBeCloseTo(407.45, 2)
  })
})

describe('calcularReducaoCustos', () => {
  it('marca "meta_atingida" quando a redução é de 15% ou mais', () => {
    const atual = normalizarParaCalculo([linha('217', 1, 'MENSAL', -5000, -4000, 1000, -80)])
    const anterior = normalizarParaCalculo([linha('217', 1, 'MENSAL', -5500, -5000, 500, -90)])
    const r = calcularReducaoCustos(atual, anterior, ['217'])
    expect(r.realAtual).toBeCloseTo(4000)
    expect(r.realAnterior).toBeCloseTo(5000)
    expect(r.variacaoPct).toBeCloseTo(-20) // (4000-5000)/5000*100
    expect(r.status).toBe('meta_atingida')
    expect(r.corClasse).toBe('positivo')
  })

  it('marca "reduziu_nao_bateu" quando reduziu menos de 15%', () => {
    const atual = normalizarParaCalculo([linha('217', 1, 'MENSAL', 0, -4800, 0, 0)])
    const anterior = normalizarParaCalculo([linha('217', 1, 'MENSAL', 0, -5000, 0, 0)])
    const r = calcularReducaoCustos(atual, anterior, ['217'])
    expect(r.variacaoPct).toBeCloseTo(-4) // (4800-5000)/5000*100
    expect(r.status).toBe('reduziu_nao_bateu')
    expect(r.corClasse).toBe('atencao')
  })

  it('marca "aumentou" quando o custo cresceu', () => {
    const atual = normalizarParaCalculo([linha('217', 1, 'MENSAL', 0, -6000, 0, 0)])
    const anterior = normalizarParaCalculo([linha('217', 1, 'MENSAL', 0, -5000, 0, 0)])
    const r = calcularReducaoCustos(atual, anterior, ['217'])
    expect(r.variacaoPct).toBeCloseTo(20)
    expect(r.status).toBe('aumentou')
    expect(r.corClasse).toBe('negativo')
  })

  it('variação 0 quando não há dado do ano anterior', () => {
    const atual = normalizarParaCalculo([linha('217', 1, 'MENSAL', 0, -1000, 0, 0)])
    const r = calcularReducaoCustos(atual, [], ['217'])
    expect(r.variacaoPct).toBe(0)
  })
})

describe('normalizarParaCalculo (avo)', () => {
  it('inverte o sinal do avo de custo, igual ao avr (avo vem negativo do GInfo)', () => {
    const calc = normalizarParaCalculo([linha('021', 1, 'MENSAL', -975993.99, -974827.03, 1166.96, -77.83, -85.00)])
    expect(calc[0].avo).toBeCloseTo(85.00, 2)
  })

  it('não inverte o avo de EBITDA/Geração de Caixa', () => {
    const calc = normalizarParaCalculo([linha('232', 1, 'MENSAL', 161786.65, 148470.12, -13316.53, 11.85, 15.00)])
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

  it('múltiplos prefixos (pacote 900 = 021+157): soma direta dos avo de cada conta', () => {
    const calc = normalizarParaCalculo([
      linha('021', 1, 'MENSAL', 0, 0, 0, 0, -85.00),
      linha('157', 1, 'MENSAL', 0, 0, 0, 0, -8.50),
    ])
    expect(metaPorPrefixoAvo(calc, ['021', '157'])).toBeCloseTo(93.50, 2)
  })

  it('retorna null quando nenhuma conta do pacote tem avo no período', () => {
    const calc = normalizarParaCalculo([linha('021', 1, 'MENSAL', 0, 0, 0, 0)])
    expect(metaPorPrefixoAvo(calc, '021')).toBeNull()
  })

  it('soma só as contas que têm avo, ignorando as que não têm', () => {
    const calc = normalizarParaCalculo([
      linha('021', 1, 'MENSAL', 0, 0, 0, 0, -85.00),
      linha('157', 1, 'MENSAL', 0, 0, 0, 0), // sem avo
    ])
    expect(metaPorPrefixoAvo(calc, ['021', '157'])).toBeCloseTo(85.00, 2)
  })
})

describe('buscarMetaComFallback', () => {
  const metasManuais: Meta[] = [
    { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', mes: 0, meta_avr: 70 },
  ]

  it('usa o avo do período quando disponível, ignorando a tabela manual', () => {
    const calc = normalizarParaCalculo([linha('021', 1, 'MENSAL', 0, 0, 0, 0, -85.00)])
    const meta = buscarMetaComFallback(calc, metasManuais, {
      unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', isYtd: false, mes: 1, prefixos: '021',
    })
    expect(meta).toBeCloseTo(85.00, 2)
  })

  it('cai para a tabela manual quando o período não tem avo', () => {
    const calc = normalizarParaCalculo([linha('021', 1, 'MENSAL', 0, 0, 0, 0)])
    const meta = buscarMetaComFallback(calc, metasManuais, {
      unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', isYtd: false, mes: 1, prefixos: '021',
    })
    expect(meta).toBe(70)
  })

  it('no modo YTD, ignora o avo (que seria só o orçado acumulado até o último mês) e usa a meta manual (mes=0)', () => {
    const calc = normalizarParaCalculo([linha('021', 11, 'ACUMULADO_ANO', 0, 0, 0, 0, -90.00)])
    const meta = buscarMetaComFallback(calc, metasManuais, {
      unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', isYtd: true, mes: 11, prefixos: '021',
    })
    expect(meta).toBe(70)
  })

  it('retorna null quando não há avo nem meta manual cadastrada', () => {
    const calc = normalizarParaCalculo([linha('999', 1, 'MENSAL', 0, 0, 0, 0)])
    const meta = buscarMetaComFallback(calc, [], {
      unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '999', isYtd: false, mes: 1, prefixos: '999',
    })
    expect(meta).toBeNull()
  })
})

describe('calcularSerieAnual', () => {
  it('monta 1 ponto por mês presente, com avr e meta (avo do mês, modo mensal)', () => {
    const rowsAno: DreLongoRow[] = [
      ...JAN_MENSAL,
      linha('021', 2, 'MENSAL', -1000000, -900000, 100000, -90, -85),
    ]
    const serie = calcularSerieAnual(rowsAno, [], { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', prefixos: '021' })
    expect(serie.map(p => p.mes)).toEqual([1, 2])
    expect(serie[0].avr).toBeCloseTo(77.83, 2) // janeiro, do JAN_MENSAL
    expect(serie[0].meta).toBeNull()           // janeiro não tem avo no fixture
    expect(serie[1].avr).toBeCloseTo(90, 2)
    expect(serie[1].meta).toBeCloseTo(85, 2)   // fevereiro tem avo
  })

  it('ignora linhas ACUMULADO_ANO ao montar a série (só meses MENSAL)', () => {
    const rowsAno: DreLongoRow[] = [...JAN_MENSAL, ...TOTAL_ACUMULADO]
    const serie = calcularSerieAnual(rowsAno, [], { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', prefixos: '021' })
    expect(serie.map(p => p.mes)).toEqual([1])
  })

  it('cai para a meta manual (mes=0) quando o mês não tem avo', () => {
    const rowsAno: DreLongoRow[] = [linha('021', 3, 'MENSAL', -1000000, -800000, 200000, -80)]
    const metasManuais: Meta[] = [{ unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', mes: 0, meta_avr: 70 }]
    const serie = calcularSerieAnual(rowsAno, metasManuais, { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', prefixos: '021' })
    expect(serie[0].meta).toBe(70)
  })
})
