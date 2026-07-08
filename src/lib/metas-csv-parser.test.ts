import { describe, expect, it } from 'vitest'
import { parseMetasCsv } from './metas-csv-parser'

describe('parseMetasCsv', () => {
  it('lê linhas válidas, preenchendo o código com zero à esquerda', () => {
    const texto = 'unidade;negocio;ano;codigo;meta_avr;mes\nFOZ;ROTA;2025;21;70,87;0\nFOZ;ROTA;2025;158;40,2;0'
    const { linhas, erros } = parseMetasCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', mes: 0, meta_avr: 70.87 },
      { unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '158', mes: 0, meta_avr: 40.2 },
    ])
  })

  it('não preenche zero quando o código já tem 3 dígitos', () => {
    const texto = 'unidade;negocio;ano;codigo;meta_avr;mes\nFOZ;ROTA;2025;900;10,5;0'
    const { linhas } = parseMetasCsv(texto)
    expect(linhas[0].codigo).toBe('900')
  })

  it('reconhece o cabeçalho em qualquer ordem de coluna', () => {
    const texto = 'mes;codigo;meta_avr;ano;negocio;unidade\n0;21;70,87;2025;ROTA;FOZ'
    const { linhas } = parseMetasCsv(texto)
    expect(linhas).toEqual([{ unidade: 'FOZ', negocio: 'ROTA', ano: 2025, codigo: '021', mes: 0, meta_avr: 70.87 }])
  })

  it('retorna erro de cabeçalho inválido quando falta alguma coluna esperada', () => {
    const { linhas, erros } = parseMetasCsv('unidade;negocio;ano;codigo;mes\nFOZ;ROTA;2025;21;0')
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('ignora linha com número de colunas insuficiente, sem travar o resto do arquivo', () => {
    const texto = 'unidade;negocio;ano;codigo;meta_avr;mes\nFOZ;ROTA;2025\nDIADEMA;CONS;2025;21;78,55;0'
    const { linhas, erros } = parseMetasCsv(texto)
    expect(erros).toEqual(['Linha 2: número de colunas inválido'])
    expect(linhas).toEqual([{ unidade: 'DIADEMA', negocio: 'CONS', ano: 2025, codigo: '021', mes: 0, meta_avr: 78.55 }])
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseMetasCsv('')).toEqual({ linhas: [], erros: [] })
  })

  it('aceita meses 1-12 (meta mensal) além do mês 0 (meta anual)', () => {
    const texto = 'unidade;negocio;ano;codigo;meta_avr;mes\nFOZ;ROTA;2026;21;70,87;3'
    const { linhas } = parseMetasCsv(texto)
    expect(linhas[0].mes).toBe(3)
  })
})
