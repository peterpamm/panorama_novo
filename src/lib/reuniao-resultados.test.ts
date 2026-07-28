import { describe, expect, it } from 'vitest'
import { atribuirRankComDesempate, calcularPontosGanhos, formatarResultado, naturezaEFormatoAutomaticos, parseValorInput, resolverNaturezaFormato, valorParaInputEditavel } from './reuniao-resultados'

describe('calcularPontosGanhos', () => {
  it('retorna null sem resultado lançado', () => {
    expect(calcularPontosGanhos(null, 50, 'custo', 50)).toBeNull()
  })

  it('retorna null sem meta disponível (fonte automática sem linha pro período)', () => {
    expect(calcularPontosGanhos(31, null, 'custo', 50)).toBeNull()
  })

  it('custo: resultado menor ou igual à meta bate (pontos cheios)', () => {
    expect(calcularPontosGanhos(8, 10, 'custo', 50)).toBe(50)
    expect(calcularPontosGanhos(10, 10, 'custo', 50)).toBe(50)
  })

  it('custo: resultado maior que a meta não bate (0 pontos)', () => {
    expect(calcularPontosGanhos(12, 10, 'custo', 50)).toBe(0)
  })

  it('performance: resultado maior ou igual à meta bate (pontos cheios)', () => {
    expect(calcularPontosGanhos(95, 90, 'performance', 30)).toBe(30)
    expect(calcularPontosGanhos(90, 90, 'performance', 30)).toBe(30)
  })

  it('performance: resultado menor que a meta não bate (0 pontos)', () => {
    expect(calcularPontosGanhos(85, 90, 'performance', 30)).toBe(0)
  })
})

describe('formatarResultado', () => {
  it('retorna "—" pra valor null', () => {
    expect(formatarResultado(null, 'numero')).toBe('—')
  })

  it('formata percentual, monetário, duração e número', () => {
    expect(formatarResultado(31, 'percentual')).toBe('31.0%')
    expect(formatarResultado(5000, 'monetario')).toContain('5.000')
    expect(formatarResultado(100, 'duracao')).toBe('01:40')
    expect(formatarResultado(12, 'numero')).toBe('12,00')
  })
})

describe('parseValorInput / valorParaInputEditavel', () => {
  it('texto vazio vira null (não zero)', () => {
    expect(parseValorInput('', 'numero')).toBeNull()
    expect(parseValorInput('   ', 'percentual')).toBeNull()
  })

  it('parseia número em formato pt-BR', () => {
    expect(parseValorInput('31,5', 'percentual')).toBeCloseTo(31.5)
  })

  it('parseia duração HH:MM', () => {
    expect(parseValorInput('01:40', 'duracao')).toBe(100)
  })

  it('null vira texto vazio pro input; duração vira HH:MM', () => {
    expect(valorParaInputEditavel(null, 'numero')).toBe('')
    expect(valorParaInputEditavel(100, 'duracao')).toBe('01:40')
  })
})

describe('naturezaEFormatoAutomaticos', () => {
  it('manual retorna null (usa o que foi cadastrado)', () => {
    expect(naturezaEFormatoAutomaticos('manual', null)).toBeNull()
  })

  it('perdas é sempre performance/monetario — resultado menos negativo (ou positivo) que a meta é melhor', () => {
    expect(naturezaEFormatoAutomaticos('perdas', 'vales')).toEqual({ natureza: 'performance', formato: 'monetario' })
  })

  it('rotinas é sempre performance/percentual — maior aderência é melhor', () => {
    expect(naturezaEFormatoAutomaticos('rotinas', null)).toEqual({ natureza: 'performance', formato: 'percentual' })
  })

  it('farol_pacote deriva a natureza do PACOTES e formato é sempre percentual', () => {
    expect(naturezaEFormatoAutomaticos('farol_pacote', '157')).toEqual({ natureza: 'custo', formato: 'percentual' })
    expect(naturezaEFormatoAutomaticos('farol_pacote', '232')).toEqual({ natureza: 'performance', formato: 'percentual' })
  })

  it('farol_pacote com chave desconhecida retorna null', () => {
    expect(naturezaEFormatoAutomaticos('farol_pacote', 'inexistente')).toBeNull()
  })
})

describe('resolverNaturezaFormato', () => {
  it('manual usa o que foi cadastrado, mesmo que "errado" pro olho automático', () => {
    expect(resolverNaturezaFormato({ fonte: 'manual', fonte_chave: null, natureza: 'custo', formato: 'numero' }))
      .toEqual({ natureza: 'custo', formato: 'numero' })
  })

  it('perdas ignora o que está salvo e recalcula (auto-corrige dado antigo gravado errado)', () => {
    expect(resolverNaturezaFormato({ fonte: 'perdas', fonte_chave: 'vales', natureza: 'custo', formato: 'monetario' }))
      .toEqual({ natureza: 'performance', formato: 'monetario' })
  })

  it('farol_pacote com chave inválida cai pro que estava salvo', () => {
    expect(resolverNaturezaFormato({ fonte: 'farol_pacote', fonte_chave: 'xxx', natureza: 'custo', formato: 'percentual' }))
      .toEqual({ natureza: 'custo', formato: 'percentual' })
  })
})

describe('atribuirRankComDesempate', () => {
  interface Linha { unidade: string; pontos: number | null; ebitda: number | null; rank: number | null }
  const linha = (unidade: string, pontos: number | null, ebitda: number | null): Linha => ({ unidade, pontos, ebitda, rank: null })

  it('sem empate, ignora o desempate e ordena só pela chave principal', () => {
    const linhas = [linha('B', 100, 5), linha('A', 200, 1)]
    const resultado = atribuirRankComDesempate(linhas, l => l.pontos, l => l.ebitda)
    expect(resultado.map(l => l.unidade)).toEqual(['A', 'B'])
    expect(resultado.map(l => l.rank)).toEqual([1, 2])
  })

  it('empate na pontuação é resolvido pelo desempate (maior EBITDA vence)', () => {
    const linhas = [linha('A', 150, 2), linha('B', 150, 8), linha('C', 150, 5)]
    const resultado = atribuirRankComDesempate(linhas, l => l.pontos, l => l.ebitda)
    expect(resultado.map(l => l.unidade)).toEqual(['B', 'C', 'A'])
    expect(resultado.map(l => l.rank)).toEqual([1, 2, 3])
  })

  it('pontuação null vai pro final, mesmo com bom desempate', () => {
    const linhas = [linha('A', null, 999), linha('B', 100, 1)]
    const resultado = atribuirRankComDesempate(linhas, l => l.pontos, l => l.ebitda)
    expect(resultado.map(l => l.unidade)).toEqual(['B', 'A'])
  })

  it('empate total (pontos e desempate null) mantém a ordem original', () => {
    const linhas = [linha('A', 100, null), linha('B', 100, null)]
    const resultado = atribuirRankComDesempate(linhas, l => l.pontos, l => l.ebitda)
    expect(resultado.map(l => l.unidade)).toEqual(['A', 'B'])
    expect(resultado.map(l => l.rank)).toEqual([1, 2])
  })
})
