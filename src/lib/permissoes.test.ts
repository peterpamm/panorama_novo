import { describe, expect, it } from 'vitest'
import { PAGINAS } from './permissoes'

describe('PAGINAS', () => {
  it('tem 26 páginas registradas', () => {
    expect(PAGINAS).toHaveLength(26)
  })

  it('não tem chave duplicada', () => {
    const chaves = PAGINAS.map(p => p.chave)
    expect(new Set(chaves).size).toBe(chaves.length)
  })

  it('cada página tem grupo e label preenchidos', () => {
    for (const p of PAGINAS) {
      expect(p.grupo.length).toBeGreaterThan(0)
      expect(p.label.length).toBeGreaterThan(0)
    }
  })
})
