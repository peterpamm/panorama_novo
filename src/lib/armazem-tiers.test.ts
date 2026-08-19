import { describe, expect, it } from 'vitest'
import { tierDaLinha } from './armazem-tiers'

describe('tierDaLinha', () => {
  it('o nome da aba manda quando diz o tier', () => {
    expect(tierDaLinha('RV ARM _T1', 'CD CASCAVEL')).toBe('T1')
    expect(tierDaLinha('RV ARM _T2', 'ESTÂNCIA')).toBe('T2')
  })

  it('aba sem tier no nome cai pra unidade (Estância e CDR Bahia são T1)', () => {
    expect(tierDaLinha('Metas', 'ESTÂNCIA')).toBe('T1')
    expect(tierDaLinha('Metas', 'CDR BAHIA')).toBe('T1')
    expect(tierDaLinha('Metas', 'CD CASCAVEL')).toBe('T2')
  })

  it('CSV (sem aba) usa a unidade, tolerando acento', () => {
    expect(tierDaLinha('', 'ESTANCIA')).toBe('T1')
    expect(tierDaLinha('', 'CD LONDRINA')).toBe('T2')
  })
})
