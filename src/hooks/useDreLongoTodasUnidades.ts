import { useData } from '@/context/DataContext'

/** Retorna as linhas de vw_dre_longo do cache global (sem re-fetch na navegação). */
export function useDreLongoTodasUnidades() {
  const { rowsDreTodas: rows, loading, error } = useData()
  return { rows, loading, error }
}
