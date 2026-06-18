import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseDreXlsx } from './dre-xlsx-parser'

/** Monta um arquivo .xlsx em memória com a mesma estrutura do relatório do GInfo (versão reduzida, 2 meses + total). */
function montarArquivoDreTeste(): File {
  const aoa: unknown[][] = [
    ['DEMONSTRATIVO DE RESULTADOS'],
    [],
    ['UNIDADES SELECIONADAS: FOZ ROTA'],
    [],
    [],
    [],
    ['CONTA', 'JANEIRO/2025 (30 DIAS UTEIS)', null, null, null, 'FEVEREIRO/2025 (28 DIAS UTEIS)', null, null, null, 'TOTAL (58 DIAS UTEIS)', null, null, null],
    [null, 'REMUNERADO', 'REALIZADO', 'DIFERENCA', 'AVR (%)', 'REMUNERADO', 'REALIZADO', 'DIFERENCA', 'AVR (%)', 'REMUNERADO', 'REALIZADO', 'DIFERENCA', 'AVR (%)'],
    ['001 | ( = ) RECEITA LÍQUIDA', '1.249.519,05', '1.252.522,80', '3.003,75', '100,00', '1.250.523,77', '1.254.443,71', '3.919,94', '100,00', '2.500.042,82', '2.506.966,51', '6.923,69', '100,00'],
    ['021 | ( - ) CUSTOS OPERACIONAIS', '-975.993,99', '-974.827,03', '1.166,96', '-77,83', '-980.000,00', '-979.000,00', '1.000,00', '-78,00', '-1.955.993,99', '-1.953.827,03', '2.166,96', '-77,91'],
    ['273 | ', null, null, null, null, null, null, null, null, null, null, null, null],
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'DRE')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new File([buffer], 'DRE_teste.xlsx')
}

describe('parseDreXlsx', () => {
  it('detecta os blocos de mês presentes (jan, fev, total) dinamicamente', async () => {
    const file = montarArquivoDreTeste()
    const result = await parseDreXlsx(file)
    expect(result.blocosDetectados).toEqual(['jan', 'fev', 'total'])
  })

  it('extrai o código da conta a partir de "NNN | descrição"', async () => {
    const file = montarArquivoDreTeste()
    const result = await parseDreXlsx(file)
    const codigos = result.linhas.map(l => l.conta_codigo)
    expect(codigos).toEqual(['001', '021'])
  })

  it('ignora linhas separadoras sem código de 3 dígitos (ex: "273 | ")', async () => {
    const file = montarArquivoDreTeste()
    const result = await parseDreXlsx(file)
    expect(result.linhas.find(l => l.conta_codigo === '273')).toBeUndefined()
  })

  it('converte os números pt-BR e monta as colunas jan_/fev_/total_ corretamente', async () => {
    const file = montarArquivoDreTeste()
    const result = await parseDreXlsx(file)
    const conta021 = result.linhas.find(l => l.conta_codigo === '021')!
    expect(conta021.campos.jan_remunerado).toBeCloseTo(-975993.99, 2)
    expect(conta021.campos.jan_realizado).toBeCloseTo(-974827.03, 2)
    expect(conta021.campos.jan_diferenca).toBeCloseTo(1166.96, 2)
    expect(conta021.campos.jan_avr).toBeCloseTo(-77.83, 2)
    expect(conta021.campos.fev_realizado).toBeCloseTo(-979000.00, 2)
    expect(conta021.campos.total_realizado).toBeCloseTo(-1953827.03, 2)
  })

  it('lança erro se não encontrar a linha de cabeçalho "CONTA"', async () => {
    const ws = XLSX.utils.aoa_to_sheet([['nada aqui']])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'DRE')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const file = new File([buffer], 'invalido.xlsx')
    await expect(parseDreXlsx(file)).rejects.toThrow()
  })
})

/** Variante com bloco de 5 colunas (REMUNERADO/REALIZADO/DIFERENCA/AVO/AVR) — formato mais novo do GInfo, com a meta mensal por conta (AVO). */
function montarArquivoDreComAvo(): File {
  const aoa: unknown[][] = [
    ['DEMONSTRATIVO DE RESULTADOS'],
    [],
    ['UNIDADES SELECIONADAS: LITORAL'],
    [],
    [],
    [],
    ['CONTA', 'JANEIRO/2026 (20 DIAS UTEIS)', null, null, null, null, 'TOTAL (20 DIAS UTEIS)', null, null, null, null],
    [null, 'REMUNERADO', 'REALIZADO', 'DIFERENCA', 'AVO (%)', 'AVR (%)', 'REMUNERADO', 'REALIZADO', 'DIFERENCA', 'AVO (%)', 'AVR (%)'],
    ['232 | ( = ) EBITDA', '300.000,00', '217.729,97', '-82.270,03', '15,00', '13,96', '300.000,00', '217.729,97', '-82.270,03', '15,00', '13,96'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'DRE')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new File([buffer], 'DRE_avo_teste.xlsx')
}

describe('parseDreXlsx com bloco de 5 colunas (AVO + AVR)', () => {
  it('separa AVO (meta por conta) de AVR (realizado) corretamente, mesmo com blocos de largura diferente', async () => {
    const file = montarArquivoDreComAvo()
    const result = await parseDreXlsx(file)
    const conta232 = result.linhas.find(l => l.conta_codigo === '232')!
    expect(conta232.campos.jan_avo).toBeCloseTo(15.00, 2)
    expect(conta232.campos.jan_avr).toBeCloseTo(13.96, 2)
    expect(conta232.campos.total_avo).toBeCloseTo(15.00, 2)
    expect(conta232.campos.total_avr).toBeCloseTo(13.96, 2)
  })

  it('não confunde o início do próximo bloco mesmo com largura de 5 colunas', async () => {
    const file = montarArquivoDreComAvo()
    const result = await parseDreXlsx(file)
    expect(result.blocosDetectados).toEqual(['jan', 'total'])
    const conta232 = result.linhas.find(l => l.conta_codigo === '232')!
    expect(conta232.campos.jan_realizado).toBeCloseTo(217729.97, 2)
    expect(conta232.campos.total_realizado).toBeCloseTo(217729.97, 2)
  })
})
