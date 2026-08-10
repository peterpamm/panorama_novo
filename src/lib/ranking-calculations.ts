import type { DreLongoRow, Natureza, OrcamentoLinha } from '@/types'
import { CONTA_RECEITA } from '@/lib/constants'
import {
  avrPorPrefixo,
  calcularImpactoFinanceiro,
  calcularReceita,
  calcularSemaforo,
  normalizarParaCalculo,
} from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'

/** Período do Ranking — mesmas opções do Farol de Metas (Mensal/YTD/1º/2º semestre). */
export type PeriodoRanking = 'mensal' | 'ytd' | 's1' | 's2'

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

/**
 * Linhas do DRE de uma unidade pro período escolhido — mesma régua do Farol de
 * Metas: Mensal usa o mês selecionado; YTD usa o acumulado do mês mais recente
 * importado; 1º semestre usa o acumulado direto quando ele ainda é Jan-Jun
 * (número exato do GInfo) ou reconstrói somando Jan-Jun depois que julho for
 * importado; 2º semestre sempre reconstrói somando Jul-Dez (não existe
 * acumulado "só do 2º semestre" na view, que conta sempre desde janeiro).
 */
function rowsParaPeriodo(rowsUnidade: DreLongoRow[], periodo: PeriodoRanking, mes: number): DreLongoRow[] {
  if (periodo === 'mensal') return rowsUnidade.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === mes)
  if (periodo === 'ytd') return rowsAcumuladoMesMax(rowsUnidade)
  if (periodo === 's1') {
    const acumulado = rowsAcumuladoMesMax(rowsUnidade)
    const mesMax = acumulado.length > 0 ? acumulado[0].mes : null
    if (mesMax !== null && mesMax <= 6) return acumulado
    return rowsUnidade.filter(r => r.tipo_periodo === 'MENSAL' && r.mes >= 1 && r.mes <= 6)
  }
  return rowsUnidade.filter(r => r.tipo_periodo === 'MENSAL' && r.mes >= 7 && r.mes <= 12)
}

/** Separa AMBEV (sempre no fim, sem rank) das demais unidades, ordena as demais por `chave` (decrescente, null por último) e atribui rank 1..N. */
export function atribuirRank<T extends { unidade: string; rank: number | null }>(linhas: T[], chave: (l: T) => number | null): T[] {
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
  realizado: number
  /** Receita Líquida Operacional orçada (tabela `orcamentos`, conta 002) do mesmo período do `realizado` — null se não há orçamento importado. */
  orcado: number | null
  /** Impacto em R$: realizado − orçado. Positivo = faturou acima do orçado; negativo = abaixo. Null se não há orçado. */
  impacto: number | null
  percentualAtingimento: number | null
  rank: number | null
}

function somaOrcado(orcamentoUnidade: OrcamentoLinha[], meses: number[]): number | null {
  const linhas = orcamentoUnidade.filter(o => meses.includes(o.mes))
  return linhas.length === 0 ? null : linhas.reduce((acc, o) => acc + o.orcado, 0)
}

/**
 * Aba Receita: compara a Receita Líquida Operacional realizada com a orçada
 * (tabela `orcamentos`, conta 002), sempre no mesmo recorte de meses dos dois
 * lados — Mensal compara mês a mês; YTD soma o orçado só até o mesmo mês do
 * acumulado realizado de cada unidade (nunca o ano orçado inteiro); 1º/2º
 * semestre usa o bloco recalculado (mes=13/14 — tela Administração > Orçamento
 * > Recalcular semestres) quando existe, senão soma os 6 meses do semestre.
 */
export function calcularRankingReceita(
  rowsNegocioAno: DreLongoRow[],
  orcamentoRows: OrcamentoLinha[],
  params: { negocio: string; ano: number; periodo: PeriodoRanking; mes: number },
): RankingLinhaReceita[] {
  const unidades = unicos(rowsNegocioAno.map(r => r.unidade))

  const linhas = unidades.map(unidade => {
    const rowsUnidade = rowsNegocioAno.filter(r => r.unidade === unidade)
    const orcamentoUnidade = orcamentoRows.filter(o => o.unidade === unidade && o.conta_codigo === CONTA_RECEITA)

    const realizado = calcularReceita(normalizarParaCalculo(rowsParaPeriodo(rowsUnidade, params.periodo, params.mes)))

    let orcado: number | null
    if (params.periodo === 'mensal') {
      orcado = somaOrcado(orcamentoUnidade, [params.mes])
    } else if (params.periodo === 'ytd') {
      const acumulado = rowsAcumuladoMesMax(rowsUnidade)
      const mesMax = acumulado.length > 0 ? acumulado[0].mes : 0
      orcado = somaOrcado(orcamentoUnidade, Array.from({ length: mesMax }, (_, i) => i + 1))
    } else {
      const mesSemestral = params.periodo === 's1' ? 13 : 14
      const mesesFallback = params.periodo === 's1' ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12]
      orcado = somaOrcado(orcamentoUnidade, [mesSemestral]) ?? somaOrcado(orcamentoUnidade, mesesFallback)
    }

    const percentualAtingimento = orcado !== null && orcado !== 0 ? (realizado / orcado) * 100 : null
    const impacto = orcado !== null ? realizado - orcado : null

    return { unidade, realizado, orcado, impacto, percentualAtingimento, rank: null as number | null }
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
 * sinal já correto por natureza via `calcularSemaforo`). Meta vem só do
 * Orçamento (`buscarMetaOrcamento` — mesma régua do Farol de Metas): Mensal
 * usa o mês selecionado (1-12), YTD usa o orçado anual (mes=0 — compara o
 * acumulado do ano contra o total orçado, mesmo padrão do Farol), 1º/2º
 * semestre usa o bloco recalculado (mes=13/14 — Administração > Orçamento >
 * Recalcular semestres). Sem fallback pra tabela `metas`/AVO do DRE.
 */
export function calcularRankingIndicador(
  rowsNegocioAno: DreLongoRow[],
  orcamentoRows: OrcamentoLinha[],
  pacote: { natureza: Natureza; prefixos: string[] },
  codigo: string,
  params: { negocio: string; ano: number; periodo: PeriodoRanking; mes: number },
): RankingLinhaIndicador[] {
  const unidades = unicos(rowsNegocioAno.map(r => r.unidade))

  const linhas = unidades.map(unidade => {
    const rowsUnidade = rowsNegocioAno.filter(r => r.unidade === unidade)
    const calc = normalizarParaCalculo(rowsParaPeriodo(rowsUnidade, params.periodo, params.mes))
    const avr = avrPorPrefixo(calc, pacote.prefixos)
    const receita = calcularReceita(calc)

    const mesOrcamento = params.periodo === 's1' ? 13
      : params.periodo === 's2' ? 14
        : params.periodo === 'ytd' ? 0
          : params.mes
    const meta = buscarMetaOrcamento(orcamentoRows, { unidade, negocio: params.negocio, ano: params.ano, codigo, mes: mesOrcamento })

    const semaforo = calcularSemaforo(avr, meta, pacote.natureza)
    const impacto = calcularImpactoFinanceiro(avr, meta, receita, pacote.natureza)

    return { unidade, avr, meta, delta: semaforo.delta, impacto, rank: null as number | null }
  })

  return atribuirRank(linhas, l => l.delta)
}
