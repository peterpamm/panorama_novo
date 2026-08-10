import { describe, expect, it } from 'vitest'
import { parseEncontroContasMatriz } from './encontro-contas-parser'

const HEADER = ['DATA', 'DESCRICAO', 'VALOR']

describe('parseEncontroContasMatriz', () => {
  it('extrai número do chamado e solicitante da descrição no padrão "EC - <chamado> - <nome>"', () => {
    const matriz = [
      HEADER,
      ['15/03/2026', 'EC - R14602322 - Vinicius Etges Silveira', 1500.5],
    ]
    const { linhas, erros } = parseEncontroContasMatriz(matriz)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { data: '2026-03-15', descricaoOriginal: 'EC - R14602322 - Vinicius Etges Silveira', numeroChamado: 'R14602322', solicitante: 'Vinicius Etges Silveira', valor: 1500.5 },
    ])
  })

  it('aceita data como objeto Date (planilha com célula formatada como data)', () => {
    const matriz = [HEADER, [new Date(2026, 2, 15), 'EC - R123 - Fulano de Tal', 100]]
    const { linhas } = parseEncontroContasMatriz(matriz)
    expect(linhas[0].data).toBe('2026-03-15')
  })

  it('aceita data no formato AAAA-MM-DD', () => {
    const matriz = [HEADER, ['2026-03-15', 'EC - R123 - Fulano de Tal', 100]]
    const { linhas } = parseEncontroContasMatriz(matriz)
    expect(linhas[0].data).toBe('2026-03-15')
  })

  it('pula linhas totalmente vazias', () => {
    const matriz = [HEADER, ['', '', ''], ['15/03/2026', 'EC - R1 - Fulano', 100]]
    const { linhas } = parseEncontroContasMatriz(matriz)
    expect(linhas).toHaveLength(1)
  })

  it('marca erro quando a descrição não segue o padrão "EC - ..." sem derrubar o resto do arquivo', () => {
    const matriz = [
      HEADER,
      ['15/03/2026', 'Desconto qualquer sem padrão', 100],
      ['16/03/2026', 'EC - R2 - Ciclana', 200],
    ]
    const { linhas, erros } = parseEncontroContasMatriz(matriz)
    expect(linhas).toEqual([{ data: '2026-03-16', descricaoOriginal: 'EC - R2 - Ciclana', numeroChamado: 'R2', solicitante: 'Ciclana', valor: 200 }])
    expect(erros).toHaveLength(1)
  })

  it('marca erro de valor inválido', () => {
    const matriz = [HEADER, ['15/03/2026', 'EC - R1 - Fulano', 'abc']]
    const { linhas, erros } = parseEncontroContasMatriz(matriz)
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('marca erro de data inválida', () => {
    const matriz = [HEADER, ['32/13/2026', 'EC - R1 - Fulano', 100]]
    const { linhas, erros } = parseEncontroContasMatriz(matriz)
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna erro de cabeçalho quando falta alguma coluna', () => {
    const { linhas, erros } = parseEncontroContasMatriz([['DATA', 'DESCRICAO'], ['15/03/2026', 'EC - R1 - Fulano']])
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio pra matriz vazia', () => {
    expect(parseEncontroContasMatriz([])).toEqual({ linhas: [], erros: [] })
  })
})
