import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { MetaPerdas } from '@/types'

const PAGE_SIZE = 1000

/** Busca todas as metas de Perdas visíveis ao usuário atual (todas as unidades/anos) — mesma lógica de `useMetasTodasUnidades`. */
export function useMetasPerdas() {
  const [metasPerdas, setMetasPerdas] = useState<MetaPerdas[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function recarregar() {
    setLoading(true)
    try {
      const todas: MetaPerdas[] = []
      let from = 0
      while (true) {
        const { data, error: err } = await supabase
          .from('metas_perdas')
          .select('*')
          .range(from, from + PAGE_SIZE - 1)
        if (err) throw err
        if (!data || data.length === 0) break
        todas.push(...(data as MetaPerdas[]))
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
      setMetasPerdas(todas)
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
  }, [])

  return { metasPerdas, loading, error, recarregar }
}
