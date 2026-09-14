import { describe, expect, it } from 'vitest'
import { negocioPorPrefixo, normalizarNomeUnidade, resolverUnidade } from './unidade-resolver'
import type { Unidade } from '@/types'

describe('normalizarNomeUnidade', () => {
  it('maiúsculas, sem acento, espaços colapsados', () => {
    expect(normalizarNomeUnidade('  Camaçari  ')).toBe('CAMACARI')
    expect(normalizarNomeUnidade('CDL   AS Camaçari')).toBe('CDL AS CAMACARI')
  })
})

describe('negocioPorPrefixo', () => {
  it('CDL vira ROTA, CDR vira ARM, o resto vira CONS', () => {
    expect(negocioPorPrefixo('CDL AS Camaçari')).toBe('ROTA')
    expect(negocioPorPrefixo('CDR Bahia')).toBe('ARM')
    expect(negocioPorPrefixo('Foz do Iguaçu')).toBe('CONS')
  })

  it('descarta um código numérico antes do prefixo (ex: "346 - CDL AS Camaçari", visto na planilha DEV PDV/DEV HL) — sem isso a linha caía em CONS e sumia da tela pra Camaçari', () => {
    expect(negocioPorPrefixo('346 - CDL AS Camaçari')).toBe('ROTA')
    expect(negocioPorPrefixo('346 CDL AS Camaçari')).toBe('ROTA')
    expect(negocioPorPrefixo('12 - CDR Bahia')).toBe('ARM')
  })
})

describe('resolverUnidade', () => {
  const unidades: Unidade[] = [
    { codigo: 'CAM', nome: 'Camaçari', nome_ginfo: null, apelidos: ['346 - CDL AS Camaçari', 'CDR Bahia'] } as Unidade,
  ]

  it('resolve por apelido cadastrado, mesmo com prefixo numérico', () => {
    expect(resolverUnidade('346 - CDL AS Camaçari', unidades)?.codigo).toBe('CAM')
  })

  it('não resolve nome fora da lista de apelidos/nome/código', () => {
    expect(resolverUnidade('Unidade Desconhecida', unidades)).toBeUndefined()
  })
})
