import { useData } from '@/context/DataContext'

/** Retorna as metas de perdas do cache global (sem re-fetch na navegação). */
export function useMetasPerdas() {
  const { metasPerdas, loading, error, revalidar: recarregar } = useData()
  return { metasPerdas, loading, error, recarregar }
}
