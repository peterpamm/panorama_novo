import { describe, expect, it } from 'vitest'
import { LOGOS_UNIDADES, mapaLogosPorUnidade, resolverLogoUnidade } from './logos-unidades'
import { CAMACARI_CDL_ID, CAMACARI_CDR_ID } from './ranking-calculations'
import type { Unidade } from '@/types'

function unidade(over: Partial<Unidade>): Unidade {
  return { id: '1', codigo: 'X', nome: 'X', nome_ginfo: null, data_entrada: null, apelidos: null, ...over }
}

describe('resolverLogoUnidade', () => {
  it('bate exato via apelido cadastrado (ex: Camaçari com "CDL CAMAÇARI"/"CDR BAHIA")', () => {
    const camacari = unidade({ codigo: 'CAMACARI', nome: 'Camaçari', apelidos: ['CDL CAMAÇARI', 'CDR BAHIA'] })
    const logoRota = LOGOS_UNIDADES.find(l => l.nomeOriginal === 'CDL CAMAÇARI')!
    const logoArm = LOGOS_UNIDADES.find(l => l.nomeOriginal === 'CDR BAHIA')!
    expect(resolverLogoUnidade(logoRota, [camacari])?.codigo).toBe('CAMACARI')
    expect(resolverLogoUnidade(logoArm, [camacari])?.codigo).toBe('CAMACARI')
  })

  it('bate exato via nome (ex: "PONTA GROSSA" == unidade.nome "Ponta Grossa")', () => {
    const pg = unidade({ codigo: 'PG', nome: 'Ponta Grossa' })
    const logo = LOGOS_UNIDADES.find(l => l.nomeOriginal === 'PONTA GROSSA')!
    expect(resolverLogoUnidade(logo, [pg])?.codigo).toBe('PG')
  })

  it('sem match nenhum, cai sem logo (undefined) — não adivinha demais', () => {
    const logo = LOGOS_UNIDADES.find(l => l.nomeOriginal === 'CD ARACAJU')!
    expect(resolverLogoUnidade(logo, [unidade({ codigo: 'OUTRA', nome: 'Outra Unidade' })])).toBeUndefined()
  })

  it('strip de sufixo de UF (ex: "VIDROS PR" → "VIDROS")', () => {
    const carambei = unidade({ codigo: 'VIDROS', nome: 'Carambeí', apelidos: null })
    const logo = LOGOS_UNIDADES.find(l => l.nomeOriginal === 'VIDROS PR')!
    expect(resolverLogoUnidade(logo, [carambei])?.codigo).toBe('VIDROS')
  })

  it('strip de prefixo de BI (ex: "CD ARACAJU" → "ARACAJU")', () => {
    const aracaju = unidade({ codigo: 'ARACAJU', nome: 'Aracaju' })
    const logo = LOGOS_UNIDADES.find(l => l.nomeOriginal === 'CD ARACAJU')!
    expect(resolverLogoUnidade(logo, [aracaju])?.codigo).toBe('ARACAJU')
  })

  it('apelido real com palavra extra no meio (ex: "CDL AS Camaçari") ainda bate com o arquivo "CDL CAMAÇARI" pelo conteúdo do nome', () => {
    const camacari = unidade({ codigo: 'CAMACARI', nome: 'Camaçari', apelidos: ['CDL AS Camaçari', 'CDR BAHIA'] })
    const logo = LOGOS_UNIDADES.find(l => l.nomeOriginal === 'CDL CAMAÇARI')!
    expect(resolverLogoUnidade(logo, [camacari])?.codigo).toBe('CAMACARI')
  })
})

describe('mapaLogosPorUnidade', () => {
  it('monta o mapa codigo -> url só das unidades que casaram com algum arquivo', () => {
    const unidades = [
      unidade({ codigo: 'ARACAJU', nome: 'Aracaju' }),
      unidade({ codigo: 'SEM_LOGO', nome: 'Sem Logo Nenhum' }),
    ]
    const mapa = mapaLogosPorUnidade(unidades)
    expect(mapa.get('ARACAJU')).toBe('/logos-unidades/cd-aracaju.png')
    expect(mapa.has('SEM_LOGO')).toBe(false)
  })

  it('sempre inclui os 2 pseudo-ids do split CDL/CDR de Camaçari do RankingPage, mesmo sem nenhuma unidade real de Camaçari na lista', () => {
    const mapa = mapaLogosPorUnidade([])
    expect(mapa.get(CAMACARI_CDL_ID)).toBe('/logos-unidades/cdl-camacari.png')
    expect(mapa.get(CAMACARI_CDR_ID)).toBe('/logos-unidades/cdr-bahia.png')
  })
})
