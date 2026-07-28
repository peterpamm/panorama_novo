import { describe, expect, it } from 'vitest'
import { parsePresenteismoDuMetaCsv } from './presenteismo-du-meta-parser'

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
