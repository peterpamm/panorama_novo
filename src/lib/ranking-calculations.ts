import type { DreLongoRow, Meta, Natureza } from '@/types'
import { CONTA_RECEITA } from '@/lib/constants'
import {
  avrPorPrefixo,
  buscarMeta,
  buscarMetaComFallback,
  calcularImpactoFinanceiro,
  calcularReceita,
  calcularSemaforo,
  normalizarParaCalculo,
} from '@/lib/farol-calculations'

function unicos<T>(valores: T[]): T[] {
  return Array.from(new Set(valores))
}

/** Linhas ACUMULADO_ANO de uma unidade, só as do mês mais recente importado (mes_max) — mesmo padrão já usado no Farol/Abertura de Contas. */
function rowsAcumuladoMesMax(rowsUnidade: DreLongoRow[]): DreLongoRow[] {
  const acumulado = rowsUnidade.filter(r => r.tipo_periodo === 'ACUMULADO_ANO')
  if (acumulado.length === 0) return []
  const mesMax = Math.max(...acumulado.map(r => r.mes))
  return acumulado.filter(r => r.mes === mesMax)
}

/** Separa AMBEV (sempre no fim, sem rank) das demais unidades, ordena as demais por `chave` (decrescente, null por último) e atribui rank 1..N. */
function atribuirRank<T extends { unidade: string; rank: number | null }>(linhas: T[], chave: (l: T) => number | null): T[] {
  const normais = linhas.filter(l => l.unidade !== 'AMBEV')
  const ambev = linhas.filter(l => l.unidade === 'AMBEV')

  normais.sort((a, b) => {
    const va = chave(a)
    const vb = chave(b)
    if (va === null && vb === null) return 0
    if (va === null) return 1
    if (vb === null) return -1
    return vb - va
  })
  normais.forEach((l, i) => { l.rank = i + 1 })
  ambev.forEach(l => { l.rank = null })

  return [...normais, ...ambev]
}

export interface RankingLinhaReceita {
  unidade: string
  receitaYtd: number
  metaAnual: number | null
  percentualAtingimento: number | null
  rank: number | null
}

/** Aba Receita: ranqueia por % de atingimento da meta anual (sempre YTD, igual ao painel antigo, independente do modo Mensal/Anual escolhido). */
export function calcularRankingReceita(rowsNegocioAno: DreLongoRow[], metasNegocioAno: Meta[], params: { negocio: string; ano: number }): RankingLinhaReceita[] {
  const unidades = unicos(rowsNegocioAno.map(r => r.unidade))

  const linhas = unidades.map(unidade => {
    const rowsUnidade = rowsNegocioAno.filter(r => r.unidade === unidade)
    const calc = normalizarParaCalculo(rowsAcumuladoMesMax(rowsUnidade))
    const receitaYtd = calcularReceita(calc)

    const metasUnidade = metasNegocioAno.filter(m => m.unidade === unidade)
    const metaAnual = buscarMeta(metasUnidade, { unidade, negocio: params.negocio, ano: params.ano, codigo: CONTA_RECEITA, isYtd: true, mes: 0 })

    const percentualAtingimento = metaAnual !== null && metaAnual !== 0 ? (receitaYtd / metaAnual) * 100 : null

    return { unidade, receitaYtd, metaAnual, percentualAtingimento, rank: null as number | null }
  })

  return atribuirRank(linhas, l => l.percentualAtingimento)
}

/** Verde se atingiu (>=100%) a meta de receita, vermelho se não, sem cor se não há meta cadastrada. */
export function corClasseAtingimento(percentual: number | null): 'positivo' | 'negativo' | 'semCor' {
  if (percentual === null) return 'semCor'
  return percentual >= 100 ? 'positivo' : 'negativo'
}

export interface RankingLinhaIndicador {
  unidade: string
  avr: number
  meta: number | null
  delta: number | null
  impacto: number
  rank: number | null
}

/**
 * Abas Performance/Custos: ranqueia por Δ da meta (avrPorPrefixo - meta, com
 * sinal já correto por natureza via `calcularSemaforo`). No modo Mensal, usa
 * o mês selecionado; no modo Anual (YTD), usa o acumulado do mês mais
 * recente importado — mesma régua do Farol de Metas.
 */
export function calcularRankingIndicador(
  rowsNegocioAno: DreLongoRow[],
  metasNegocioAno: Meta[],
  pacote: { natureza: Natureza; prefixos: string[] },
  codigo: string,
  params: { negocio: string; ano: number; isYtd: boolean; mes: number },
): RankingLinhaIndicador[] {
  const unidades = unicos(rowsNegocioAno.map(r => r.unidade))

  const linhas = unidades.map(unidade => {
    const rowsUnidade = rowsNegocioAno.filter(r => r.unidade === unidade)
    const rowsPeriodo = params.isYtd
      ? rowsAcumuladoMesMax(rowsUnidade)
      : rowsUnidade.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === params.mes)

    const calc = normalizarParaCalculo(rowsPeriodo)
    const avr = avrPorPrefixo(calc, pacote.prefixos)
    const receita = calcularReceita(calc)

    const metasUnidade = metasNegocioAno.filter(m => m.unidade === unidade)
    const meta = buscarMetaComFallback(calc, metasUnidade, {
      unidade, negocio: params.negocio, ano: params.ano, codigo, isYtd: params.isYtd, mes: params.mes, prefixos: pacote.prefixos,
    })

    const semaforo = calcularSemaforo(avr, meta, pacote.natureza)
    const impacto = calcularImpactoFinanceiro(avr, meta, receita, pacote.natureza)

    return { unidade, avr, meta, delta: semaforo.delta, impacto, rank: null as number | null }
  })

  return atribuirRank(linhas, l => l.delta)
}
