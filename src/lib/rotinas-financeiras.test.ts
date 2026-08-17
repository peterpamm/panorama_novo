import { describe, expect, it } from 'vitest'
import { calcularAderenciaPorUnidade, chaveStatus, mapaStatusExibicao, mesAnterior } from './rotinas-financeiras'
import type { RotinaFinanceiraStatus } from '@/types'

function status(rotina_id: string, unidade: string, mes: number, s: RotinaFinanceiraStatus['status']): RotinaFinanceiraStatus {
  return { rotina_id, unidade, ano: 2026, mes, status: s, observacao: '' }
}

describe('mesAnterior', () => {
  it('volta um mês dentro do mesmo ano', () => {
    expect(mesAnterior(2026, 5)).toEqual({ ano: 2026, mes: 4 })
  })

  it('vira o ano em janeiro', () => {
    expect(mesAnterior(2026, 1)).toEqual({ ano: 2025, mes: 12 })
  })
})

describe('mapaStatusExibicao', () => {
  it('usa a resposta do próprio mês', () => {
    const mapa = mapaStatusExibicao([status('r1', 'FOZ', 5, 'OK')], [])
    expect(mapa.get(chaveStatus('r1', 'FOZ'))).toEqual({ status: 'OK', observacao: '', herdado: false })
  })

  it('herda N/A do mês anterior quando o mês atual ainda não foi respondido', () => {
    const mapa = mapaStatusExibicao([], [status('r1', 'FOZ', 4, 'N/A')])
    expect(mapa.get(chaveStatus('r1', 'FOZ'))).toEqual({ status: 'N/A', observacao: '', herdado: true })
  })

  it('resposta do mês sempre vence a herança', () => {
    const mapa = mapaStatusExibicao([status('r1', 'FOZ', 5, 'OK')], [status('r1', 'FOZ', 4, 'N/A')])
    expect(mapa.get(chaveStatus('r1', 'FOZ'))).toMatchObject({ status: 'OK', herdado: false })
  })

  it('OK/NOK do mês anterior não herdam', () => {
    const mapa = mapaStatusExibicao([], [status('r1', 'FOZ', 4, 'OK'), status('r2', 'FOZ', 4, 'NOK')])
    expect(mapa.size).toBe(0)
  })

  it('não mistura unidades diferentes', () => {
    const mapa = mapaStatusExibicao([status('r1', 'FOZ', 5, 'OK')], [status('r1', 'CASCAVEL', 4, 'N/A')])
    expect(mapa.get(chaveStatus('r1', 'CASCAVEL'))).toMatchObject({ status: 'N/A', herdado: true })
    expect(mapa.get(chaveStatus('r1', 'FOZ'))).toMatchObject({ status: 'OK' })
  })
})

describe('calcularAderenciaPorUnidade', () => {
  const rotinasIds = new Set(['r1', 'r2', 'r3'])

  it('calcula % = OK / (OK + NOK), ignorando N/A', () => {
    const statusAno: RotinaFinanceiraStatus[] = [
      status('r1', 'FOZ', 1, 'OK'),
      status('r2', 'FOZ', 1, 'OK'),
      status('r3', 'FOZ', 1, 'NOK'),
      status('r1', 'FOZ', 1, 'N/A'), // não deveria acontecer (mesma rotina duas vezes), mas se acontecer, N/A não conta
    ]
    const { porMes } = calcularAderenciaPorUnidade(rotinasIds, statusAno, 'FOZ')
    expect(porMes[0]).toBeCloseTo((2 / 3) * 100)
  })

  it('ignora rotinas de outra unidade e rotinas fora do conjunto ativo', () => {
    const statusAno: RotinaFinanceiraStatus[] = [
      status('r1', 'FOZ', 1, 'OK'),
      status('r1', 'DIADEMA', 1, 'NOK'),
      status('rX', 'FOZ', 1, 'NOK'), // rotina não está em rotinasIds
    ]
    const { porMes } = calcularAderenciaPorUnidade(rotinasIds, statusAno, 'FOZ')
    expect(porMes[0]).toBe(100)
  })

  it('mês sem nenhuma rotina OK/NOK respondida fica null (não conta como 0%)', () => {
    const { porMes } = calcularAderenciaPorUnidade(rotinasIds, [], 'FOZ')
    expect(porMes[0]).toBeNull()
    expect(porMes).toHaveLength(12)
  })

  it('acumulado soma OK e total de todos os meses do ano', () => {
    const statusAno: RotinaFinanceiraStatus[] = [
      status('r1', 'FOZ', 1, 'OK'),
      status('r2', 'FOZ', 1, 'NOK'),
      status('r1', 'FOZ', 2, 'OK'),
      status('r2', 'FOZ', 2, 'OK'),
    ]
    const { acumulado } = calcularAderenciaPorUnidade(rotinasIds, statusAno, 'FOZ')
    expect(acumulado).toBeCloseTo((3 / 4) * 100)
  })

  it('acumulado null quando não há nenhum dado no ano inteiro', () => {
    const { acumulado } = calcularAderenciaPorUnidade(rotinasIds, [], 'FOZ')
    expect(acumulado).toBeNull()
  })
})
