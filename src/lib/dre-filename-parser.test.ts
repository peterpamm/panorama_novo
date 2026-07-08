import { describe, expect, it } from 'vitest'
import { parseDreFilename, slugParaNomeSugerido } from './dre-filename-parser'

describe('parseDreFilename', () => {
  it('lê unidade, tipo, negócio, mês e ano de um nome válido com underscore na unidade', () => {
    const info = parseDreFilename('DRE_FOZ_DO_IGUACU_CONSOLIDADO_05_2026.xlsx')
    expect(info).toEqual({ unidadeSlug: 'FOZ_DO_IGUACU', tipo: 'CONSOLIDADO', negocio: 'CONS', mes: 5, ano: 2026 })
  })

  it('lê unidade sem underscore', () => {
    const info = parseDreFilename('DRE_DIADEMA_ROTA_05_2026.xlsx')
    expect(info).toEqual({ unidadeSlug: 'DIADEMA', tipo: 'ROTA', negocio: 'ROTA', mes: 5, ano: 2026 })
  })

  it('reconhece os 4 tipos de negócio', () => {
    expect(parseDreFilename('DRE_X_ARMAZEM_01_2025.xlsx')?.negocio).toBe('ARM')
    expect(parseDreFilename('DRE_X_EMPURRADA_01_2025.xlsx')?.negocio).toBe('EMP')
  })

  it('é case-insensitive pra extensão e tipo', () => {
    const info = parseDreFilename('DRE_DIADEMA_rota_05_2026.XLSX')
    expect(info?.tipo).toBe('ROTA')
  })

  it('retorna null para nomes que não casam o padrão', () => {
    expect(parseDreFilename('outro_arquivo.xlsx')).toBeNull()
    expect(parseDreFilename('DRE_DIADEMA_ROTA_05_2026.csv')).toBeNull()
    expect(parseDreFilename('DRE_DIADEMA_INVALIDO_05_2026.xlsx')).toBeNull()
    expect(parseDreFilename('DRE_DIADEMA_ROTA_2026.xlsx')).toBeNull()
  })
})

describe('slugParaNomeSugerido', () => {
  it('converte slug em nome com primeira letra maiúscula por palavra', () => {
    expect(slugParaNomeSugerido('FOZ_DO_IGUACU')).toBe('Foz Do Iguacu')
    expect(slugParaNomeSugerido('ARACAJU')).toBe('Aracaju')
  })
})
