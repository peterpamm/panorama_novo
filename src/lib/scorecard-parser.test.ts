import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { negocioDoCanal, parseScorecardXlsx } from './scorecard-parser'

/** Monta um .xlsx em memória a partir de linhas de objeto e devolve como File. */
function arquivo(linhas: Record<string, unknown>[]): File {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), 'Plan1')
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([buffer], 'scorecard.xlsx')
}

describe('negocioDoCanal', () => {
  it('traduz os três canais da planilha pro negócio do app', () => {
    expect(negocioDoCanal('Apoio Logístico')).toBe('ARM')
    expect(negocioDoCanal('Distribuição Urbana')).toBe('ROTA')
    expect(negocioDoCanal('Empurrada')).toBe('EMP')
  })

  it('aguenta variação de escrita (maiúsculas, sem acento, com sufixo)', () => {
    expect(negocioDoCanal('APOIO LOGISTICO')).toBe('ARM')
    expect(negocioDoCanal('Distribuicao Urbana (DU)')).toBe('ROTA')
  })

  it('canal desconhecido não vira negócio nenhum', () => {
    expect(negocioDoCanal('Transferência')).toBeUndefined()
  })
})

describe('parseScorecardXlsx', () => {
  it('lê unidade/canal/score, com o score sempre em escala de percentual', async () => {
    const { linhas, erros } = await parseScorecardXlsx(arquivo([
      { Unidade: 'Diadema', Canal: 'Distribuição Urbana', Score: '97,4%' },
      { Unidade: 'Diadema', Canal: 'Apoio Logístico', Score: 0.812 },
      { Unidade: 'Estância', Canal: 'Empurrada', Score: 83.5 },
    ]))

    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidadeNome: 'Diadema', negocio: 'ROTA', canalTexto: 'Distribuição Urbana', score: 97.4 },
      { unidadeNome: 'Diadema', negocio: 'ARM', canalTexto: 'Apoio Logístico', score: 81.2 },
      { unidadeNome: 'Estância', negocio: 'EMP', canalTexto: 'Empurrada', score: 83.5 },
    ])
  })

  it('acusa canal não reconhecido em vez de importar errado', async () => {
    const { linhas, erros } = await parseScorecardXlsx(arquivo([
      { Unidade: 'Diadema', Canal: 'Transferência', Score: 90 },
    ]))
    expect(linhas).toEqual([])
    expect(erros[0]).toContain('Transferência')
  })

  it('acusa linha sem unidade ou sem score', async () => {
    const { linhas, erros } = await parseScorecardXlsx(arquivo([
      { Unidade: '', Canal: 'Empurrada', Score: 90 },
      { Unidade: 'Diadema', Canal: 'Empurrada', Score: null },
    ]))
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(2)
  })

  it('ignora linha totalmente em branco sem virar erro', async () => {
    const { linhas, erros } = await parseScorecardXlsx(arquivo([
      { Unidade: 'Diadema', Canal: 'Empurrada', Score: 90 },
      { Unidade: null, Canal: null, Score: null },
    ]))
    expect(linhas).toHaveLength(1)
    expect(erros).toEqual([])
  })
})
