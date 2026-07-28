import { describe, expect, it } from 'vitest'
import { parseDistribuicaoBiCsv } from './distribuicao-bi-parser'

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
      { indicador: 'aderencia_logon_du', unidade: 'CD FRANCISCO BELTRÃO', negocio: 'CONS', valor: 96 },
      { indicador: 'aderencia_logon_du', unidade: 'CDL CAMAÇARI', negocio: 'ROTA', valor: 83 },
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
      { indicador: 'devolucao_pdv', unidade: 'CDD BELTRAO', negocio: 'CONS', valor: 3.52 },
      { indicador: 'devolucao_pdv', unidade: 'CDD CASCAVEL', negocio: 'CONS', valor: 3.41 },
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

  it('retorna erro de cabeçalho inválido quando falta alguma coluna', () => {
    const { linhas, erros } = parseDistribuicaoBiCsv('INDICADOR;UNIDADE\nADERÊNCIA LOGON;CD LONDRINA')
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseDistribuicaoBiCsv('')).toEqual({ linhas: [], erros: [] })
  })
})
