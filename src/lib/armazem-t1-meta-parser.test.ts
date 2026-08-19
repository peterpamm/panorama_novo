import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseArmazemMetasXlsx, parseArmazemT1MetaCsv, parseArmazemT1MetaXlsx } from './armazem-t1-meta-parser'

const HEADER_META = 'INDICADOR;UNIDADE;META'

describe('parseArmazemT1MetaCsv — formato META', () => {
  it('converte TMA de "HH:MM" pra minutos totais', () => {
    const texto = [HEADER_META, 'TMA;CDR BAHIA;01:40'].join('\n')
    const { linhas, erros } = parseArmazemT1MetaCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([{ indicador: 'tma', unidade: 'CDR BAHIA', valor: 100 }])
  })

  it('reconhece Disponibilidade de Gente e Presenteísmo AL como percentual, tirando o código numérico da unidade', () => {
    const texto = [
      HEADER_META,
      'DISPONIBILIDADE DE GENTE;143 - Estância;92,5%',
      'PRESENTEÍSMO AL;143 - Estância;3,2%',
    ].join('\n')
    const { linhas } = parseArmazemT1MetaCsv(texto)
    expect(linhas).toEqual([
      { indicador: 'disponibilidade_gente', unidade: 'ESTÂNCIA', valor: 92.5 },
      { indicador: 'presenteismo_al', unidade: 'ESTÂNCIA', valor: 3.2 },
    ])
  })

  it('ignora linhas de indicador ainda não reconhecido, sem gerar erro', () => {
    const texto = [HEADER_META, 'OUTRO INDICADOR;ESTÂNCIA;50%'].join('\n')
    const { linhas, erros } = parseArmazemT1MetaCsv(texto)
    expect(linhas).toEqual([])
    expect(erros).toEqual([])
  })

  it('retorna erro de cabeçalho inválido quando falta META e não tem coluna de mês', () => {
    const { linhas, erros } = parseArmazemT1MetaCsv('INDICADOR;UNIDADE\nTMA;ESTÂNCIA')
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseArmazemT1MetaCsv('')).toEqual({ linhas: [], erros: [] })
  })
})

describe('parseArmazemT1MetaCsv — formato histórico (colunas de mês)', () => {
  it('gera um registro por mês presente, marcando o campo mes em cada linha', () => {
    const texto = [
      'INDICADOR;UNIDADE;JAN;FEV',
      'TMA;ESTÂNCIA;01:40;01:35',
    ].join('\n')
    const { linhas, erros } = parseArmazemT1MetaCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { indicador: 'tma', unidade: 'ESTÂNCIA', valor: 100, mes: 1 },
      { indicador: 'tma', unidade: 'ESTÂNCIA', valor: 95, mes: 2 },
    ])
  })

  it('pula meses em branco (ainda não fechados) sem gerar erro', () => {
    const texto = [
      'INDICADOR;UNIDADE;JAN;FEV',
      'DISPONIBILIDADE DE GENTE;ESTÂNCIA;90%;',
    ].join('\n')
    const { linhas, erros } = parseArmazemT1MetaCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([{ indicador: 'disponibilidade_gente', unidade: 'ESTÂNCIA', valor: 90, mes: 1 }])
  })
})

describe('parseArmazemT1MetaXlsx — escolha de aba', () => {
  /** Replica a planilha real de metas do Armazém: T1 e T2 em abas separadas. */
  function arquivoArmazem(): File {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['INDICADOR', 'UNIDADE', 'JUL'],
      ['TMA', 'ESTÂNCIA', '01:40'],
      ['PRESENTEISMO AL', 'CDR BAHIA', 0.0217],
    ]), 'RV ARM _T1')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['INDICADOR', 'UNIDADE', 'JUL'],
      ['PRESENTEISMO AL', 'CD CASCAVEL', 0.0113],
    ]), 'RV ARM _T2')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    return new File([buffer], 'Import_RV_ARM - Metas.xlsx')
  }

  it('lê a aba do T1 quando pedida', async () => {
    const { linhas } = await parseArmazemT1MetaXlsx(arquivoArmazem(), 'RV ARM _T1')
    expect(linhas.map(l => l.unidade)).toEqual(['ESTÂNCIA', 'CDR BAHIA'])
  })

  it('lendo a aba do T2 por engano, traz as unidades do T2 (é o que o seletor evita)', async () => {
    const { linhas } = await parseArmazemT1MetaXlsx(arquivoArmazem(), 'RV ARM _T2')
    expect(linhas.map(l => l.unidade)).toEqual(['CD CASCAVEL'])
  })

  it('sem aba informada, mantém o comportamento antigo (primeira aba)', async () => {
    const { linhas } = await parseArmazemT1MetaXlsx(arquivoArmazem())
    expect(linhas.map(l => l.unidade)).toEqual(['ESTÂNCIA', 'CDR BAHIA'])
  })
})

describe('parseArmazemMetasXlsx — lê todas as abas de uma vez', () => {
  function arquivoArmazem(): File {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['INDICADOR', 'UNIDADE', 'JUL'],
      ['TMA', 'ESTÂNCIA', '01:40'],
      ['PRESENTEISMO AL', 'CDR BAHIA', 0.0217],
    ]), 'RV ARM _T1')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['INDICADOR', 'UNIDADE', 'JUL'],
      ['PRESENTEISMO AL', 'CD CASCAVEL', 0.0113],
    ]), 'RV ARM _T2')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    return new File([buffer], 'Import_RV_ARM - Metas.xlsx')
  }

  it('traz as linhas das duas abas, cada uma com seu tier', async () => {
    const { linhas, erros } = await parseArmazemMetasXlsx(arquivoArmazem())
    expect(erros).toEqual([])
    expect(linhas.map(l => [l.unidade, l.tier])).toEqual([
      ['ESTÂNCIA', 'T1'],
      ['CDR BAHIA', 'T1'],
      ['CD CASCAVEL', 'T2'],
    ])
  })

  it('ignora aba sem o cabeçalho esperado, sem virar erro', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['bla'], ['apoio']]), 'Auxiliar')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['INDICADOR', 'UNIDADE', 'JUL'],
      ['PRESENTEISMO AL', 'CD CASCAVEL', 0.0113],
    ]), 'RV ARM _T2')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const { linhas, erros } = await parseArmazemMetasXlsx(new File([buffer], 'metas.xlsx'))
    expect(erros).toEqual([])
    expect(linhas.map(l => l.unidade)).toEqual(['CD CASCAVEL'])
  })
})

describe('parseArmazemT1MetaXlsx — TMA com formato de célula "00:00" (mesmo bug do resultado)', () => {
  it('lê o valor pelo texto formatado da célula, não pela fração de dia bruta', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['INDICADOR', 'UNIDADE', 'JUL'],
      ['TMA', 'ESTÂNCIA', 0],
    ])
    // Mesmo defeito de origem do arquivo de resultado: inteiro HHMM (131) com
    // formato customizado "00:00", exibido como "01:31" — não é fração do dia.
    ws['C2'] = { t: 'n', v: 131, z: '00\\:00' }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'RV ARM _T1')
    const arquivo = new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer], 'Metas.xlsx')

    const { linhas, erros } = await parseArmazemT1MetaXlsx(arquivo, 'RV ARM _T1')
    expect(erros).toEqual([])
    expect(linhas[0].valor).toBe(91) // 1h31 = 91 min — não 131 * 1440 = 188640
  })
})
