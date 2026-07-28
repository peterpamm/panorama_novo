import { describe, expect, it } from 'vitest'
import { parseLogonCsv } from './logon-parser'

const HEADER = 'Unidade;Participantes Únicos;Não Entregou todos os Cursos;Entregou todos os Cursos;Aderência Total da Trilha'

describe('parseLogonCsv', () => {
  it('lê unidade e % de aderência, ignorando as demais colunas', () => {
    const texto = [
      HEADER,
      'LATA PONTA GROSSA;25;0;25;100%',
      'CD PETRÓPOLIS;104;10;94;90%',
    ].join('\n')
    const { linhas, erros } = parseLogonCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'LATA PONTA GROSSA', negocio: 'CONS', valor: 100 },
      { unidade: 'CD PETRÓPOLIS', negocio: 'CONS', valor: 90 },
    ])
  })

  it('separa CDL (rota) e CDR (armazém) por negócio — Camaçari aparece duas vezes', () => {
    const texto = [
      HEADER,
      'CDL CAMAÇARI;74;42;32;43%',
      'CDR BAHIA;145;93;52;36%',
    ].join('\n')
    const { linhas } = parseLogonCsv(texto)
    expect(linhas).toEqual([
      { unidade: 'CDL CAMAÇARI', negocio: 'ROTA', valor: 43 },
      { unidade: 'CDR BAHIA', negocio: 'ARM', valor: 36 },
    ])
  })

  it('reconhece o cabeçalho em qualquer ordem de coluna', () => {
    const texto = 'Aderência Total da Trilha;Unidade\n78%;VIDROS PR'
    const { linhas } = parseLogonCsv(texto)
    expect(linhas).toEqual([{ unidade: 'VIDROS PR', negocio: 'CONS', valor: 78 }])
  })

  it('retorna erro de cabeçalho inválido quando falta Unidade ou Aderência Total da Trilha', () => {
    const { linhas, erros } = parseLogonCsv('Unidade;Participantes\nFOZ;10')
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseLogonCsv('')).toEqual({ linhas: [], erros: [] })
  })
})
