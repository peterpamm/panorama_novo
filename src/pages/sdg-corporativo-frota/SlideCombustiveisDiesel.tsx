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

const CONFIG = TELAS_FROTA.find(t => t.slug === 'combustiveis')!

/**
 * Tela 2 — Combustíveis/Diesel (116 → 117 Óleo Diesel). Responde: o consumo
 * de diesel está dentro do % planejado sobre a receita? Quais unidades estão
 * fora? O Pareto aqui é degenerado (117 é a única folha), mas mantido por
 * consistência do template — o valor real da tela está nos indicadores e no
 * comparativo por unidade.
 */
export function SlideCombustiveisDiesel(props: Props) {
  return <TelaFrotaBase config={CONFIG} {...props} />
}
