import { describe, expect, it } from 'vitest'
import { parseArmazemBiCsv } from './armazem-bi-parser'

const HEADER_RESULTADO = 'INDICADOR;UNIDADE;RESULTADO'

describe('parseArmazemBiCsv — formato RESULTADO', () => {
  it('filtra PRESENTEÍSMO AL pro indicador presenteismo_al', () => {
    const texto = [
      HEADER_RESULTADO,
      'PRESENTEÍSMO AL;CDD BELTRAO;96%',
      'PRESENTEÍSMO AL;CDR BAHIA;83%',
    ].join('\n')
    const { linhas, erros } = parseArmazemBiCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { indicador: 'presenteismo_al', unidade: 'CDD BELTRAO', negocio: 'CONS', valor: 96 },
      { indicador: 'presenteismo_al', unidade: 'CDR BAHIA', negocio: 'ARM', valor: 83 },
    ])
  })

  it('reconhece EFC e REFUGO como percentual, tirando o código numérico da unidade', () => {
    const texto = [
      HEADER_RESULTADO,
      'EFC;143 - CDD Beltrao;92,5%',
      'REFUGO;143 - CDD Beltrao;0,8%',
    ].join('\n')
    const { linhas } = parseArmazemBiCsv(texto)
    expect(linhas).toEqual([
      { indicador: 'efc', unidade: 'CDD BELTRAO', negocio: 'CONS', valor: 92.5 },
      { indicador: 'refugo', unidade: 'CDD BELTRAO', negocio: 'CONS', valor: 0.8 },
    ])
  })

  it('converte TMA de "HH:MM" pra minutos totais', () => {
    const texto = [HEADER_RESULTADO, 'TMA;CDD BELTRAO;03:15'].join('\n')
    const { linhas, erros } = parseArmazemBiCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([{ indicador: 'tma', unidade: 'CDD BELTRAO', negocio: 'CONS', valor: 195 }])
  })

  it('converte TMA de "HH:MM:SS" pra minutos totais (com fração de segundos)', () => {
    const texto = [HEADER_RESULTADO, 'TMA;CDD BELTRAO;00:01:30'].join('\n')
    const { linhas } = parseArmazemBiCsv(texto)
    expect(linhas).toEqual([{ indicador: 'tma', unidade: 'CDD BELTRAO', negocio: 'CONS', valor: 1.5 }])
  })

  it('ignora linhas de indicador ainda não reconhecido, sem gerar erro', () => {
    const texto = [HEADER_RESULTADO, 'OUTRO INDICADOR;CDD BELTRAO;50%'].join('\n')
    const { linhas, erros } = parseArmazemBiCsv(texto)
    expect(linhas).toEqual([])
    expect(erros).toEqual([])
  })

  it('retorna erro de cabeçalho inválido quando falta RESULTADO e não tem coluna de mês', () => {
    const { linhas, erros } = parseArmazemBiCsv('INDICADOR;UNIDADE\nEFC;CDD BELTRAO')
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseArmazemBiCsv('')).toEqual({ linhas: [], erros: [] })
  })
})

describe('parseArmazemBiCsv — formato histórico (colunas de mês)', () => {
  it('gera um registro por mês presente, marcando o campo mes em cada linha', () => {
    const texto = [
      'INDICADOR;UNIDADE;JAN;FEV;MAR',
      'EFC;CDD BELTRAO;90%;91%;92%',
    ].join('\n')
    const { linhas, erros } = parseArmazemBiCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { indicador: 'efc', unidade: 'CDD BELTRAO', negocio: 'CONS', valor: 90, mes: 1 },
      { indicador: 'efc', unidade: 'CDD BELTRAO', negocio: 'CONS', valor: 91, mes: 2 },
      { indicador: 'efc', unidade: 'CDD BELTRAO', negocio: 'CONS', valor: 92, mes: 3 },
    ])
  })

  it('pula meses em branco (ainda não fechados) sem gerar erro', () => {
    const texto = [
      'INDICADOR;UNIDADE;JAN;FEV;MAR',
      'EFC;CDD BELTRAO;90%;;',
    ].join('\n')
    const { linhas, erros } = parseArmazemBiCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([{ indicador: 'efc', unidade: 'CDD BELTRAO', negocio: 'CONS', valor: 90, mes: 1 }])
  })
})
