import type { DreCalculoRow } from '@/types'

export interface LinhaTopConta {
  codigo: string
  realizado: number
  gap: number
}

export interface OpcoesTopContas {
  topN?: number
  /** Contas a deixar de fora do ranking (ex: as totalizadoras, que só repetem a soma das subcontas). */
  excluir?: readonly string[]
}

/**
 * Agrega uma faixa de contas por `conta_codigo` (soma REAL em `realizado`,
 * soma DIF em `gap`) — base compartilhada de `topContasFaixa` (Top Contas da
 * Despesa ADM) e `calcularParetoContas` (Pareto de ofensores, SDG Frota):
 * as duas telas agregam o mesmo jeito, só a ORDENAÇÃO final diverge (pior
 * gap primeiro vs. maior realizado primeiro + % acumulado), então esse é o
 * único pedaço que vale a pena compartilhar — nenhuma das duas reimplementa
 * o loop de agregação. Contas zeradas (sem realizado nem gap) já saem
 * filtradas aqui.
 *
 * Compara por número, não por texto: assim "157" e "0157" são a mesma
 * conta, do mesmo jeito que a faixa `contaIni`/`contaFim` já trata.
 */
export function agregarPorConta(
  rows: DreCalculoRow[],
  contaIni: number,
  contaFim: number,
  excluir: readonly string[] = [],
): LinhaTopConta[] {
  const excluirNum = new Set(excluir.map(Number))
  const porConta = new Map<string, LinhaTopConta>()
  for (const r of rows) {
    const num = Number(r.conta_codigo)
    if (!Number.isInteger(num) || num < contaIni || num > contaFim) continue
    if (excluirNum.has(num)) continue
    const atual = porConta.get(r.conta_codigo) ?? { codigo: r.conta_codigo, realizado: 0, gap: 0 }
    atual.realizado += r.real
    atual.gap += r.dif
    porConta.set(r.conta_codigo, atual)
  }
  return Array.from(porConta.values()).filter(c => c.realizado !== 0 || c.gap !== 0)
}

/**
 * Agrega uma faixa de contas (ex: 191–227, subcontas do pacote Despesas ADM
 * Gerais) e retorna as `topN` com pior gap (diferença mais negativa
 * primeiro). `excluir` tira contas específicas do ranking sem mexer na
 * faixa — usado pra esconder as totalizadoras, que aparecem no topo só por
 * serem a soma das subcontas que já estão logo abaixo.
 */
export function topContasFaixa(
  rows: DreCalculoRow[],
  contaIni: number,
  contaFim: number,
  { topN = 10, excluir = [] }: OpcoesTopContas = {},
): LinhaTopConta[] {
  return agregarPorConta(rows, contaIni, contaFim, excluir)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, topN)
}
