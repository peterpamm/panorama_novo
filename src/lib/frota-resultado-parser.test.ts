import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseFrotaResultadoCsv, parseFrotaResultadoXlsx } from './frota-resultado-parser'

const HEADER = 'CDD GINFO;CIVF;TT STRESS TEST'
const HEADER_COMPLETO = 'CDD GINFO;TIER;NEGOCIO;TT STRESS TEST;CIVF;ADERENCIA MM;INDSP MANUT;DISP. EMPILHADEIRA;ADERENCIA CHECKLIST'

describe('parseFrotaResultadoCsv', () => {
  it('lê unidade, CIVF e TT STRESS TEST — colunas novas ausentes viram null', () => {
    const texto = [
      HEADER,
      'FOZ DO IGUAÇU;1.500,00;800,00',
      'CD PETRÓPOLIS;2.000,50;-',
    ].join('\n')
    const { linhas, erros } = parseFrotaResultadoCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'FOZ DO IGUAÇU', civf: 1500, stressTest: 800, dispEmpilhadeira: null, adMilimetragem: null, indispManutencao: null, adChecklist: null },
      { unidade: 'CD PETRÓPOLIS', civf: 2000.5, stressTest: null, dispEmpilhadeira: null, adMilimetragem: null, indispManutencao: null, adChecklist: null },
    ])
  })

  it('reconhece o cabeçalho em qualquer ordem de coluna', () => {
    const texto = 'TT STRESS TEST;CDD GINFO;CIVF\n300,00;VIDROS PR;150,00'
    const { linhas } = parseFrotaResultadoCsv(texto)
    expect(linhas[0]).toMatchObject({ unidade: 'VIDROS PR', civf: 150, stressTest: 300 })
  })

  it('retorna erro de cabeçalho inválido quando falta alguma coluna', () => {
    const { linhas, erros } = parseFrotaResultadoCsv('CDD GINFO;CIVF\nFOZ;10')
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseFrotaResultadoCsv('')).toEqual({ linhas: [], erros: [] })
  })

  it('lê CIVF/TT STRESS TEST (R$) e as 4 colunas de % como texto — direto, sem multiplicar (só número puro do Excel binário passa pela conversão de fração, ver describe abaixo) —, com "N/A" virando null', () => {
    const texto = [
      HEADER_COMPLETO,
      'ESTANCIA EMPURRADA;1;CONS;N/A;N/A;51,11;23,31;N/A;94,74',
      'CDR BAHIA;1;ARM;N/A;N/A;100;N/A;1;93,41',
    ].join('\n')
    const { linhas } = parseFrotaResultadoCsv(texto)
    expect(linhas[0]).toEqual({
      unidade: 'ESTANCIA EMPURRADA', civf: null, stressTest: null,
      dispEmpilhadeira: null, adMilimetragem: 51.11, indispManutencao: 23.31, adChecklist: 94.74,
    })
    expect(linhas[1]).toEqual({
      unidade: 'CDR BAHIA', civf: null, stressTest: null,
      dispEmpilhadeira: 1, adMilimetragem: 100, indispManutencao: null, adChecklist: 93.41,
    })
  })
})

describe('parseFrotaResultadoXlsx', () => {
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
    const { linhas, erros } = await parseFrotaResultadoXlsx(file)
    expect(erros).toEqual([])
    expect(linhas[0]).toMatchObject({ unidade: 'FOZ DO IGUAÇU', civf: 1500, stressTest: 800 })
  })

  it('retorna erro quando o arquivo não tem aba "Resultado"', async () => {
    const file = montarArquivo(['Capa', 'Dados'])
    const { linhas, erros } = await parseFrotaResultadoXlsx(file)
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('célula de % do Excel binário vem como fração (0,5111 = 51,11%) — precisa multiplicar por 100, mesma pegadinha da célula de duração', async () => {
    const aoa: unknown[][] = [
      ['CDD GINFO', 'TIER', 'NEGOCIO', 'TT STRESS TEST', 'CIVF', 'ADERENCIA MM', 'INDSP MANUT', 'DISP. EMPILHADEIRA', 'ADERENCIA CHECKLIST'],
      ['ESTANCIA EMPURRADA', 1, 'CONS', 'N/A', 'N/A', 0.5111111111111111, 0.23310594512195146, 'N/A', 0.9474393530997305],
      ['CDR BAHIA', 1, 'ARM', 'N/A', 'N/A', 1, 'N/A', 1, 0.9341317365269461],
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'RESULTADO')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const file = new File([buffer], 'frota_teste.xlsx')

    const { linhas } = await parseFrotaResultadoXlsx(file)
    expect(linhas[0]).toEqual({
      unidade: 'ESTANCIA EMPURRADA', civf: null, stressTest: null,
      dispEmpilhadeira: null, adMilimetragem: 51.11, indispManutencao: 23.31, adChecklist: 94.74,
    })
    expect(linhas[1]).toEqual({
      unidade: 'CDR BAHIA', civf: null, stressTest: null,
      dispEmpilhadeira: 100, adMilimetragem: 100, indispManutencao: null, adChecklist: 93.41,
    })
  })
})
