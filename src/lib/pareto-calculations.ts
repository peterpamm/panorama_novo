import type { DreCalculoRow } from '@/types'
import { agregarPorConta } from '@/lib/top-contas'

export interface LinhaPareto {
  codigo: string
  realizado: number
  /** % do total da faixa (soma de `realizado` de todas as linhas retornadas). */
  percentualDoTotal: number
  /** % acumulado até essa linha, na ordem retornada (maior realizado primeiro) — é a curva do Pareto. */
  percentualAcumulado: number
}

export interface OpcoesPareto {
  /** Contas a deixar de fora do ranking (ex: as totalizadoras — 118 "Gastos com Manutenções" não entra junto das suas subcontas 119-131, senão contaria o mesmo custo duas vezes). */
  excluir?: readonly string[]
}

/**
 * Pareto de ofensores: agrega uma faixa de contas (mesma base de
 * `agregarPorConta`, reaproveitada de `top-contas.ts` — não duplica o loop
 * de soma por `conta_codigo`), ordena pelo maior REALIZADO primeiro (`real`
 * já vem em magnitude — `Math.abs` — de `normalizarParaCalculo`, então não
 * precisa de `Math.abs` aqui) e calcula o % de cada conta sobre o total da
 * faixa mais o % acumulado — a curva clássica de Pareto, pra destacar quem
 * puxa os 80% do custo. Contas zeradas (sem realizado nem gap) já saem
 * filtradas por `agregarPorConta`, que é a régua de "só entra quem tem
 * registro de AVO e/ou AVR" pedida — hoje, na prática, é sempre AVR: nenhuma
 * subconta de Frota tem meta do Orçamento cadastrada ainda (ver comentário
 * em `PACOTE_CONTA_ORCAMENTO`, constants.ts).
 */
export function calcularParetoContas(
  rows: DreCalculoRow[],
  contaIni: number,
  contaFim: number,
  { excluir = [] }: OpcoesPareto = {},
): LinhaPareto[] {
  const linhas = agregarPorConta(rows, contaIni, contaFim, excluir).sort((a, b) => b.realizado - a.realizado)
  const total = linhas.reduce((acc, l) => acc + l.realizado, 0)

  let acumulado = 0
  return linhas.map(l => {
    const percentualDoTotal = total === 0 ? 0 : (l.realizado / total) * 100
    acumulado += percentualDoTotal
    return { codigo: l.codigo, realizado: l.realizado, percentualDoTotal, percentualAcumulado: acumulado }
  })
}

/** Mesma curva de Pareto, mas agregando por UNIDADE em vez de por conta — usado pro Pareto "por unidade" (ex: Tela de Pneus, que pede os dois). `realizadoPorUnidade` já vem pronto (soma do que se quer paretoizar por unidade, ex: gasto com pneus de cada unidade). */
export function calcularParetoUnidades(realizadoPorUnidade: Map<string, number>): LinhaPareto[] {
  const linhas = Array.from(realizadoPorUnidade.entries())
    .map(([codigo, realizado]) => ({ codigo, realizado }))
    .filter(l => l.realizado !== 0)
    .sort((a, b) => b.realizado - a.realizado)
  const total = linhas.reduce((acc, l) => acc + l.realizado, 0)

  let acumulado = 0
  return linhas.map(l => {
    const percentualDoTotal = total === 0 ? 0 : (l.realizado / total) * 100
    acumulado += percentualDoTotal
    return { codigo: l.codigo, realizado: l.realizado, percentualDoTotal, percentualAcumulado: acumulado }
  })
}
