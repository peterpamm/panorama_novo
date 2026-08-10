import { describe, expect, it } from 'vitest'
import { parseHistoricoMatriz } from './resumo-geral-historico-parser'

const HEADER = ['FILIAL', 'GENTE', 'FROTA', 'SEGURANÇA', 'FINANCEIRO', 'DISTRIBUIÇÃO', 'ARMAZÉM', 'TOTAL']

describe('parseHistoricoMatriz', () => {
  it('lê unidade (coluna "FILIAL") e o valor de cada setor', () => {
    const matriz = [
      HEADER,
      ['FRANCISCO BELTRÃO', 535, 740, 407.75, 340, 75, 680, 2777.75],
      ['CASCAVEL', 765, 735, 417, 660, 875, 840, 4292],
    ]
    const { linhas, erros } = parseHistoricoMatriz(matriz)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'FRANCISCO BELTRÃO', porSetor: { gente: 535, frota: 740, seguranca: 407.75, financeiro: 340, distribuicao: 75, armazem: 680 } },
      { unidade: 'CASCAVEL', porSetor: { gente: 765, frota: 735, seguranca: 417, financeiro: 660, distribuicao: 875, armazem: 840 } },
    ])
  })

  it('não exige a coluna Total (é só informativa, recalculada em código)', () => {
    const matriz = [
      ['FILIAL', 'GENTE', 'FROTA', 'SEGURANÇA', 'FINANCEIRO', 'DISTRIBUIÇÃO', 'ARMAZÉM'],
      ['VIDROS', 615, 900, 284, 380, 0, 0],
    ]
    const { linhas, erros } = parseHistoricoMatriz(matriz)
    expect(erros).toEqual([])
    expect(linhas).toEqual([{ unidade: 'VIDROS', porSetor: { gente: 615, frota: 900, seguranca: 284, financeiro: 380, distribuicao: 0, armazem: 0 } }])
  })

  it('também aceita cabeçalho "UNIDADE"', () => {
    const matriz = [
      ['UNIDADE', 'GENTE', 'FROTA', 'SEGURANÇA', 'FINANCEIRO', 'DISTRIBUIÇÃO', 'ARMAZÉM'],
      ['ESTÂNCIA', 0, 0, 0, 0, 0, 0],
    ]
    const { linhas } = parseHistoricoMatriz(matriz)
    expect(linhas).toEqual([{ unidade: 'ESTÂNCIA', porSetor: { gente: 0, frota: 0, seguranca: 0, financeiro: 0, distribuicao: 0, armazem: 0 } }])
  })

  it('pula linhas totalmente vazias', () => {
    const matriz = [HEADER, ['', '', '', '', '', '', '', ''], ['LONDRINA', 775, 745, 414.5, 720, 880, 400, 3934.5]]
    const { linhas } = parseHistoricoMatriz(matriz)
    expect(linhas).toHaveLength(1)
  })

  it('marca erro quando algum valor de setor vem inválido/texto, sem derrubar o resto do arquivo', () => {
    const matriz = [
      HEADER,
      ['DIADEMA', 'abc', 810, 276.75, 810, 660, 600, 3861.75],
      ['LITORAL', 430, 830, 491.25, 660, 555, 680, 3646.25],
    ]
    const { linhas, erros } = parseHistoricoMatriz(matriz)
    expect(linhas).toEqual([{ unidade: 'LITORAL', porSetor: { gente: 430, frota: 830, seguranca: 491.25, financeiro: 660, distribuicao: 555, armazem: 680 } }])
    expect(erros).toHaveLength(1)
  })

  it('retorna erro de cabeçalho quando falta alguma coluna de setor', () => {
    const { linhas, erros } = parseHistoricoMatriz([['FILIAL', 'GENTE'], ['FOZ', 660]])
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna erro de cabeçalho quando não acha Filial/Unidade', () => {
    const { linhas, erros } = parseHistoricoMatriz([['A', 'B'], ['1', '2']])
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio pra matriz vazia', () => {
    expect(parseHistoricoMatriz([])).toEqual({ linhas: [], erros: [] })
  })
})
