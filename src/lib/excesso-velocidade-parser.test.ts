import { describe, expect, it } from 'vitest'
import { parseExcessoVelocidadeCsv } from './excesso-velocidade-parser'

const HEADER = 'PLACA;PREFIXO;UO;TIPO;NIVEL;LIMIAR;EXCESSO;DURACAO'

describe('parseExcessoVelocidadeCsv', () => {
  it('conta como excesso quando TIPO é exatamente EXCESSO_VELOCIDADE, agregando por UO', () => {
    const texto = [
      HEADER,
      'QTL1640;QTL1640;CD FRANCISCO BELTRÃO - LOG20;EXCESSO_VELOCIDADE;-;40 Km/h;43 Km/h;00:00:05',
      'RMY2D87;RMY2D87;CD FRANCISCO BELTRÃO - LOG20;EXCESSO_VELOCIDADE;-;64 Km/h;95 Km/h;00:01:12',
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
      'AAA1111;AAA1111;CD FOZ - LOG20;EXCESSO_VELOCIDADE;-;40 Km/h;43 Km/h;00:00:05',
      'BBB2222;BBB2222;CD DIADEMA - LOG20;EXCESSO_VELOCIDADE;-;64 Km/h;95 Km/h;00:01:12',
      'CCC3333;CCC3333;CD DIADEMA - LOG20;EXCESSO_VELOCIDADE;-;60 Km/h;66 Km/h;00:00:07',
    ].join('\n')
    const { agregados } = parseExcessoVelocidadeCsv(texto)
    expect(agregados).toEqual([
      { uo: 'CD FOZ - LOG20', totalExcessos: 1 },
      { uo: 'CD DIADEMA - LOG20', totalExcessos: 2 },
    ])
  })

  it('ignora linhas com TIPO diferente de EXCESSO_VELOCIDADE', () => {
    const texto = [
      HEADER,
      'AAA1111;AAA1111;CD FOZ - LOG20;NO_LIMITE;-;40 Km/h;39 Km/h;00:00:00',
      'BBB2222;BBB2222;CD FOZ - LOG20;EXCESSO_VELOCIDADE;-;64 Km/h;95 Km/h;00:01:12',
    ].join('\n')
    const { agregados } = parseExcessoVelocidadeCsv(texto)
    expect(agregados).toEqual([
      { uo: 'CD FOZ - LOG20', totalExcessos: 1 },
    ])
  })

  it('NÃO conta tipos que só começam com EXCESSO_VELOCIDADE (ex: EXCESSO_VELOCIDADE_VIA)', () => {
    const texto = [
      HEADER,
      'AAA1111;AAA1111;CD FOZ - LOG20;EXCESSO_VELOCIDADE_VIA;-;40 Km/h;43 Km/h;00:00:05',
      'BBB2222;BBB2222;CD FOZ - LOG20;EXCESSO_VELOCIDADE_TRECHO;-;40 Km/h;43 Km/h;00:00:05',
      'CCC3333;CCC3333;CD FOZ - LOG20;EXCESSO_VELOCIDADE;-;64 Km/h;95 Km/h;00:01:12',
    ].join('\n')
    const { agregados } = parseExcessoVelocidadeCsv(texto)
    expect(agregados).toEqual([
      { uo: 'CD FOZ - LOG20', totalExcessos: 1 },
    ])
  })

  it('aguenta espaço em volta e caixa diferente no TIPO', () => {
    const texto = [
      HEADER,
      'AAA1111;AAA1111;CD FOZ - LOG20; excesso_velocidade ;-;40 Km/h;43 Km/h;00:00:05',
    ].join('\n')
    expect(parseExcessoVelocidadeCsv(texto).agregados).toEqual([
      { uo: 'CD FOZ - LOG20', totalExcessos: 1 },
    ])
  })

  it('UO que só tem tipos descartados não entra no resultado', () => {
    const texto = [
      HEADER,
      'AAA1111;AAA1111;CD FOZ - LOG20;EXCESSO_VELOCIDADE_VIA;-;40 Km/h;43 Km/h;00:00:05',
    ].join('\n')
    expect(parseExcessoVelocidadeCsv(texto).agregados).toEqual([])
  })

  it('retorna erro de cabeçalho inválido quando falta UO ou TIPO', () => {
    const { agregados, erros } = parseExcessoVelocidadeCsv('PLACA;LIMIAR\nQTL1640;40 Km/h')
    expect(agregados).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio para arquivo vazio', () => {
    expect(parseExcessoVelocidadeCsv('')).toEqual({ agregados: [], erros: [] })
  })
})
