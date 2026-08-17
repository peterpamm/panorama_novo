import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseDisponibilidadeRotaXlsx } from './disponibilidade-rota-parser'

function montarArquivoTeste(linhas: Record<string, unknown>[]): File {
  const ws = XLSX.utils.json_to_sheet(linhas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'disp')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new File([buffer], 'disp_rota_teste.xlsx')
}

describe('parseDisponibilidadeRotaXlsx', () => {
  it('lê Unidade / % Disp / Meta com sinal de percentual', async () => {
    const result = await parseDisponibilidadeRotaXlsx(montarArquivoTeste([
      { Unidade: 'Diadema', '% Disp': '92,5%', Meta: '90%' },
    ]))
    expect(result.erros).toEqual([])
    expect(result.linhas[0]).toEqual({ unidadeNome: 'Diadema', real: 92.5, meta: 90 })
  })

  it('aceita número puro já na escala de percentual (85 = 85%)', async () => {
    const result = await parseDisponibilidadeRotaXlsx(montarArquivoTeste([
      { Unidade: 'Diadema', '% Disp': 85, Meta: 90 },
    ]))
    expect(result.linhas[0]).toMatchObject({ real: 85, meta: 90 })
  })

  it('normaliza fração (0,85) pra escala de percentual (85)', async () => {
    const result = await parseDisponibilidadeRotaXlsx(montarArquivoTeste([
      { Unidade: 'Diadema', '% Disp': 0.85, Meta: 0.9 },
    ]))
    expect(result.linhas[0]).toMatchObject({ real: 85, meta: 90 })
  })

  it('erro quando falta Unidade', async () => {
    const result = await parseDisponibilidadeRotaXlsx(montarArquivoTeste([
      { Unidade: '', '% Disp': '85%', Meta: '90%' },
    ]))
    expect(result.linhas).toHaveLength(0)
    expect(result.erros).toHaveLength(1)
  })

  it('erro quando falta % Disp ou Meta', async () => {
    const result = await parseDisponibilidadeRotaXlsx(montarArquivoTeste([
      { Unidade: 'Diadema', '% Disp': null, Meta: '90%' },
    ]))
    expect(result.linhas).toHaveLength(0)
    expect(result.erros).toHaveLength(1)
  })

  it('ignora linha totalmente em branco', async () => {
    const result = await parseDisponibilidadeRotaXlsx(montarArquivoTeste([
      { Unidade: 'Diadema', '% Disp': '85%', Meta: '90%' },
      { Unidade: null, '% Disp': null, Meta: null },
    ]))
    expect(result.linhas).toHaveLength(1)
    expect(result.erros).toEqual([])
  })

  it('pega a coluna "% Disp" mesmo com "Disp" (volume, coluna diferente) também presente na planilha real', async () => {
    // Planilha real: Unidade | Esperada | Disp | GAP | % Disp | Meta | % Disp LY
    const result = await parseDisponibilidadeRotaXlsx(montarArquivoTeste([
      { Unidade: '216 - CDD Diadema', Esperada: 14799, Disp: 14200, GAP: 599, '% Disp': '96,0%', Meta: '92,9%', '% Disp LY': '90,7%' },
    ]))
    expect(result.erros).toEqual([])
    expect(result.linhas[0]).toMatchObject({ real: 96, meta: 92.9 })
  })
})
