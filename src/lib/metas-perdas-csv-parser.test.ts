import { describe, expect, it } from 'vitest'
import { parseMetasPerdasCsv } from './metas-perdas-csv-parser'

describe('parseMetasPerdasCsv', () => {
  it('lê linhas válidas', () => {
    const texto = 'unidade;ano;meta;financeiro\nDIADEMA;2026;-2,42;-1.019.671,58\nRIO;2026;-1,7;-500.417,70'
    const { linhas, erros } = parseMetasPerdasCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'DIADEMA', ano: 2026, meta_pct: -2.42, meta_anual: -1019671.58 },
      { unidade: 'RIO', ano: 2026, meta_pct: -1.7, meta_anual: -500417.7 },
    ])
  })

  it('reconhece o cabeçalho em qualquer ordem de coluna', () => {
    const texto = 'financeiro;meta;ano;unidade\n-500.417,70;-1,7;2026;RIO'
    const { linhas } = parseMetasPerdasCsv(texto)
    expect(linhas).toEqual([{ unidade: 'RIO', ano: 2026, meta_pct: -1.7, meta_anual: -500417.7 }])
  })

  it('retorna erro de cabeçalho inválido quando falta alguma coluna esperada', () => {
    const { linhas, erros } = parseMetasPerdasCsv('unidade;ano;meta\nRIO;2026;-1,7')
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('ignora linha com número de colunas insuficiente, sem travar o resto do arquivo', () => {
    const texto = 'unidade;ano;meta;financeiro\nRIO;2026\nDIADEMA;2026;-2,42;-1.019.671,58'
    const { linhas, erros } = parseMetasPerdasCsv(texto)
    expect(erros).toEqual(['Linha 2: número de colunas inválido'])
    expect(linhas).toEqual([{ unidade: 'DIADEMA', ano: 2026, meta_pct: -2.42, meta_anual: -1019671.58 }])
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseMetasPerdasCsv('')).toEqual({ linhas: [], erros: [] })
  })
})
