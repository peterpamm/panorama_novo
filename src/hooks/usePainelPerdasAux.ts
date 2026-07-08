import { useData } from '@/context/DataContext'

/** Retorna os registros de painel_perdas_aux do cache global (sem re-fetch na navegação). */
export function usePainelPerdasAux() {
  const { rowsAux: rows, loading, error, revalidar: recarregar } = useData()
  return { rows, loading, error, recarregar }
}
