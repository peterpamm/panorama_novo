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

const CONFIG = TELAS_FROTA.find(t => t.slug === 'manutencoes')!

/**
 * Tela 3 — Manutenções (118, folhas 119-131 — 13 itens: veículos próprios,
 * Scania, carroceria carreta, lubrificantes, acessórios, reboque/guincho,
 * avarias e sinistros, tacógrafos, adesivagem, despesas diversas, forração
 * de carretas, aferição tacógrafo/fumaça e Desconto Ifollow). Pareto é o
 * centro dessa tela.
 */
export function SlideManutencoes(props: Props) {
  return <TelaFrotaBase config={CONFIG} {...props} />
}
