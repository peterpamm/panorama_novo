import { describe, expect, it } from 'vitest'
import { parseRelatosSegurancaMatriz } from './relatos-seguranca-parser'
import type { Unidade } from '@/types'

const HEADER = ['ID', 'DESCONSIDERADO', 'DATA OCORRÊNCIA', 'CDD', 'CLASSIFICAÇÃO', 'TIPO DO RELATO', 'SIF', 'DETALHAMENTO']

const ARACAJU: Unidade = { id: '1', codigo: 'ARACAJU', nome: 'Aracaju', nome_ginfo: null, data_entrada: null, apelidos: null }
const unidades = [ARACAJU]

describe('parseRelatosSegurancaMatriz', () => {
  it('extrai um relato completo, resolvendo a unidade a partir do texto "CDD <cidade>"', () => {
    const matriz = [
      HEADER,
      [647591, '', '31/08/2026 22:59', 'CDD ARACAJU', 'ABORDAGEM POSITIVA', 'UTILIZOU A FAIXA DE PEDESTRE', 'NÃO', 'Funcionário sempre utiliza a faixa de pedestre'],
    ]
    const { linhas, erros, unidadesNaoReconhecidas } = parseRelatosSegurancaMatriz(matriz, unidades)
    expect(erros).toEqual([])
    expect(unidadesNaoReconhecidas).toEqual([])
    expect(linhas).toEqual([{
      relato_id: 647591, unidade: 'ARACAJU', data_ocorrencia: '2026-08-31', ano: 2026, mes: 8,
      classificacao: 'ABORDAGEM POSITIVA', sif: false, sif_tipo: null, tipo_relato: 'UTILIZOU A FAIXA DE PEDESTRE',
      detalhamento: 'Funcionário sempre utiliza a faixa de pedestre',
    }])
  })

  it('SIF: "NÃO" (com ou sem acento) vira false/null, qualquer outro valor preenchido vira true + guarda o texto original (maiúsculo) em sif_tipo', () => {
    function sifDe(valorSif: string): { sif: boolean; sif_tipo: string | null } {
      const matriz = [HEADER, [1, '', '01/01/2026', 'CDD ARACAJU', 'INCIDENTE', '', valorSif]]
      const linha = parseRelatosSegurancaMatriz(matriz, unidades).linhas[0]
      return { sif: linha.sif, sif_tipo: linha.sif_tipo }
    }
    expect(sifDe('NÃO')).toEqual({ sif: false, sif_tipo: null })
    expect(sifDe('NAO')).toEqual({ sif: false, sif_tipo: null })
    expect(sifDe('SIF PERCUSOR')).toEqual({ sif: true, sif_tipo: 'SIF PERCUSOR' })
    expect(sifDe('SIF Potencial')).toEqual({ sif: true, sif_tipo: 'SIF POTENCIAL' })
    expect(sifDe('SIM')).toEqual({ sif: true, sif_tipo: 'SIM' })
  })

  it('pula linha marcada como DESCONSIDERADO', () => {
    const matriz = [HEADER, [1, 'SIM', '01/01/2026', 'CDD ARACAJU', 'INCIDENTE', '', 'NÃO']]
    const { linhas } = parseRelatosSegurancaMatriz(matriz, unidades)
    expect(linhas).toHaveLength(0)
  })

  it('unidade não reconhecida entra em unidadesNaoReconhecidas, sem derrubar o resto do arquivo', () => {
    const matriz = [
      HEADER,
      [1, '', '01/01/2026', 'CDD LUGAR NENHUM', 'INCIDENTE', '', 'NÃO'],
      [2, '', '01/01/2026', 'CDD ARACAJU', 'INCIDENTE', '', 'NÃO'],
    ]
    const { linhas, unidadesNaoReconhecidas } = parseRelatosSegurancaMatriz(matriz, unidades)
    expect(linhas).toHaveLength(1)
    expect(unidadesNaoReconhecidas).toEqual(['CDD LUGAR NENHUM'])
  })

  it('data inválida vira erro, sem derrubar o resto do arquivo', () => {
    const matriz = [
      HEADER,
      [1, '', 'data-invalida', 'CDD ARACAJU', 'INCIDENTE', '', 'NÃO'],
      [2, '', '01/01/2026', 'CDD ARACAJU', 'INCIDENTE', '', 'NÃO'],
    ]
    const { linhas, erros } = parseRelatosSegurancaMatriz(matriz, unidades)
    expect(linhas).toHaveLength(1)
    expect(erros).toHaveLength(1)
  })

  it('aceita data como objeto Date (planilha com célula tipada)', () => {
    const matriz = [HEADER, [1, '', new Date(2026, 7, 31), 'CDD ARACAJU', 'INCIDENTE', '', 'NÃO']]
    const { linhas } = parseRelatosSegurancaMatriz(matriz, unidades)
    expect(linhas[0]).toMatchObject({ data_ocorrencia: '2026-08-31', ano: 2026, mes: 8 })
  })

  it('sem CLASSIFICAÇÃO preenchida vira erro', () => {
    const matriz = [HEADER, [1, '', '01/01/2026', 'CDD ARACAJU', '', '', 'NÃO']]
    const { linhas, erros } = parseRelatosSegurancaMatriz(matriz, unidades)
    expect(linhas).toHaveLength(0)
    expect(erros).toHaveLength(1)
  })

  it('pula linhas totalmente vazias', () => {
    const matriz = [HEADER, ['', '', '', '', '', '', ''], [1, '', '01/01/2026', 'CDD ARACAJU', 'INCIDENTE', '', 'NÃO']]
    const { linhas } = parseRelatosSegurancaMatriz(matriz, unidades)
    expect(linhas).toHaveLength(1)
  })

  it('cabeçalho sem as colunas mínimas vira erro geral', () => {
    const { linhas, erros } = parseRelatosSegurancaMatriz([['A', 'B']], unidades)
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })
})
