import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DreLongoRow, MetaPerdas, PainelPerdasAux } from '@/types'

interface DataContextValue {
  rowsDreTodas: DreLongoRow[]
  rowsAux: PainelPerdasAux[]
  metasPerdas: MetaPerdas[]
  loading: boolean
  error: string | null
  revalidar: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

/** Busca todas as linhas de uma tabela/view com paginação paralela (sem waterfall de requests). */
async function fetchAllPages<T>(tabela: string): Promise<T[]> {
  const PAGE = 1000

  // 1. Conta total de linhas (1 request)
  const { count, error: errCount } = await supabase
    .from(tabela)
    .select('*', { count: 'exact', head: true })

  if (errCount) throw errCount
  if (!count) return []

  // 2. Busca todas as páginas em paralelo (em vez de sequencial)
  const numPaginas = Math.ceil(count / PAGE)
  const resultados = await Promise.all(
    Array.from({ length: numPaginas }, (_, i) =>
      supabase
        .from(tabela)
        .select('*')
        .range(i * PAGE, Math.min((i + 1) * PAGE - 1, count - 1)),
    ),
  )

  const linhas: T[] = []
  for (const r of resultados) {
    if (r.error) throw r.error
    linhas.push(...(r.data as T[]))
  }
  return linhas
}

/**
 * Provider que busca os três datasets pesados uma única vez por sessão e os
 * compartilha com todas as páginas. Navegar entre Farol → Ranking → Painel de
 * Perdas não refaz nenhum fetch — os dados já estão em memória.
 *
 * Após uma importação, chame `revalidar()` para recarregar.
 */
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [rowsDreTodas, setRowsDreTodas] = useState<DreLongoRow[]>([])
  const [rowsAux, setRowsAux] = useState<PainelPerdasAux[]>([])
  const [metasPerdas, setMetasPerdas] = useState<MetaPerdas[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Os três datasets são buscados em paralelo entre si, e cada um
      // tem suas páginas internas também em paralelo.
      const [dre, aux, metas] = await Promise.all([
        fetchAllPages<DreLongoRow>('vw_dre_longo'),
        fetchAllPages<PainelPerdasAux>('painel_perdas_aux'),
        fetchAllPages<MetaPerdas>('metas_perdas'),
      ])
      setRowsDreTodas(dre)
      setRowsAux(aux)
      setMetasPerdas(metas)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  return (
    <DataContext.Provider value={{ rowsDreTodas, rowsAux, metasPerdas, loading, error, revalidar: carregar }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData precisa estar dentro de DataProvider')
  return ctx
}
