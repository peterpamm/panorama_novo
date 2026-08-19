import { describe, expect, it } from 'vitest'
import { identificarSetorPagamento, parseLiderancasCsv } from './reuniao-pagamento-parser'

const HEADER = 'FILIAL;SETOR;LIDERANÇA;NÚMERO EXTRATTA'

describe('identificarSetorPagamento', () => {
  it('reconhece os 6 setores, tolerando acento e caixa', () => {
    expect(identificarSetorPagamento('Segurança')).toBe('seguranca')
    expect(identificarSetorPagamento('SEGURANCA')).toBe('seguranca')
    expect(identificarSetorPagamento('Distribuição')).toBe('distribuicao')
    expect(identificarSetorPagamento('gente')).toBe('gente')
  })

  it('setor não reconhecido devolve null', () => {
    expect(identificarSetorPagamento('Qualidade')).toBeNull()
  })

  it('reconhece "Empurrada"/"EMP" — rótulo de Ponta Grossa/Estância', () => {
    expect(identificarSetorPagamento('Empurrada')).toBe('empurrada')
    expect(identificarSetorPagamento('EMP')).toBe('empurrada')
  })
})

describe('parseLiderancasCsv', () => {
  it('lê as 4 colunas, uma linha por pessoa', () => {
    const texto = [
      HEADER,
      'PG - EMPURRADA;GENTE;Bruna Leticia Sebastiao;378315',
      'DIADEMA;FINANCEIRO;Eduardo Goncalves Marchesi da Silva;57159',
    ].join('\n')
    const { linhas, erros } = parseLiderancasCsv(texto)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { filialTexto: 'PG - EMPURRADA', setorTexto: 'GENTE', setor: 'gente', nome: 'Bruna Leticia Sebastiao', numeroExtratta: '378315' },
      { filialTexto: 'DIADEMA', setorTexto: 'FINANCEIRO', setor: 'financeiro', nome: 'Eduardo Goncalves Marchesi da Silva', numeroExtratta: '57159' },
    ])
  })

  it('duas pessoas na mesma filial/setor geram duas linhas (é o que sustenta a divisão do prêmio)', () => {
    const texto = [
      HEADER,
      'LITORAL;SEGURANÇA;Alexia de Jesus Aires Nascimento;341438',
      'LITORAL;SEGURANÇA;Abner Victor de Lara Brelaz;341439',
    ].join('\n')
    const { linhas } = parseLiderancasCsv(texto)
    expect(linhas).toHaveLength(2)
    expect(linhas.map(l => l.nome)).toEqual(['Alexia de Jesus Aires Nascimento', 'Abner Victor de Lara Brelaz'])
  })

  it('setor não reconhecido entra na linha com setor null, sem virar erro de parse (a tela reporta)', () => {
    const { linhas, erros } = parseLiderancasCsv([HEADER, 'DIADEMA;QUALIDADE;Fulano;123'].join('\n'))
    expect(erros).toEqual([])
    expect(linhas[0].setor).toBeNull()
  })

  it('número Extratta em branco é erro (não dá pra pagar sem cartão)', () => {
    const { linhas, erros } = parseLiderancasCsv([HEADER, 'DIADEMA;FINANCEIRO;Fulano;'].join('\n'))
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('cabeçalho inválido gera erro único', () => {
    const { linhas, erros } = parseLiderancasCsv('FILIAL;SETOR\nDIADEMA;FINANCEIRO')
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('arquivo vazio devolve vazio', () => {
    expect(parseLiderancasCsv('')).toEqual({ linhas: [], erros: [] })
  })
})
