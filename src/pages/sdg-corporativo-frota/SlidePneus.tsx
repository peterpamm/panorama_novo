import { TelaFrotaBase } from './TelaFrotaBase'
import { TELAS_FROTA } from './frota-contas'
import type { DreLongoRow, OrcamentoLinha, Unidade } from '@/types'

interface Props {
  rowsAno: DreLongoRow[]
  orcamentoAno: OrcamentoLinha[]
  unidades: Unidade[]
  negocio: string
  ano: number
  mes: number
  periodo: 'mensal' | 'ytd'
  unidadesSelecionadas: Set<string>
  mostrarPorUnidade: boolean
}

const CONFIG = TELAS_FROTA.find(t => t.slug === 'pneus')!

/**
 * Tela 4 — Pneus (132, folhas 133 Pneus/134 Recapagens/135 Borracharia).
 * Pareto duplo — por subconta e por unidade, único pedido explícito de
 * Pareto por unidade dentre as 4 telas.
 */
export function SlidePneus(props: Props) {
  return <TelaFrotaBase config={CONFIG} paretoPorUnidade {...props} />
}
