import { describe, expect, it } from 'vitest'
import { parseExcessoVelocidadeCsv } from './excesso-velocidade-parser'

const HEADER = 'PLACA;PREFIXO;UO;TIPO;NIVEL;LIMIAR;EXCESSO;DURACAO'

describe('parseExcessoVelocidadeCsv', () => {
  it('conta como excesso só quando EXCESSO > LIMIAR, agregando por UO', () => {
    const texto = [
      HEADER,
      'QTL1640;QTL1640;CD FRANCISCO BELTRÃO - LOG20;EXCESSO_BAIXO;-;40 Km/h;43 Km/h;00:00:05',
      'RMY2D87;RMY2D87;CD FRANCISCO BELTRÃO - LOG20;EXCESSO_ALTO;-;64 Km/h;95 Km/h;00:01:12',
      'RJL4177;RJL4177;CD FRANCISCO BELTRÃO - LOG20;NO_LIMITE;-;60 Km/h;60 Km/h;00:00:00',
    ].join('\n')
    const { agregados, erros } = parseExcessoVelocidadeCsv(texto)
    expect(erros).toEqual([])
    expect(agregados).toEqual([
      { uo: 'CD FRANCISCO BELTRÃO - LOG20', totalExcessos: 2 },
    ])
  })

  it('agrupa por mais de uma UO ao mesmo tempo', () => {
    const texto = [
      HEADER,
      'AAA1111;AAA1111;CD FOZ - LOG20;EXCESSO_BAIXO;-;40 Km/h;43 Km/h;00:00:05',
      'BBB2222;BBB2222;CD DIADEMA - LOG20;EXCESSO_ALTO;-;64 Km/h;95 Km/h;00:01:12',
      'CCC3333;CCC3333;CD DIADEMA - LOG20;EXCESSO_BAIXO;-;60 Km/h;66 Km/h;00:00:07',
    ].join('\n')
    const { agregados } = parseExcessoVelocidadeCsv(texto)
    expect(agregados).toEqual([
      { uo: 'CD FOZ - LOG20', totalExcessos: 1 },
      { uo: 'CD DIADEMA - LOG20', totalExcessos: 2 },
    ])
  })

  it('retorna erro de cabeçalho inválido quando falta UO, LIMIAR ou EXCESSO', () => {
    const { agregados, erros } = parseExcessoVelocidadeCsv('PLACA;TIPO\nQTL1640;EXCESSO_BAIXO')
    expect(agregados).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseExcessoVelocidadeCsv('')).toEqual({ agregados: [], erros: [] })
  })
})
