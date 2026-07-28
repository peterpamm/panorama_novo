import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseMetasPerdasXlsx } from './metas-perdas-xlsx-parser'

/** Monta um arquivo .xlsx em memória no formato "ACUMULADO" do print (indicadores nas linhas, unidades nas colunas). */
function montarArquivoTeste(): File {
  const aoa: unknown[][] = [
    ['ACUMULADO', 'CASCAVEL', 'DIADEMA', 'CARAMBEÍ'],
    ['DEVOLUÇÃO', -37559.5, -57200, 0],
    ['INDISPONIBILIDADE', -94067.4, -187715.5, null],
    ['Desconto CIVF', 0, -18276.5, 0],
    ['BNS – Bônus Nível de Serviço', 0, 0, 0],
    ['MULTAS', -1517.88, -685443.48, 0],
    ['Processos Trabalhistas', 0, 0, 0],
    ['SINISTROS DE FROTA', 0, 0, 0],
    ['VALES', -30311.7, -71036.1, 0],
    ['TOTAL', -163456.48, -1019671.58, 0],
    ['FATURAMENTO', 13749030, 42110307, 5076440],
    ['Perdas (sem OC) Acumulado', -0.0119, -0.0242, 0],
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Metas')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new File([buffer], 'metas_perdas_teste.xlsx')
}

describe('parseMetasPerdasXlsx', () => {
  it('lê os 8 indicadores por unidade, ignorando linhas TOTAL/FATURAMENTO/%', async () => {
    const result = await parseMetasPerdasXlsx(montarArquivoTeste())
    expect(result.erros).toEqual([])
    expect(result.indicadores).toHaveLength(8 * 3) // 8 indicadores × 3 unidades

    const devolucaoCascavel = result.indicadores.find(i => i.unidade === 'CASCAVEL' && i.indicador === 'devolucao')
    expect(devolucaoCascavel?.meta_anual).toBeCloseTo(-37559.5)

    const civfDiadema = result.indicadores.find(i => i.unidade === 'DIADEMA' && i.indicador === 'civif')
    expect(civfDiadema?.meta_anual).toBeCloseTo(-18276.5)
  })

  it('célula zerada ou vazia vira meta 0 (não é ignorada)', async () => {
    const result = await parseMetasPerdasXlsx(montarArquivoTeste())
    const indisponibilidadeCarambei = result.indicadores.find(i => i.unidade === 'CARAMBEÍ' && i.indicador === 'indisponibilidade')
    expect(indisponibilidadeCarambei?.meta_anual).toBe(0)
  })

  it('monta o TOTAL (R$) e a meta_pct (%) por unidade a partir das linhas TOTAL e "Perdas (sem OC) Acumulado"', async () => {
    const result = await parseMetasPerdasXlsx(montarArquivoTeste())
    const cascavel = result.totais.find(t => t.unidade === 'CASCAVEL')
    expect(cascavel?.meta_anual).toBeCloseTo(-163456.48)
    expect(cascavel?.meta_pct).toBeCloseTo(-1.19)
  })

  it('ignora a linha FATURAMENTO (não é meta)', async () => {
    const result = await parseMetasPerdasXlsx(montarArquivoTeste())
    expect(result.indicadores.some(i => (i.indicador as string) === 'faturamento')).toBe(false)
  })

  it('reconhece as unidades pela primeira linha, mesmo com nomes fora de ordem alfabética', async () => {
    const result = await parseMetasPerdasXlsx(montarArquivoTeste())
    const unidadesIndicadores = new Set(result.indicadores.map(i => i.unidade))
    expect(unidadesIndicadores).toEqual(new Set(['CASCAVEL', 'DIADEMA', 'CARAMBEÍ']))
  })
})
