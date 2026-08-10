import { calcularSemaforo } from '@/lib/farol-calculations'
import { COR_AVR } from '@/components/farol/chart-shared'
import type { Natureza } from '@/types'

/**
 * Verde/vermelho mais escuros (Adobe Color), só pros gráficos do SDG
 * Corporativo — diferente do COR_POSITIVO/COR_NEGATIVO padrão do resto do
 * app (Farol de Metas, RV etc.), que continuam com os tons claros de sempre.
 */
export const COR_BATEU_CORP = '#014B43'
export const COR_PERDEU_CORP = '#9C1B1E'

/** Mesma lógica do `corPorSemaforo` (chart-shared.tsx), só que com os tons escuros do SDG Corporativo. */
export function corBarraCorporativo(valor: number, meta: number | null, natureza: Natureza): string {
  if (meta === null) return COR_AVR
  const { corClasse } = calcularSemaforo(valor, meta, natureza)
  if (corClasse === 'positivo') return COR_BATEU_CORP
  if (corClasse === 'negativo') return COR_PERDEU_CORP
  return COR_AVR
}
