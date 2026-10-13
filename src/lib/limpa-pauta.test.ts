import { describe, expect, it } from 'vitest'
import { agruparLimpaPautaPorUnidadeSegmento, agruparLimpaPautaPorUnidadeStatus, alcadaAtualLimpaPauta, statusAtualLimpaPauta } from './limpa-pauta'

describe('statusAtualLimpaPauta', () => {
  it('fica "em_analise" quando nenhuma alçada decidiu ainda', () => {
    expect(statusAtualLimpaPauta({ status_god: 'em_analise', status_geo: 'em_analise', status_rpo: 'em_analise' })).toBe('em_analise')
  })

  it('assume a decisão do GOD quando só ele decidiu', () => {
    expect(statusAtualLimpaPauta({ status_god: 'nok', status_geo: 'em_analise', status_rpo: 'em_analise' })).toBe('nok')
  })

  it('a decisão da GEO sobrepõe a do GOD', () => {
    expect(statusAtualLimpaPauta({ status_god: 'nok', status_geo: 'ok', status_rpo: 'em_analise' })).toBe('ok')
  })

  it('a decisão do RPO sobrepõe GEO e GOD', () => {
    expect(statusAtualLimpaPauta({ status_god: 'ok', status_geo: 'ok', status_rpo: 'nok' })).toBe('nok')
  })
})

describe('alcadaAtualLimpaPauta', () => {
  const base = { status_god: 'em_analise', status_geo: 'em_analise', status_rpo: 'em_analise', justificativa_god: '', justificativa_geo: '', justificativa_rpo: '' } as const

  it('null quando ninguém decidiu ainda', () => {
    expect(alcadaAtualLimpaPauta(base)).toBeNull()
  })

  it('GOD quando só ele decidiu', () => {
    expect(alcadaAtualLimpaPauta({ ...base, status_god: 'nok', justificativa_god: 'Sem evidência' }))
      .toEqual({ titulo: 'GOD', justificativa: 'Sem evidência' })
  })

  it('GEO sobrepõe GOD', () => {
    expect(alcadaAtualLimpaPauta({ ...base, status_god: 'nok', justificativa_god: 'x', status_geo: 'ok', justificativa_geo: 'Aprovado pela GEO' }))
      .toEqual({ titulo: 'GEO', justificativa: 'Aprovado pela GEO' })
  })

  it('RPO sobrepõe GEO e GOD', () => {
    expect(alcadaAtualLimpaPauta({
      ...base, status_god: 'ok', justificativa_god: 'x', status_geo: 'ok', justificativa_geo: 'y',
      status_rpo: 'nok', justificativa_rpo: 'Reprovado em última instância',
    })).toEqual({ titulo: 'RPO', justificativa: 'Reprovado em última instância' })
  })
})

describe('agruparLimpaPautaPorUnidadeSegmento', () => {
  it('soma valor_solicitado por combinação Unidade+Segmento, maior primeiro', () => {
    const linhas = agruparLimpaPautaPorUnidadeSegmento([
      { unidade: 'CAMACARI', segmento: 'ARMAZEM', valor_solicitado: 100 },
      { unidade: 'CAMACARI', segmento: 'ARMAZEM', valor_solicitado: 50 },
      { unidade: 'CAMACARI', segmento: 'ROTA', valor_solicitado: 500 },
      { unidade: 'ARACAJU', segmento: 'ARMAZEM', valor_solicitado: 10 },
    ])
    expect(linhas).toEqual([
      { unidade: 'CAMACARI', segmento: 'ROTA', valorTotal: 500 },
      { unidade: 'CAMACARI', segmento: 'ARMAZEM', valorTotal: 150 },
      { unidade: 'ARACAJU', segmento: 'ARMAZEM', valorTotal: 10 },
    ])
  })
})

describe('agruparLimpaPautaPorUnidadeStatus', () => {
  it('soma valor_solicitado por Unidade, quebrado pelo status atual (ok/em_analise/nok)', () => {
    const linhas = agruparLimpaPautaPorUnidadeStatus([
      { unidade: 'CAMACARI', valor_solicitado: 100, status_god: 'ok', status_geo: 'em_analise', status_rpo: 'em_analise' },
      { unidade: 'CAMACARI', valor_solicitado: 50, status_god: 'nok', status_geo: 'em_analise', status_rpo: 'em_analise' },
      { unidade: 'CAMACARI', valor_solicitado: 30, status_god: 'em_analise', status_geo: 'em_analise', status_rpo: 'em_analise' },
      { unidade: 'ARACAJU', valor_solicitado: 10, status_god: 'em_analise', status_geo: 'em_analise', status_rpo: 'em_analise' },
    ])
    expect(linhas).toEqual([
      { unidade: 'CAMACARI', valorSolicitado: 180, valorAprovado: 100, valorEmAnalise: 30, valorReprovado: 50 },
      { unidade: 'ARACAJU', valorSolicitado: 10, valorAprovado: 0, valorEmAnalise: 10, valorReprovado: 0 },
    ])
  })
})
