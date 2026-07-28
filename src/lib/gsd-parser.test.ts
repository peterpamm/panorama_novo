import { describe, expect, it } from 'vitest'
import { parseGsdCsv } from './gsd-parser'

const HEADER = 'Filial;Colaborador;Função;Admissão;Data Último;Data Limite;Status;Dias Falta'

describe('parseGsdCsv', () => {
  it('agrega colaboradores por unidade e calcula o % dentro do prazo (Status "FORA DO PRAZO" = atrasado)', () => {
    const texto = [
      HEADER,
      'CDD ARACAJU;Fulano;MOTORISTA;02/05/2026;28/05/2026;27/07/2026;AFASTADO;0',
      'CDD ARACAJU;Ciclano;MOTORISTA;02/05/2026;22/06/2026;21/07/2026;NO PRAZO;4',
      'CDD ARACAJU;Beltrano;AJUDANTE;02/05/2026;04/06/2026;03/08/2026;FORA DO PRAZO;17',
    ].join('\n')
    const { agregados, erros } = parseGsdCsv(texto)
    expect(erros).toEqual([])
    expect(agregados).toEqual([
      { filial: 'CDD ARACAJU', negocio: 'CONS', totalColaboradores: 3, foraDoPrazo: 1, pctDentroPrazo: (2 / 3) * 100 },
    ])
  })

  it('agrupa por mais de uma filial ao mesmo tempo', () => {
    const texto = [
      HEADER,
      'CDD ARACAJU;Fulano;MOTORISTA;02/05/2026;28/05/2026;27/07/2026;FORA DO PRAZO;0',
      'CDD ARACAJU;Ciclano;MOTORISTA;02/05/2026;22/06/2026;21/07/2026;NO PRAZO;4',
      'FOZ DO IGUAÇU;Beltrano;AJUDANTE;02/05/2026;04/06/2026;03/08/2026;NO PRAZO;17',
    ].join('\n')
    const { agregados } = parseGsdCsv(texto)
    expect(agregados).toEqual([
      { filial: 'CDD ARACAJU', negocio: 'CONS', totalColaboradores: 2, foraDoPrazo: 1, pctDentroPrazo: 50 },
      { filial: 'FOZ DO IGUAÇU', negocio: 'CONS', totalColaboradores: 1, foraDoPrazo: 0, pctDentroPrazo: 100 },
    ])
  })

  it('separa CDL (rota) e CDR (armazém) por negócio — Camaçari aparece duas vezes', () => {
    const texto = [
      HEADER,
      'CDL CAMAÇARI;Fulano;MOTORISTA;02/05/2026;28/05/2026;27/07/2026;NO PRAZO;0',
      'CDR BAHIA;Ciclano;AJUDANTE;02/05/2026;22/06/2026;21/07/2026;FORA DO PRAZO;4',
    ].join('\n')
    const { agregados } = parseGsdCsv(texto)
    expect(agregados).toEqual([
      { filial: 'CDL CAMAÇARI', negocio: 'ROTA', totalColaboradores: 1, foraDoPrazo: 0, pctDentroPrazo: 100 },
      { filial: 'CDR BAHIA', negocio: 'ARM', totalColaboradores: 1, foraDoPrazo: 1, pctDentroPrazo: 0 },
    ])
  })

  it('retorna erro de cabeçalho inválido quando falta Filial ou Status', () => {
    const { agregados, erros } = parseGsdCsv('Colaborador;Função\nFulano;MOTORISTA')
    expect(agregados).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseGsdCsv('')).toEqual({ agregados: [], erros: [] })
  })
})
