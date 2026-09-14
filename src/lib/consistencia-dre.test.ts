import { describe, expect, it } from 'vitest'
import { verificarPercentualRecalculado, verificarSomaFilhas, verificarSomaUnidades } from './consistencia-dre'

describe('verificarSomaFilhas', () => {
  it('bate quando a soma das filhas é igual à mãe', () => {
    const r = verificarSomaFilhas(1000, [400, 350, 250])
    expect(r.ok).toBe(true)
    expect(r.diferenca).toBeCloseTo(0)
  })

  it('não bate e mostra a diferença exata (caso real: R$ 7.484,10 de gap)', () => {
    const r = verificarSomaFilhas(500000, [300000, 150000, 42515.90])
    expect(r.ok).toBe(false)
    expect(r.diferenca).toBeCloseTo(7484.10, 2)
  })

  it('tolera diferença de centavo (arredondamento)', () => {
    const r = verificarSomaFilhas(1000, [333.33, 333.33, 333.34])
    expect(r.ok).toBe(true)
  })
})

describe('verificarSomaUnidades', () => {
  it('bate quando a soma das unidades é igual ao consolidado', () => {
    const r = verificarSomaUnidades(300, [100, 100, 100])
    expect(r.ok).toBe(true)
  })

  it('não bate e reporta a diferença (unidade faltando na soma, por exemplo)', () => {
    const r = verificarSomaUnidades(300, [100, 100])
    expect(r.ok).toBe(false)
    expect(r.diferenca).toBeCloseTo(100)
  })
})

describe('verificarPercentualRecalculado', () => {
  it('bate quando o % recalculado é igual ao do arquivo', () => {
    const r = verificarPercentualRecalculado(12.5, 12.5)
    expect(r.ok).toBe(true)
  })

  it('tolera diferença pequena de arredondamento (até 0,05 p.p.)', () => {
    const r = verificarPercentualRecalculado(12.50, 12.53)
    expect(r.ok).toBe(true)
  })

  it('não bate quando a divergência passa da tolerância', () => {
    const r = verificarPercentualRecalculado(12.5, 13.2)
    expect(r.ok).toBe(false)
    expect(r.diferenca).toBeCloseTo(-0.7, 5)
  })
})
