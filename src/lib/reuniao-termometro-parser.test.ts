import { describe, expect, it } from 'vitest'
import { parseTermometroCsv } from './reuniao-termometro-parser'

describe('parseTermometroCsv', () => {
  it('lê unidade e a pontuação, mesmo com o cabeçalho da 2ª coluna sendo o nome do mês', () => {
    const texto = [
      'Unidade;Junho',
      'CD FRANCISCO BELTRÃO;85',
      'CD CASCAVEL;92,5',
    ].join('\n')
    const { linhas, erros } = parseTermometroCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'CD FRANCISCO BELTRÃO', valor: 85 },
      { unidade: 'CD CASCAVEL', valor: 92.5 },
    ])
  })

  it('reconhece o cabeçalho em qualquer ordem de coluna', () => {
    const texto = 'Julho;Unidade\n70;VIDROS PR'
    const { linhas } = parseTermometroCsv(texto)
    expect(linhas).toEqual([{ unidade: 'VIDROS PR', valor: 70 }])
  })

  it('pula unidade sem nota lançada nesse mês, sem gerar erro', () => {
    const texto = ['Unidade;Agosto', 'CD CASCAVEL;', 'CD FOZ;60'].join('\n')
    const { linhas, erros } = parseTermometroCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([{ unidade: 'CD FOZ', valor: 60 }])
  })

  it('retorna erro de cabeçalho inválido quando falta a coluna Unidade', () => {
    const { linhas, erros } = parseTermometroCsv('Setembro;Outracoisa\n10;20')
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseTermometroCsv('')).toEqual({ linhas: [], erros: [] })
  })

  it('marca erro de valor inválido sem derrubar o resto do arquivo', () => {
    const texto = ['Unidade;Outubro', 'CD CASCAVEL;abc', 'CD FOZ;60'].join('\n')
    const { linhas, erros } = parseTermometroCsv(texto)
    expect(linhas).toEqual([{ unidade: 'CD FOZ', valor: 60 }])
    expect(erros).toHaveLength(1)
  })
})
