import { describe, expect, it } from 'vitest'
import { parseLimpaPautaMatriz } from './limpa-pauta-parser'

const HEADER = ['Segmentos', 'Categoria', 'Unidades', 'Status', 'Valor solicitado']

describe('parseLimpaPautaMatriz', () => {
  it('extrai o nome da unidade truncada (prefixo "[SEGMENTO]" e sufixo "- LOG20...")', () => {
    const matriz = [HEADER, ['ARMAZEM', 'QLP ADM', '[ARMAZEM] CDR Bahia - LOG20 L...', 'EM_ANALISE', ' 2,874.72 ']]
    const { linhas, erros } = parseLimpaPautaMatriz(matriz)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { segmento: 'ARMAZEM', categoria: 'QLP ADM', unidadeNomeOriginal: '[ARMAZEM] CDR Bahia - LOG20 L...', unidadeNomeExtraido: 'CDR Bahia', status: 'EM_ANALISE', valor: 2874.72, descricao: '', idFreightech: null },
    ])
  })

  it('lê as colunas Descrição e Id (exportação completa) e a Unidade já vem limpa, sem prefixo nem truncamento', () => {
    const header = ['Id', 'Segmentos', 'Unidades', 'Descrição', 'Status', 'Valor solicitado', 'Categoria']
    const matriz = [header, ['6ac78d1a01e3913b4ef1e765', 'ROTA', 'CDD PRAIA GRANDE', 'Desconto indevido, fora da regra.', 'EM_ANALISE', '21129.94', 'DESCONTOS INDEVIDOS']]
    const { linhas, erros } = parseLimpaPautaMatriz(matriz)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { segmento: 'ROTA', categoria: 'DESCONTOS INDEVIDOS', unidadeNomeOriginal: 'CDD PRAIA GRANDE', unidadeNomeExtraido: 'CDD PRAIA GRANDE', status: 'EM_ANALISE', valor: 21129.94, descricao: 'Desconto indevido, fora da regra.', idFreightech: '6ac78d1a01e3913b4ef1e765' },
    ])
  })

  it('extrai mesmo quando o truncamento corta antes do sufixo "- LOG20"', () => {
    const matriz = [HEADER, ['ARMAZEM', 'QLP ADM', '[ARMAZEM] PONTA GROSSA INTE...', 'CANCELADA_PELO_SOLICITANTE', ' 4,411.23 ']]
    const { linhas } = parseLimpaPautaMatriz(matriz)
    expect(linhas[0].unidadeNomeExtraido).toBe('PONTA GROSSA INTE')
  })

  it('parseia "Valor solicitado" em formato US (vírgula de milhar, ponto decimal), não pt-BR', () => {
    const matriz = [HEADER, ['AS', 'Turnover', '[AS] CDD ARACAJU - LOG20 Lata', 'EM_ANALISE', ' 65,874.41 ']]
    const { linhas } = parseLimpaPautaMatriz(matriz)
    expect(linhas[0].valor).toBe(65874.41)
  })

  it('pula linhas totalmente vazias', () => {
    const matriz = [HEADER, ['', '', '', '', ''], ['AS', 'Turnover', '[AS] CDD ARACAJU - LOG20 Lata', 'EM_ANALISE', ' 100.00 ']]
    const { linhas } = parseLimpaPautaMatriz(matriz)
    expect(linhas).toHaveLength(1)
  })

  it('marca erro de valor inválido sem derrubar o resto do arquivo', () => {
    const matriz = [
      HEADER,
      ['AS', 'Turnover', '[AS] CDD ARACAJU - LOG20 Lata', 'EM_ANALISE', 'abc'],
      ['AS', 'Turnover', '[AS] CDD ARACAJU - LOG20 Lata', 'EM_ANALISE', ' 100.00 '],
    ]
    const { linhas, erros } = parseLimpaPautaMatriz(matriz)
    expect(linhas).toHaveLength(1)
    expect(erros).toHaveLength(1)
  })

  it('marca erro quando falta Status ou Categoria', () => {
    const matriz = [
      HEADER,
      ['AS', '', '[AS] CDD ARACAJU - LOG20 Lata', 'EM_ANALISE', ' 100.00 '],
      ['AS', 'Turnover', '[AS] CDD ARACAJU - LOG20 Lata', '', ' 100.00 '],
    ]
    const { linhas, erros } = parseLimpaPautaMatriz(matriz)
    expect(linhas).toHaveLength(0)
    expect(erros).toHaveLength(2)
  })

  it('retorna erro de cabeçalho quando a coluna Unidades não existe', () => {
    const { erros } = parseLimpaPautaMatriz([['Foo', 'Bar'], ['a', 'b']])
    expect(erros).toEqual(['Cabeçalho não encontrado — esperado colunas Segmentos, Categoria, Unidades, Status e Valor solicitado'])
  })
})
