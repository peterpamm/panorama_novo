import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { abaSugerida, lerAbaBrutaEFormatada, listarAbasXlsx } from './xlsx-abas'

describe('abaSugerida', () => {
  const abas = ['RV ARM _T1', 'RV ARM _T2']

  it('casa pela pista ignorando espaço, acento e caixa', () => {
    expect(abaSugerida(abas, 'T2')).toBe('RV ARM _T2')
    expect(abaSugerida(abas, 't1')).toBe('RV ARM _T1')
  })

  it('sem casar, cai na primeira aba', () => {
    expect(abaSugerida(abas, 'T9')).toBe('RV ARM _T1')
  })

  it('lista vazia não devolve aba nenhuma', () => {
    expect(abaSugerida([], 'T1')).toBeUndefined()
  })
})

describe('listarAbasXlsx', () => {
  it('lista as abas de um .xlsx na ordem do arquivo', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['A']]), 'RV ARM _T1')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['B']]), 'RV ARM _T2')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    expect(await listarAbasXlsx(new File([buffer], 'metas.xlsx'))).toEqual(['RV ARM _T1', 'RV ARM _T2'])
  })

  it('CSV não tem aba', async () => {
    expect(await listarAbasXlsx(new File(['a;b'], 'metas.csv'))).toEqual([])
  })
})

describe('lerAbaBrutaEFormatada', () => {
  it('bruta traz o número como veio na célula; formatada traz o texto que aparece na tela', () => {
    const ws = XLSX.utils.aoa_to_sheet([['TMA'], [0]])
    // Formato customizado "00:00": o número 131 vira "01:31" na tela, mas o
    // valor bruto continua sendo o inteiro 131 — é justamente essa diferença
    // que resolve a ambiguidade de TMA (ver armazem-resultado-parser.ts).
    ws.A2 = { t: 'n', v: 131, z: '00\\:00' }
    const { bruta, formatada } = lerAbaBrutaEFormatada(ws)
    expect(bruta[1][0]).toBe(131)
    expect(formatada[1][0]).toBe('01:31')
  })

  it('célula com fração real do dia também formata certo (h:mm)', () => {
    const ws = XLSX.utils.aoa_to_sheet([['TMA'], [0]])
    ws.A2 = { t: 'n', v: 0.0625, z: 'h:mm' } // 1h30
    const { formatada } = lerAbaBrutaEFormatada(ws)
    expect(formatada[1][0]).toBe('1:30')
  })
})
