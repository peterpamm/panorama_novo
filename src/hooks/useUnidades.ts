import { useData } from '@/context/DataContext'

/**
 * Lista de unidades — vem do cache global (`DataContext`, mesma busca de
 * `useDreLongoTodasUnidades`/`useOrcamentoTodasUnidades`). Antes cada
 * chamada disparava sua própria busca independente — como esse hook é usado
 * em dezenas de componentes (inclusive vários ao mesmo tempo, ex: o Resumo
 * Geral da Reunião Resultados monta 6+ instâncias juntas), cada uma
 * terminava num momento diferente e a tela "piscava" (uma parte pronta,
 * outra ainda com lista vazia, até a própria buscar terminar).
 */
export function useUnidades() {
  const { unidades, loading, revalidar } = useData()
  return { unidades, loading, recarregar: revalidar }
}
