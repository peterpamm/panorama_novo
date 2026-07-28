import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseDescontoFrotaCsv, parseDescontoFrotaXlsx } from './desconto-frota-parser'

const HEADER = 'CDD GINFO;CIVF;TT STRESS TEST'

describe('parseDescontoFrotaCsv', () => {
  it('lê unidade, CIVF e TT STRESS TEST', () => {
    const texto = [
      HEADER,
      'FOZ DO IGUAÇU;1.500,00;800,00',
      'CD PETRÓPOLIS;2.000,50;-',
    ].join('\n')
    const { linhas, erros } = parseDescontoFrotaCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'FOZ DO IGUAÇU', civf: 1500, stressTest: 800 },
      { unidade: 'CD PETRÓPOLIS', civf: 2000.5, stressTest: null },
    ])
  })

  it('reconhece o cabeçalho em qualquer ordem de coluna', () => {
    const texto = 'TT STRESS TEST;CDD GINFO;CIVF\n300,00;VIDROS PR;150,00'
    const { linhas } = parseDescontoFrotaCsv(texto)
    expect(linhas).toEqual([{ unidade: 'VIDROS PR', civf: 150, stressTest: 300 }])
  })

  it('retorna erro de cabeçalho inválido quando falta alguma coluna', () => {
    const { linhas, erros } = parseDescontoFrotaCsv('CDD GINFO;CIVF\nFOZ;10')
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseDescontoFrotaCsv('')).toEqual({ linhas: [], erros: [] })
  })
})

describe('parseDescontoFrotaXlsx', () => {
  function montarArquivo(nomesAbas: string[]): File {
    const aoa: unknown[][] = [
      ['CDD GINFO', 'CIVF', 'TT STRESS TEST'],
      ['FOZ DO IGUAÇU', 1500, 800],
    ]
    const wb = XLSX.utils.book_new()
    for (const nome of nomesAbas) {
      const ws = nome === 'Resultado' ? XLSX.utils.aoa_to_sheet(aoa) : XLSX.utils.aoa_to_sheet([['irrelevante']])
      XLSX.utils.book_append_sheet(wb, ws, nome)
    }
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new File([buffer], 'frota_teste.xlsx')
  }

  it('lê especificamente a aba "Resultado", mesmo com outras abas no arquivo', async () => {
    const file = montarArquivo(['Capa', 'Resultado'])
    const { linhas, erros } = await parseDescontoFrotaXlsx(file)
    expect(erros).toEqual([])
    expect(linhas).toEqual([{ unidade: 'FOZ DO IGUAÇU', civf: 1500, stressTest: 800 }])
  })

  it('retorna erro quando o arquivo não tem aba "Resultado"', async () => {
    const file = montarArquivo(['Capa', 'Dados'])
    const { linhas, erros } = await parseDescontoFrotaXlsx(file)
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })
})
