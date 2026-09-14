import { TelaFrotaBase } from './TelaFrotaBase'
import { GRUPOS_FROTA, TELAS_FROTA } from './frota-contas'
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

const CONFIG = TELAS_FROTA.find(t => t.slug === 'visao-geral')!

/**
 * Tela 1 — Visão Geral dos Custos de Frota: a conta-mãe (114) aberta nos 3
 * grupos (Custos Variáveis/Fixos/Outros) + Pareto pela árvore de folhas
 * inteira (117, 119-131, 133-139, 141-143, 145-155). É a tela de abertura
 * da reunião de diretoria.
 */
export function SlideVisaoGeralFrota(props: Props) {
  return <TelaFrotaBase config={CONFIG} grupos={GRUPOS_FROTA} {...props} />
}
