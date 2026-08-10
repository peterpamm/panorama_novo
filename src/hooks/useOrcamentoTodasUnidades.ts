import { useData } from '@/context/DataContext'

/**
 * Todo o orçamento (todas unidades/negócios/anos), restrito às contas
 * realmente usadas por algum pacote do Farol/RV (`CONTAS_ORCAMENTO_USADAS` —
 * evita puxar as ~155 contas de cada aba quando só umas 17 importam pra
 * `buscarMetaOrcamento`). Vem do cache global (`DataContext`, mesma busca
 * de `useDreLongoTodasUnidades`) — antes cada chamada disparava sua própria
 * busca paginada independente, o que em telas como o Painel Geral da RV
 * (6 setores montados ao mesmo tempo) virava 6 buscas redundantes e
 * concorrentes, arriscando timeout e (pior) engolindo o erro em silêncio
 * como orçamento vazio ("sem meta cadastrada").
 */
export function useOrcamentoTodasUnidades() {
  const { orcamentos, loading, error } = useData()
  return { orcamentos, loading, error }
}
