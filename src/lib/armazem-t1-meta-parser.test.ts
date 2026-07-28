import { describe, expect, it } from 'vitest'
import { parseArmazemT1MetaCsv } from './armazem-t1-meta-parser'

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
