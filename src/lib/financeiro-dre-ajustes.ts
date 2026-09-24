import type { CelulaIndicador, LinhaIndicador } from '@/components/rv/TabelaIndicadorGenerica'
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

/**
 * Sobrepõe o ajuste manual (quando houver) nas células de uma tabela de
 * Acompanhamento de RV já montada (`LinhaIndicador[]`, ver
 * `TabelaIndicadorGenerica.tsx`) — mesma regra do `resultadoEMeta` de
 * `useReuniaoDados.ts` (dispersão ≥ 0 = meta batida), só que aplicada depois
 * do cálculo automático já pronto, porque `useIndicadorDreMatriz`/
 * `useValesIndicador` são hooks genéricos (compartilhados com outros
 * setores) que não sabem nada sobre ajuste de Financeiro.
 *
 * `l.key` é `unidade` (Vales) ou `unidade|negocio` (indicadores do DRE, ver
 * `linhasDreParaIndicador`) — o ajuste é só por unidade (sem negócio), então
 * usa sempre o primeiro pedaço antes do "|".
 */
export function aplicarAjusteFinanceiro(
  linhas: LinhaIndicador[],
  ajustes: FinanceiroDreAjuste[],
  ano: number | null,
  indicador: FinanceiroDreAjusteIndicador,
  formatarValor: (v: number) => string,
): LinhaIndicador[] {
  if (ano === null || ajustes.length === 0) return linhas
  const mapa = mapaAjustesFinanceiro(ajustes)
  return linhas.map(l => {
    const unidade = l.key.split('|')[0]
    let mudou = false
    const meses: (CelulaIndicador | null)[] = l.meses.map((celula, i) => {
      const ajuste = buscarAjusteFinanceiro(mapa, unidade, ano, i + 1, indicador)
      if (!ajuste) return celula
      mudou = true
      return {
        texto: formatarValor(ajuste.valor),
        tooltip: `Ajuste manual (bug do DRE)${ajuste.observacao ? ` — ${ajuste.observacao}` : ''} · dispersão ≥ 0 = meta batida`,
        bateu: ajuste.valor >= 0,
      }
    })
    return mudou ? { ...l, meses } : l
  })
}
