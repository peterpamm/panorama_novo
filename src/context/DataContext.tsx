import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DreLongoRow, MetaPerdas, PainelPerdasAux } from '@/types'

interface DataContextValue {
  rowsDreTodas: DreLongoRow[]
  rowsAux: PainelPerdasAux[]
  metasPerdas: MetaPerdas[]
  loading: boolean
  error: string | null
  /** Recarrega os datasets sem refresh da view materializada (ex: navegação pós-erro). */
  revalidar: () => Promise<void>
  /** Atualiza a view materializada no Supabase e depois recarrega os datasets. Chame após importação de DRE. */
  revalidarAposImport: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

/**
 * Busca todas as páginas de uma tabela/view em lotes paralelos.
 * Em vez de disparar todos os requests de uma vez (que esgota o pool de
 * conexões do Supabase), processa em grupos de CONCURRENT páginas por vez.
 */
async function fetchAllPages<T>(tabela: string): Promise<T[]> {
  const PAGE = 10000   // requer Max Rows = 10000 em Project Settings → API
  const CONCURRENT = 20

  const { count, error: errCount } = await supabase
    .from(tabela)
    .select('*', { count: 'exact', head: true })

  if (errCount) throw errCount
  if (!count) return []

  const numPaginas = Math.ceil(count / PAGE)
  const linhas: T[] = []

  for (let base = 0; base < numPaginas; base += CONCURRENT) {
    const lote = Array.from(
      { length: Math.min(CONCURRENT, numPaginas - base) },
      (_, j) => {
        const i = base + j
        return supabase
          .from(tabela)
          .select('*')
          .range(i * PAGE, Math.min((i + 1) * PAGE - 1, count - 1))
      },
    )
    const resultados = await Promise.all(lote)
    for (const r of resultados) {
      if (r.error) throw r.error
      linhas.push(...(r.data as T[]))
    }
  }

  return linhas
}

/**
 * Busca mv_dre_longo completo com paginação paralela.
 * A view materializada pré-computa o CROSS JOIN — queries que antes
 * levavam 2-5s (full table scan + CROSS JOIN) passam a ~50ms (leitura indexada).
 */
async function fetchDreLongo(): Promise<DreLongoRow[]> {
  return fetchAllPages<DreLongoRow>('mv_dre_longo')
}

/**
 * Provider que busca os três datasets pesados uma única vez por sessão e os
 * compartilha com todas as páginas. Navegar entre Farol → Ranking → Painel de
 * Perdas não refaz nenhum fetch — os dados já estão em memória.
 *
 * Após uma importação de DRE, chame `revalidarAposImport()` para atualizar
 * a view materializada no Supabase e recarregar o cache.
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
      const [dre, aux, metas] = await Promise.all([
        fetchDreLongo(),
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

  const revalidarAposImport = useCallback(async () => {
    await supabase.rpc('refresh_mv_dre_longo')
    await carregar()
  }, [carregar])

  useEffect(() => {
    carregar()
  }, [carregar])

  return (
    <DataContext.Provider
      value={{ rowsDreTodas, rowsAux, metasPerdas, loading, error, revalidar: carregar, revalidarAposImport }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData precisa estar dentro de DataProvider')
  return ctx
}
