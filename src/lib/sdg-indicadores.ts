import type { SdgIndicador } from '@/types'

/**
 * Indicadores "de resultado" do SDG com Justificativa própria (Área
 * Financeira > SDG Financeiro) — mesma ordem das slides na apresentação.
 * O pacote geral de Vales ('vales') não entra aqui: ele não tem Justificativa
 * própria, é só cards/gráfico/ranking — a Justificativa fica nos 4 slides
 * em que ele se abre (Vales Financeiros/Físicos/Refugo/Quebras).
 */
export const SDG_INDICADORES: { id: SdgIndicador; label: string }[] = [
  { id: 'ebitda', label: 'EBITDA' },
  { id: 'adm-geral', label: 'Despesa Administrativa' },
  { id: 'despesa-adm', label: 'Despesas ADM Gerais' },
  { id: 'vales-financeiros', label: 'Vales Financeiros' },
  { id: 'vales-fisicos', label: 'Vales Físicos' },
  { id: 'refugo', label: 'Refugo' },
  { id: 'quebras', label: 'Quebras' },
  { id: 'encontro-contas', label: 'Encontro de Contas' },
  { id: 'multas', label: 'Multas' },
]

export const SDG_INDICADOR_LABEL: Record<SdgIndicador, string> = Object.fromEntries(
  SDG_INDICADORES.map(i => [i.id, i.label]),
) as Record<SdgIndicador, string>
