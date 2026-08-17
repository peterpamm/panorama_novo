import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseDisponibilidadeArmazemXlsx } from './disponibilidade-armazem-parser'

function montarArquivoTeste(linhas: Record<string, unknown>[]): File {
  const ws = XLSX.utils.json_to_sheet(linhas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'disp-arm')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new File([buffer], 'disp_armazem_teste.xlsx')
}

describe('parseDisponibilidadeArmazemXlsx', () => {
  it('lê Filial / Disp. Contratado / META quando a coluna de meta existe', async () => {
    const result = await parseDisponibilidadeArmazemXlsx(montarArquivoTeste([
      { Filial: 'Diadema', 'Disp. Contratado': '92,5%', META: '90%' },
    ]))
    expect(result.erros).toEqual([])
    expect(result.temColunaMeta).toBe(true)
    expect(result.linhas[0]).toEqual({ unidadeNome: 'Diadema', real: 92.5, meta: 90 })
  })

  it('sem a coluna META na planilha, meta vem null (não erro) e temColunaMeta é false', async () => {
    const result = await parseDisponibilidadeArmazemXlsx(montarArquivoTeste([
      { Filial: 'Diadema', 'Disp. Contratado': '92,5%' },
    ]))
    expect(result.erros).toEqual([])
    expect(result.temColunaMeta).toBe(false)
    expect(result.linhas[0]).toEqual({ unidadeNome: 'Diadema', real: 92.5, meta: null })
  })

  it('com a coluna META presente, mas vazia numa linha específica, é erro (linha incompleta)', async () => {
    const result = await parseDisponibilidadeArmazemXlsx(montarArquivoTeste([
      { Filial: 'Diadema', 'Disp. Contratado': '92,5%', META: '90%' },
      { Filial: 'Cascavel', 'Disp. Contratado': '80%', META: null },
    ]))
    expect(result.linhas).toHaveLength(1)
    expect(result.erros).toHaveLength(1)
  })

  it('erro quando falta Filial', async () => {
    const result = await parseDisponibilidadeArmazemXlsx(montarArquivoTeste([
      { Filial: '', 'Disp. Contratado': '85%', META: '90%' },
    ]))
    expect(result.linhas).toHaveLength(0)
    expect(result.erros).toHaveLength(1)
  })

  it('ignora linha totalmente em branco', async () => {
    const result = await parseDisponibilidadeArmazemXlsx(montarArquivoTeste([
      { Filial: 'Diadema', 'Disp. Contratado': '85%', META: '90%' },
      { Filial: null, 'Disp. Contratado': null, META: null },
    ]))
    expect(result.linhas).toHaveLength(1)
    expect(result.erros).toEqual([])
  })
})
