import { describe, expect, it } from 'vitest'
import { parsePlanilhaReuniaoMatriz, resolverValorImportado } from './reuniao-planilha-parser'

const HEADER = ['UNIDADE', 'INDICADOR', 'META', 'PESO', 'RESULT', 'PTS']
const TITULO = ['', '', '', '', 'JULHO', '']

describe('parsePlanilhaReuniaoMatriz', () => {
  it('lê unidade, indicador, meta, resultado e pontos, pulando a linha de título acima do cabeçalho', () => {
    const matriz = [
      TITULO,
      HEADER,
      ['CD FOZ DO IGUAÇU', 'DEV PDV', 2.7, 15, 3.1, 0],
      ['CD DIADEMA', 'DEV PDV', 4.4, 15, 4.0, 15],
    ]
    const { linhas, erros } = parsePlanilhaReuniaoMatriz(matriz)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'CD FOZ DO IGUAÇU', indicador: 'DEV PDV', meta: 2.7, resultado: 3.1, pontos: 0 },
      { unidade: 'CD DIADEMA', indicador: 'DEV PDV', meta: 4.4, resultado: 4.0, pontos: 15 },
    ])
  })

  it('pula linhas sem RESULT ou PTS preenchido (ainda não apurado no mês)', () => {
    const matriz = [
      HEADER,
      ['CD ARACAJU', 'DEV PDV', '', 15, '', ''],
      ['CD CASCAVEL', 'DEV PDV', 4.15, 15, 3.9, 15],
    ]
    const { linhas, erros } = parsePlanilhaReuniaoMatriz(matriz)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'CD CASCAVEL', indicador: 'DEV PDV', meta: 4.15, resultado: 3.9, pontos: 15 },
    ])
  })

  it('aceita META em branco (unidade sem meta cadastrada nesse indicador)', () => {
    const matriz = [
      HEADER,
      ['ESTÂNCIA', 'INDISPONIBILIDADE', '', 140, 0, 140],
    ]
    const { linhas, erros } = parsePlanilhaReuniaoMatriz(matriz)
    expect(erros).toEqual([])
    expect(linhas).toEqual([{ unidade: 'ESTÂNCIA', indicador: 'INDISPONIBILIDADE', meta: null, resultado: 0, pontos: 140 }])
  })

  it('reconhece indicadores diferentes por linha (T1 com nome próprio, ex: GTY)', () => {
    const matriz = [
      HEADER,
      ['PONTA GROSSA', 'GTY', 65.6, 15, 70, 15],
    ]
    const { linhas } = parsePlanilhaReuniaoMatriz(matriz)
    expect(linhas).toEqual([{ unidade: 'PONTA GROSSA', indicador: 'GTY', meta: 65.6, resultado: 70, pontos: 15 }])
  })

  it('mantém RESULT/META brutos (número ou fração de dia do Excel) — a conversão certa só acontece depois de saber o formato do indicador', () => {
    const matriz = [
      HEADER,
      ['ESTÂNCIA', 'TEMPO RENDIÇÃO', 0.0625, 15, 0.0625, 15],
    ]
    const { linhas } = parsePlanilhaReuniaoMatriz(matriz)
    expect(linhas).toEqual([{ unidade: 'ESTÂNCIA', indicador: 'TEMPO RENDIÇÃO', meta: 0.0625, resultado: 0.0625, pontos: 15 }])
  })

  it('retorna erro de cabeçalho quando não acha a coluna Unidade', () => {
    const { linhas, erros } = parsePlanilhaReuniaoMatriz([['A', 'B'], ['1', '2']])
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio pra matriz vazia', () => {
    expect(parsePlanilhaReuniaoMatriz([])).toEqual({ linhas: [], erros: [] })
  })

  it('marca erro de pontos inválido sem derrubar o resto do arquivo', () => {
    const matriz = [
      HEADER,
      ['CD CASCAVEL', 'DEV PDV', 4.15, 15, 3.9, 'abc'],
      ['CD FOZ DO IGUAÇU', 'DEV PDV', 2.7, 15, 3.1, 15],
    ]
    const { linhas, erros } = parsePlanilhaReuniaoMatriz(matriz)
    expect(linhas).toEqual([{ unidade: 'CD FOZ DO IGUAÇU', indicador: 'DEV PDV', meta: 2.7, resultado: 3.1, pontos: 15 }])
    expect(erros).toHaveLength(1)
  })
})

describe('resolverValorImportado', () => {
  it('formato numero/percentual/monetario: valor numérico direto', () => {
    expect(resolverValorImportado(3.1, 'numero')).toBe(3.1)
    expect(resolverValorImportado(95, 'percentual')).toBe(95)
    expect(resolverValorImportado('4,15', 'monetario')).toBe(4.15)
  })

  it('formato numero: texto que não é número vira null (não 0,6 nem qualquer outro valor sem nexo)', () => {
    expect(resolverValorImportado('abc', 'numero')).toBeNull()
  })

  it('formato duracao: fração de dia do Excel vira minutos (0,0625 dia = 90min = "01:30")', () => {
    expect(resolverValorImportado(0.0625, 'duracao')).toBe(90)
  })

  it('formato duracao: texto "HH:MM" também vira minutos', () => {
    expect(resolverValorImportado('01:30', 'duracao')).toBe(90)
  })

  it('formato duracao: vazio vira null', () => {
    expect(resolverValorImportado('', 'duracao')).toBeNull()
    expect(resolverValorImportado(null, 'duracao')).toBeNull()
  })
})
