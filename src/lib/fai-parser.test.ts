import { describe, expect, it } from 'vitest'
import { parseFaiCsv } from './fai-parser'

const HEADER = 'FILIAL;MES;TIPO'

describe('parseFaiCsv', () => {
  it('conta ocorrências TIPO=FAI, só pra ESTÂNCIA e CDR BAHIA', () => {
    const texto = [
      HEADER,
      'ESTÂNCIA;JULHO;FAI',
      'ESTÂNCIA;JULHO;FAI',
      'CDR BAHIA;JUNHO;FAI',
      'CDD LONDRINA;JUNHO;FAI',
    ].join('\n')
    const { agregados, erros } = parseFaiCsv(texto)
    expect(erros).toEqual([])
    expect(agregados).toEqual([
      { filial: 'ESTÂNCIA', totalFai: 2 },
      { filial: 'CDR BAHIA', totalFai: 1 },
    ])
  })

  it('ignora linhas com TIPO diferente de FAI', () => {
    const texto = [
      HEADER,
      'ESTÂNCIA;JULHO;QUASE_ACIDENTE',
      'ESTÂNCIA;JULHO;FAI',
    ].join('\n')
    const { agregados } = parseFaiCsv(texto)
    expect(agregados).toEqual([
      { filial: 'ESTÂNCIA', totalFai: 1 },
      { filial: 'CDR BAHIA', totalFai: 0 },
    ])
  })

  it('unidade sem nenhuma linha FAI (ou nem citada no arquivo) importa zerada, não fica de fora', () => {
    const texto = [HEADER, 'CDD LONDRINA;JUNHO;FAI'].join('\n')
    const { agregados } = parseFaiCsv(texto)
    expect(agregados).toEqual([
      { filial: 'ESTÂNCIA', totalFai: 0 },
      { filial: 'CDR BAHIA', totalFai: 0 },
    ])
  })

  it('retorna erro de cabeçalho inválido quando falta Filial ou Tipo', () => {
    const { agregados, erros } = parseFaiCsv('Colaborador;Função\nOsmar;AJUDANTE')
    expect(agregados).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseFaiCsv('')).toEqual({ agregados: [], erros: [] })
  })
})
