import { describe, expect, it } from 'vitest'
import { parseDtoT1Csv } from './dto-t1-parser'

const HEADER = 'Matrícula;Colaborador;Data Admissão;Operação;Função;Data Última Inspeção;Data Limite Inspeção;Dias Para Realizar Inspeção;Dias Sem Inspeção'

describe('parseDtoT1Csv', () => {
  it('agrega colaboradores por unidade e calcula o % dentro do prazo (atraso = dias negativo)', () => {
    const texto = [
      HEADER,
      '1;Fulano;01/05/2026;ESTÂNCIA;MOTORISTA;31/05/2026;31/05/2026;-47;77',
      '2;Ciclano;01/05/2026;ESTÂNCIA;MOTORISTA;31/05/2026;31/05/2026;10;77',
      '3;Beltrano;01/05/2026;ESTÂNCIA;CONFERENTE;31/05/2026;31/05/2026;5;77',
    ].join('\n')
    const { agregados, erros } = parseDtoT1Csv(texto)
    expect(erros).toEqual([])
    expect(agregados).toEqual([
      { operacao: 'ESTÂNCIA', totalColaboradores: 3, atrasados: 1, pctDentroPrazo: (2 / 3) * 100 },
    ])
  })

  it('ignora qualquer unidade que não seja ESTÂNCIA ou CDR BAHIA', () => {
    const texto = [
      HEADER,
      '1;Fulano;01/05/2026;FOZ DO IGUAÇU;MOTORISTA;31/05/2026;31/05/2026;-10;77',
      '2;Ciclano;01/05/2026;CDR BAHIA;MOTORISTA;31/05/2026;31/05/2026;-20;77',
    ].join('\n')
    const { agregados } = parseDtoT1Csv(texto)
    expect(agregados).toEqual([
      { operacao: 'CDR BAHIA', totalColaboradores: 1, atrasados: 1, pctDentroPrazo: 0 },
    ])
  })

  it('reproduz o exemplo do usuário: CDR BAHIA com 113 colaboradores e 80 atrasados = 29,20%', () => {
    const linhasAtrasadas = Array.from({ length: 80 }, (_, i) => `${i};Nome;01/05/2026;CDR BAHIA;MOTORISTA;31/05/2026;31/05/2026;-1;10`)
    const linhasOk = Array.from({ length: 33 }, (_, i) => `${80 + i};Nome;01/05/2026;CDR BAHIA;MOTORISTA;31/05/2026;31/05/2026;1;10`)
    const texto = [HEADER, ...linhasAtrasadas, ...linhasOk].join('\n')
    const { agregados } = parseDtoT1Csv(texto)
    expect(agregados).toHaveLength(1)
    expect(agregados[0].totalColaboradores).toBe(113)
    expect(agregados[0].atrasados).toBe(80)
    expect(agregados[0].pctDentroPrazo).toBeCloseTo(29.2, 1)
  })

  it('retorna erro de cabeçalho inválido quando falta Operação ou Dias Para Realizar Inspeção', () => {
    const { agregados, erros } = parseDtoT1Csv('Matrícula;Colaborador\n1;Fulano')
    expect(agregados).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseDtoT1Csv('')).toEqual({ agregados: [], erros: [] })
  })
})
