import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Meta } from '@/types'

const PAGE_SIZE = 1000

/** Busca todas as metas (todos os negócios/anos/meses) de uma unidade; filtragem fica no cliente. Pagina em lotes de 1000 (limite padrão do PostgREST). */
export function useMetas(unidade: string | null) {
  const [metas, setMetas] = useState<Meta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function recarregar() {
    if (!unidade) {
      setMetas([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const todas: Meta[] = []
      let from = 0
      while (true) {
        // .order() é obrigatório com .range() — sem ordem explícita o
        // Postgres não garante a mesma ordem entre duas chamadas separadas,
        // então uma página pode pular/repetir linhas (bug real já visto em
        // mv_dre_longo, ver DataContext.tsx).
        const { data, error: err } = await supabase
          .from('metas')
          .select('*')
          .eq('unidade', unidade)
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)
        if (err) throw err
        if (!data || data.length === 0) break
        todas.push(...(data as Meta[]))
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
      setMetas(todas)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidade])

  return { metas, loading, error, recarregar }
}
