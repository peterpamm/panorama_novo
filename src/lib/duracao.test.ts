import { describe, expect, it } from 'vitest'
import { parseDuracaoParaMinutos, formatarMinutosComoDuracao } from './duracao'

describe('parseDuracaoParaMinutos', () => {
  it('converte "HH:MM" pra minutos totais', () => {
    expect(parseDuracaoParaMinutos('01:40')).toBe(100)
    expect(parseDuracaoParaMinutos('03:15')).toBe(195)
  })

  it('converte "HH:MM:SS" pra minutos totais (com fração de segundos)', () => {
    expect(parseDuracaoParaMinutos('00:01:30')).toBe(1.5)
  })

  it('converte serial de hora do Excel (fração do dia) pra minutos', () => {
    expect(parseDuracaoParaMinutos(0.5)).toBe(720) // meio-dia = 12h = 720min
  })

  it('número >= 1 já é minutos puros, sem multiplicar por 1440 (célula sem formatação de hora na planilha)', () => {
    // Bug real: unidade com a célula RESULT sem formatação de hora — 141
    // (= 02:21) virava 3384:00 por ser tratado como fração de dia.
    expect(parseDuracaoParaMinutos(141)).toBe(141)
    expect(parseDuracaoParaMinutos(130)).toBe(130)
    expect(parseDuracaoParaMinutos(1)).toBe(1)
  })

  it('retorna null pra texto vazio ou inválido', () => {
    expect(parseDuracaoParaMinutos('')).toBeNull()
    expect(parseDuracaoParaMinutos('abc')).toBeNull()
    expect(parseDuracaoParaMinutos('10')).toBeNull() // sem separador ":"
  })
})

describe('formatarMinutosComoDuracao', () => {
  it('formata minutos totais como "HH:MM"', () => {
    expect(formatarMinutosComoDuracao(100)).toBe('01:40')
    expect(formatarMinutosComoDuracao(195)).toBe('03:15')
  })

  it('inclui segundos só quando sobra fração', () => {
    expect(formatarMinutosComoDuracao(1.5)).toBe('00:01:30')
    expect(formatarMinutosComoDuracao(90)).toBe('01:30')
  })

  it('faz round-trip com parseDuracaoParaMinutos', () => {
    const minutos = parseDuracaoParaMinutos('01:40')!
    expect(formatarMinutosComoDuracao(minutos)).toBe('01:40')
  })
})
