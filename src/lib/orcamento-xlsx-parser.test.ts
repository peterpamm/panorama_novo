import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseOrcamentoWorkbook } from './orcamento-xlsx-parser'

/** Monta uma aba ORÇ_XXX_RT mínima, só com o bloco TOTAL, pra não precisar de mês nenhum. */
function abaOrcamentoMinima(): unknown[][] {
  return [
    ['DEMONSTRATIVO DE RESULTADOS'],
    [],
    ['UNIDADES SELECIONADAS: TESTE ROTA'],
    [],
    [],
    [],
    ['CONTA', 'TOTAL (30 DIAS UTEIS)', null, null],
    [null, 'ORÇADO', 'AV', 'AH'],
    ['001 | ( = ) RECEITA LÍQUIDA', '1.000,00', '100,00', '0,00'],
  ]
}

/** Monta o workbook completo: 1 aba ORÇ_XXX_RT + a aba INPUTS, com a tabela "UNIDADE" começando na coluna informada (0 = coluna A, 1 = coluna B). */
function montarWorkbook(colUnidade: 0 | 1): File {
  const prefixo = colUnidade === 1 ? [null] : []
  const inputsAoa: unknown[][] = [
    [...prefixo, 'TABELA DADOS ORÇADO'],
    [...prefixo, 'UNIDADE', 'ROTA', 'ARMAZÉM', 'EMPURRADA', 'TOTAL'],
    [...prefixo, 'CDD TESTE', 'ORÇ_TST_RT', null, null, null],
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaOrcamentoMinima()), 'ORÇ_TST_RT')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inputsAoa), 'INPUTS')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new File([buffer], 'orcamento_teste.xlsx')
}

describe('parseOrcamentoWorkbook', () => {
  it('lê a aba INPUTS no layout antigo (UNIDADE na coluna B, com uma coluna em branco antes)', async () => {
    const resultado = await parseOrcamentoWorkbook(montarWorkbook(1))
    expect(resultado.codigosNaoMapeados).toEqual([])
    expect(resultado.sheets).toHaveLength(1)
    expect(resultado.sheets[0].unidadeNome).toBe('CDD TESTE')
  })

  it('lê a aba INPUTS no layout novo (UNIDADE já na coluna A, sem coluna em branco antes) — caso das planilhas de unidades novas', async () => {
    const resultado = await parseOrcamentoWorkbook(montarWorkbook(0))
    expect(resultado.codigosNaoMapeados).toEqual([])
    expect(resultado.sheets).toHaveLength(1)
    expect(resultado.sheets[0].unidadeNome).toBe('CDD TESTE')
  })

  it('lê o template novo de sub-colunas (ORÇADO/REALIZADO/AVO (%)/AHO (%)) das unidades onboardadas já na numeração nativa do DRE', async () => {
    const aba: unknown[][] = [
      ['DEMONSTRATIVO DE RESULTADOS'],
      [],
      ['UNIDADES SELECIONADAS: TESTE ROTA'],
      [],
      [],
      [],
      ['CONTA', 'MAIO/2026 (30 DIAS UTEIS)', null, null, null],
      [null, 'ORÇADO', 'REALIZADO', 'AVO (%)', 'AHO (%)'],
      ['233 | ( = ) EBITDA', '65.372,06', '-37.990,60', '8,07', '0,00'],
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aba), 'ORÇ_TST_RT')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['TABELA DADOS ORÇADO'],
      ['UNIDADE', 'ROTA', 'ARMAZÉM', 'EMPURRADA', 'TOTAL'],
      ['CDD TESTE', 'ORÇ_TST_RT', null, null, null],
    ]), 'INPUTS')
    const file = new File([XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })], 'orcamento_novo.xlsx')

    const resultado = await parseOrcamentoWorkbook(file)
    expect(resultado.erros).toEqual([])
    expect(resultado.sheets[0].linhas).toEqual([
      { conta_codigo: '233', conta_nome: '( = ) EBITDA', mes: 5, orcado: 65372.06, av: 8.07, ah: 0 },
    ])
  })
})
