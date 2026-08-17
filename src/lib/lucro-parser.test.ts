import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseLucroXlsx } from './lucro-parser'

/** Monta um arquivo .xlsx em memória no formato real da planilha "lucro" da Ambev (colunas nomeadas). */
function montarArquivoTeste(linhas: Record<string, unknown>[]): File {
  const ws = XLSX.utils.json_to_sheet(linhas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'lucro')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new File([buffer], 'lucro_teste.xlsx')
}

const LINHA_BASE = {
  'Vigencia': 'ROTA_2_1_2026',
  'Unidade - CNPJ': '56227356018693',
  'Unidade - Nome': 'CDD CASCAVEL',
  'Volume Atual': 15078.59,
  'Volume Ano Anterior': 0,
  'R$/HL': 3.24,
  ' Lucro ': 48854.63,
}

describe('parseLucroXlsx', () => {
  it('lê negócio, mês e ano de "Vigencia" (ex: ROTA_2_1_2026 → ROTA, mês 1, ano 2026)', async () => {
    const result = await parseLucroXlsx(montarArquivoTeste([LINHA_BASE]))
    expect(result.erros).toEqual([])
    expect(result.linhas).toHaveLength(1)
    expect(result.linhas[0]).toMatchObject({
      unidadeNome: 'CDD CASCAVEL',
      negocio: 'ROTA',
      mes: 1,
      ano: 2026,
      volume: 15078.59,
      valorHl: 3.24,
      lucro: 48854.63,
    })
  })

  it('reconhece negócio "AS" (Vigencia com outro prefixo)', async () => {
    const result = await parseLucroXlsx(montarArquivoTeste([{ ...LINHA_BASE, Vigencia: 'AS_2_3_2026' }]))
    expect(result.linhas[0].negocio).toBe('AS')
    expect(result.linhas[0].mes).toBe(3)
  })

  it('lê a planilha do AS, com nomes de coluna diferentes pros mesmos dados (volumeAtual/reaisPorHectolitro/lucro)', async () => {
    const linhaAs = {
      'Vigencia': 'AS_2_3_2026',
      'Unidade - Nome': 'CDD DIADEMA',
      'volumeAtual': 49675.2,
      'reaisPorHectolitro': 2.42,
      'lucro': 120213.97,
    }
    const result = await parseLucroXlsx(montarArquivoTeste([linhaAs]))
    expect(result.erros).toEqual([])
    expect(result.linhas[0]).toMatchObject({
      unidadeNome: 'CDD DIADEMA',
      negocio: 'AS',
      mes: 3,
      ano: 2026,
      volume: 49675.2,
      valorHl: 2.42,
      lucro: 120213.97,
    })
  })

  it('usa o Lucro da planilha (não recalcula Volume × R$/HL) — evita diferença de arredondamento', async () => {
    // R$/HL exibido (3.24) × volume não bate exatamente com o Lucro oficial da Ambev (mesmo padrão visto na planilha real).
    const result = await parseLucroXlsx(montarArquivoTeste([{ ...LINHA_BASE, 'R$/HL': 2.42, ' Lucro ': 120213.97 }]))
    expect(result.linhas[0].lucro).toBeCloseTo(120213.97)
  })

  it('erro quando "Vigencia" não casa o padrão esperado', async () => {
    const result = await parseLucroXlsx(montarArquivoTeste([{ ...LINHA_BASE, Vigencia: 'MARÇO/2026' }]))
    expect(result.linhas).toHaveLength(0)
    expect(result.erros).toHaveLength(1)
    expect(result.erros[0]).toContain('Vigencia')
  })

  it('erro quando falta "Unidade - Nome"', async () => {
    const result = await parseLucroXlsx(montarArquivoTeste([{ ...LINHA_BASE, 'Unidade - Nome': '' }]))
    expect(result.linhas).toHaveLength(0)
    expect(result.erros).toHaveLength(1)
    expect(result.erros[0]).toContain('Unidade')
  })

  it('ignora linha totalmente em branco sem gerar erro', async () => {
    const result = await parseLucroXlsx(montarArquivoTeste([LINHA_BASE, { 'Unidade - Nome': null, Vigencia: null }]))
    expect(result.linhas).toHaveLength(1)
    expect(result.erros).toEqual([])
  })
})
