import type { FinanceiroDreAjuste, FinanceiroDreAjusteIndicador } from '@/types'

/**
 * Chave composta unidade+ano+mês+indicador — mesma convenção de chave
 * composta usada em todo o app (ex: `chaveUN` em useReuniaoDados.ts).
 */
export function chaveAjusteFinanceiro(unidade: string, ano: number, mes: number, indicador: FinanceiroDreAjusteIndicador): string {
  return `${unidade}|${ano}|${mes}|${indicador}`
}

/** Índice O(1) dos ajustes carregados, pra lookup dentro de loops de cálculo (useReuniaoDados/useRvApuracao). */
export function mapaAjustesFinanceiro(ajustes: FinanceiroDreAjuste[]): Map<string, FinanceiroDreAjuste> {
  return new Map(ajustes.map(a => [chaveAjusteFinanceiro(a.unidade, a.ano, a.mes, a.indicador), a]))
}

/** Busca o ajuste ativo (se houver) pra unidade×ano×mês×indicador — `undefined` = usa o valor automático do DRE normalmente. */
export function buscarAjusteFinanceiro(
  mapa: Map<string, FinanceiroDreAjuste>, unidade: string, ano: number, mes: number, indicador: FinanceiroDreAjusteIndicador,
): FinanceiroDreAjuste | undefined {
  return mapa.get(chaveAjusteFinanceiro(unidade, ano, mes, indicador))
}
