import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseDistribuicaoBiCsv, parseDistribuicaoBiXlsx } from './distribuicao-bi-parser'

const HEADER = 'INDICADOR;UNIDADE;RESULTADO'

describe('parseDistribuicaoBiCsv', () => {
  it('filtra ADERÊNCIA LOGON pro indicador aderencia_logon_du', () => {
    const texto = [
      HEADER,
      'ADERÊNCIA LOGON;CD FRANCISCO BELTRÃO;96%',
      'ADERÊNCIA LOGON;CDL CAMAÇARI;83%',
    ].join('\n')
    const { linhas, erros } = parseDistribuicaoBiCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { indicador: 'aderencia_logon_du', unidade: 'CD FRANCISCO BELTRÃO', negocio: 'CONS', valor: 96, aba: '' },
      { indicador: 'aderencia_logon_du', unidade: 'CDL CAMAÇARI', negocio: 'ROTA', valor: 83, aba: '' },
    ])
  })

  it('filtra DEVOLUÇÃO PDV pro indicador devolucao_pdv, tirando o código numérico da unidade', () => {
    const texto = [
      HEADER,
      'DEVOLUÇÃO PDV;143 - CDD Beltrao;3,52%',
      'DEVOLUÇÃO PDV;348 - CDD Cascavel;3,41%',
    ].join('\n')
    const { linhas } = parseDistribuicaoBiCsv(texto)
    expect(linhas).toEqual([
      { indicador: 'devolucao_pdv', unidade: 'CDD BELTRAO', negocio: 'CONS', valor: 3.52, aba: '' },
      { indicador: 'devolucao_pdv', unidade: 'CDD CASCAVEL', negocio: 'CONS', valor: 3.41, aba: '' },
    ])
  })

  it('mistura os dois indicadores no mesmo arquivo sem confundir um com o outro', () => {
    const texto = [
      HEADER,
      'ADERÊNCIA LOGON;CD LONDRINA;98%',
      'DEVOLUÇÃO PDV;112 - CDD Londrina;2,85%',
    ].join('\n')
    const { linhas } = parseDistribuicaoBiCsv(texto)
    expect(linhas.map(l => l.indicador)).toEqual(['aderencia_logon_du', 'devolucao_pdv'])
  })

  it('ignora linhas de indicador ainda não reconhecido, sem gerar erro', () => {
    const texto = [HEADER, 'OUTRO INDICADOR;CD LONDRINA;50%'].join('\n')
    const { linhas, erros } = parseDistribuicaoBiCsv(texto)
    expect(linhas).toEqual([])
    expect(erros).toEqual([])
  })

  it('sem RESULTADO nem colunas de mês não gera linha (aba de apoio da planilha é ignorada)', () => {
    const { linhas, erros } = parseDistribuicaoBiCsv('INDICADOR;UNIDADE\nADERÊNCIA LOGON;CD LONDRINA')
    expect(linhas).toEqual([])
    expect(erros).toEqual([])
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseDistribuicaoBiCsv('')).toEqual({ linhas: [], erros: [] })
  })
})

describe('parseDistribuicaoBiXlsx — planilha real do RV DU (duas abas)', () => {
  /**
   * Replica o Import_RV_DU.xlsx: a aba do supervisor tem a coluna RESULTADO e
   * NÃO tem LogOn; a do coordenador tem só colunas de mês e é onde o LogOn
   * mora. Ler só a primeira aba deixava o LogOn de fora sem avisar.
   */
  function arquivoRvDu(): File {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['INDICADOR', 'UNIDADE', 'JAN', 'RESULTADO', 'PESO'],
      ['DISPONIBILIDADE', 'CASCAVEL', 0, 'VEM DO DRE', 0.3],
      ['PRESENTEISMO DU', 'CD CASCAVEL', 0.0094, 0.0047, 0.3],
    ]), 'RV DU SUPERV')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['INDICADOR', 'UNIDADE', 'JUN', 'JUL'],
      ['ADERÊNCIA LOGON', 'CD CASCAVEL', 1, 0.62],
      ['ADERÊNCIA LOGON', 'CDL CAMAÇARI', 0.83, 0.85],
    ]), 'RV DU COORD')
    return new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer], 'Import_RV_DU.xlsx')
  }

  it('traz o LogOn da segunda aba, com o mês de cada coluna', async () => {
    const { linhas } = await parseDistribuicaoBiXlsx(arquivoRvDu())
    const logon = linhas.filter(l => l.indicador === 'aderencia_logon_du')
    expect(logon.map(l => [l.unidade, l.mes, l.valor])).toEqual([
      ['CD CASCAVEL', 6, 100],
      ['CD CASCAVEL', 7, 62],
      ['CDL CAMAÇARI', 6, 83],
      ['CDL CAMAÇARI', 7, 85],
    ])
  })

  it('lê a coluna RESULTADO da aba do supervisor sem mês (usa o da tela)', async () => {
    const { linhas } = await parseDistribuicaoBiXlsx(arquivoRvDu())
    const semMes = linhas.filter(l => l.indicador === 'presenteismo_du' && l.mes === undefined)
    expect(semMes).toHaveLength(1)
    expect(semMes[0].valor).toBeCloseTo(0.47)
  })

  it('pula "VEM DO DRE" e demais textos sem virar erro', async () => {
    const { erros } = await parseDistribuicaoBiXlsx(arquivoRvDu())
    expect(erros).toEqual([])
  })
})
