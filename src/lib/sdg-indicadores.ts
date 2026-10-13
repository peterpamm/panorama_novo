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

/**
 * Indicadores do SDG dos Gerentes — mesma ideia de `SDG_INDICADORES`, só que
 * pra alimentar o slide final "Plano de Ação" daquela apresentação
 * (`SlidePlanoAcaoGerentes.tsx`), agrupado por indicador, em vez de um slide
 * de Justificativa por indicador (que o SDG Gerentes não tem). Mesma ordem
 * dos slides em `SdgGerentesPage.tsx`.
 */
export const SDG_INDICADORES_GERENTES: { id: SdgIndicador; label: string }[] = [
  { id: 'gerentes-receita', label: 'SDG Gerentes · Receita Líquida' },
  { id: 'gerentes-ebitda', label: 'SDG Gerentes · EBITDA' },
  { id: 'gerentes-gastos-totais', label: 'SDG Gerentes · Gastos Totais' },
  { id: 'gerentes-pacote-de-gente', label: 'SDG Gerentes · Pacote de Gente' },
  { id: 'gerentes-pacote-de-frota', label: 'SDG Gerentes · Pacote de Frota' },
  { id: 'gerentes-despesa-adm', label: 'SDG Gerentes · Despesa Administrativa' },
  { id: 'gerentes-custos-freteiros', label: 'SDG Gerentes · Custos com Freteiros' },
  { id: 'gerentes-pacote-de-perdas', label: 'SDG Gerentes · Pacote de Perdas' },
]

export const SDG_INDICADOR_LABEL: Record<SdgIndicador, string> = Object.fromEntries(
  [...SDG_INDICADORES, ...SDG_INDICADORES_GERENTES].map(i => [i.id, i.label]),
) as Record<SdgIndicador, string>
