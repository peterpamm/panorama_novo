import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parsePainelPerdasAuxCsv, parsePainelPerdasAuxXlsx } from './painel-perdas-aux-csv-parser'

function arquivoXlsx(linhas: (string | number)[][]): File {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), 'Indisponib Devolucao')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new File([buffer], 'indisponibilidade_devolucao.xlsx')
}

describe('parsePainelPerdasAuxCsv', () => {
  it('lê linhas válidas com os dois indicadores', () => {
    const texto = [
      'INDICADOR;NEGOCIO;ANO;MES;UNIDADE;VALOR',
      'Indisponibilidade;CONS;2025;1;DIADEMA;-1.234,56',
      'Devolução;CONS;2025;1;DIADEMA;-567,89',
    ].join('\n')
    const { linhas, erros } = parsePainelPerdasAuxCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'DIADEMA', ano: 2025, mes: 1, indicador: 'indisponibilidade', valor: -1234.56 },
      { unidade: 'DIADEMA', ano: 2025, mes: 1, indicador: 'devolucao',         valor: -567.89 },
    ])
  })

  it('header é case-insensitive', () => {
    const texto = 'indicador;negocio;ano;mes;unidade;valor\nIndisponibilidade;CONS;2025;3;FOZ;-100,00'
    const { linhas } = parsePainelPerdasAuxCsv(texto)
    expect(linhas).toHaveLength(1)
    expect(linhas[0].indicador).toBe('indisponibilidade')
  })

  it('ignora linha com indicador desconhecido, reporta erro, continua', () => {
    const texto = [
      'INDICADOR;NEGOCIO;ANO;MES;UNIDADE;VALOR',
      'Desconhecido;CONS;2025;1;FOZ;-100',
      'Devolução;CONS;2025;1;FOZ;-200',
    ].join('\n')
    const { linhas, erros } = parsePainelPerdasAuxCsv(texto)
    expect(erros).toHaveLength(1)
    expect(linhas).toHaveLength(1)
    expect(linhas[0].indicador).toBe('devolucao')
  })

  it('retorna erro de cabeçalho inválido quando falta coluna', () => {
    const { linhas, erros } = parsePainelPerdasAuxCsv('INDICADOR;ANO;MES;UNIDADE;VALOR\nIndisponibilidade;2025;1;FOZ;-100')
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parsePainelPerdasAuxCsv('')).toEqual({ linhas: [], erros: [] })
  })

  it('ignora linha com número de colunas inválido', () => {
    const texto = [
      'INDICADOR;NEGOCIO;ANO;MES;UNIDADE;VALOR',
      'Indisponibilidade;CONS;2025;1',
      'Devolução;CONS;2025;2;RIO;-50,00',
    ].join('\n')
    const { linhas, erros } = parsePainelPerdasAuxCsv(texto)
    expect(erros).toHaveLength(1)
    expect(linhas).toHaveLength(1)
  })
})

describe('parsePainelPerdasAuxXlsx', () => {
  it('lê linhas válidas com VALOR como número nativo da célula (não passa por parseNumeroPtBr em texto com ponto)', async () => {
    const file = arquivoXlsx([
      ['INDICADOR', 'NEGOCIO', 'ANO', 'MES', 'UNIDADE', 'VALOR'],
      ['Indisponibilidade', 'CONS', 2025, 1, 'DIADEMA', -1234.56],
      ['Devolução', 'CONS', 2025, 1, 'DIADEMA', -567.89],
    ])
    const { linhas, erros } = await parsePainelPerdasAuxXlsx(file)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'DIADEMA', ano: 2025, mes: 1, indicador: 'indisponibilidade', valor: -1234.56 },
      { unidade: 'DIADEMA', ano: 2025, mes: 1, indicador: 'devolucao', valor: -567.89 },
    ])
  })

  it('também aceita VALOR como texto com vírgula decimal (célula formatada como texto na planilha)', async () => {
    const file = arquivoXlsx([
      ['INDICADOR', 'NEGOCIO', 'ANO', 'MES', 'UNIDADE', 'VALOR'],
      ['Indisponibilidade', 'CONS', 2025, 3, 'FOZ', '-100,00'],
    ])
    const { linhas } = await parsePainelPerdasAuxXlsx(file)
    expect(linhas).toEqual([{ unidade: 'FOZ', ano: 2025, mes: 3, indicador: 'indisponibilidade', valor: -100 }])
  })

  it('ignora linhas em branco no meio ou no fim da planilha', async () => {
    const file = arquivoXlsx([
      ['INDICADOR', 'NEGOCIO', 'ANO', 'MES', 'UNIDADE', 'VALOR'],
      ['Indisponibilidade', 'CONS', 2025, 1, 'FOZ', -100],
      [],
      ['Devolução', 'CONS', 2025, 2, 'FOZ', -200],
      [],
    ])
    const { linhas, erros } = await parsePainelPerdasAuxXlsx(file)
    expect(erros).toEqual([])
    expect(linhas).toHaveLength(2)
  })

  it('header é case-insensitive, igual o .csv', async () => {
    const file = arquivoXlsx([
      ['indicador', 'negocio', 'ano', 'mes', 'unidade', 'valor'],
      ['Devolução', 'CONS', 2025, 1, 'FOZ', -50],
    ])
    const { linhas } = await parsePainelPerdasAuxXlsx(file)
    expect(linhas[0].indicador).toBe('devolucao')
  })
})
