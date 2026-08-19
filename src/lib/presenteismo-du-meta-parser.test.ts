import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parsePresenteismoDuMetaCsv, parsePresenteismoDuMetaXlsx } from './presenteismo-du-meta-parser'

const HEADER = 'Unidade;Meta'

describe('parsePresenteismoDuMetaCsv', () => {
  it('lê unidade e meta (%)', () => {
    const texto = [
      HEADER,
      'CD FRANCISCO BELTRÃO;3%',
      'CD CASCAVEL;2,5%',
    ].join('\n')
    const { linhas, erros } = parsePresenteismoDuMetaCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'CD FRANCISCO BELTRÃO', valor: 3 },
      { unidade: 'CD CASCAVEL', valor: 2.5 },
    ])
  })

  it('reconhece o cabeçalho em qualquer ordem de coluna', () => {
    const texto = 'Meta;Unidade\n4%;VIDROS PR'
    const { linhas } = parsePresenteismoDuMetaCsv(texto)
    expect(linhas).toEqual([{ unidade: 'VIDROS PR', valor: 4 }])
  })

  it('retorna erro de cabeçalho inválido quando falta Unidade ou Meta', () => {
    const { linhas, erros } = parsePresenteismoDuMetaCsv('Unidade;Outracoisa\nFOZ;10')
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parsePresenteismoDuMetaCsv('')).toEqual({ linhas: [], erros: [] })
  })

  it('aceita o formato histórico (colunas de mês), gerando um registro por mês presente', () => {
    const texto = [
      'Unidade;Jan;Fev;Mar',
      'CD FRANCISCO BELTRÃO;3%;2,5%;2%',
    ].join('\n')
    const { linhas, erros } = parsePresenteismoDuMetaCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'CD FRANCISCO BELTRÃO', valor: 3, mes: 1 },
      { unidade: 'CD FRANCISCO BELTRÃO', valor: 2.5, mes: 2 },
      { unidade: 'CD FRANCISCO BELTRÃO', valor: 2, mes: 3 },
    ])
  })

  it('pula meses em branco no formato histórico, sem gerar erro', () => {
    const texto = ['Unidade;Jan;Fev;Mar', 'CD CASCAVEL;3%;;'].join('\n')
    const { linhas, erros } = parsePresenteismoDuMetaCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([{ unidade: 'CD CASCAVEL', valor: 3, mes: 1 }])
  })

  it('formato histórico com coluna Indicador filtra só linhas de Presenteísmo', () => {
    const texto = [
      'Indicador;Unidade;Jan;Fev',
      'PRESENTEÍSMO AL;CD CASCAVEL;3%;2%',
      'OUTRO INDICADOR;CD CASCAVEL;10%;10%',
    ].join('\n')
    const { linhas, erros } = parsePresenteismoDuMetaCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'CD CASCAVEL', valor: 3, mes: 1 },
      { unidade: 'CD CASCAVEL', valor: 2, mes: 2 },
    ])
  })
})

describe('parsePresenteismoDuMetaXlsx — escolha de aba', () => {
  /** Replica a planilha real de metas do Armazém: T1 e T2 em abas separadas. */
  function arquivoArmazem(): File {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['INDICADOR', 'UNIDADE', 'JUL'],
      ['PRESENTEISMO AL', 'ESTÂNCIA', 0.0048],
      ['PRESENTEISMO AL', 'CDR BAHIA', 0.0217],
    ]), 'RV ARM _T1')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['INDICADOR', 'UNIDADE', 'JUL'],
      ['PRESENTEISMO AL', 'CD CASCAVEL', 0.0113],
      ['PRESENTEISMO AL', 'CD LONDRINA', 0.0213],
    ]), 'RV ARM _T2')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    return new File([buffer], 'Import_RV_ARM - Metas.xlsx')
  }

  it('lê a aba pedida, e não a primeira do arquivo', async () => {
    const { linhas } = await parsePresenteismoDuMetaXlsx(arquivoArmazem(), 'RV ARM _T2')
    expect(linhas.map(l => l.unidade)).toEqual(['CD CASCAVEL', 'CD LONDRINA'])
  })

  it('sem aba informada, mantém o comportamento antigo (primeira aba)', async () => {
    const { linhas } = await parsePresenteismoDuMetaXlsx(arquivoArmazem())
    expect(linhas.map(l => l.unidade)).toEqual(['ESTÂNCIA', 'CDR BAHIA'])
  })

  it('aba inexistente cai na primeira em vez de devolver vazio', async () => {
    const { linhas } = await parsePresenteismoDuMetaXlsx(arquivoArmazem(), 'ABA QUE NÃO EXISTE')
    expect(linhas.map(l => l.unidade)).toEqual(['ESTÂNCIA', 'CDR BAHIA'])
  })
})

