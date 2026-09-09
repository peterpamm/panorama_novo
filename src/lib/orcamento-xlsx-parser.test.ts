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
})
