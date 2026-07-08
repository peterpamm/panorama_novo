import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PainelPerdasAux } from '@/types'

const PAGE_SIZE = 1000

/** Busca todos os registros de painel_perdas_aux visíveis ao usuário atual. */
export function usePainelPerdasAux() {
  const [rows, setRows] = useState<PainelPerdasAux[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function recarregar() {
    setLoading(true)
    try {
      const todas: PainelPerdasAux[] = []
      let from = 0
      while (true) {
        const { data, error: err } = await supabase
          .from('painel_perdas_aux')
          .select('*')
          .range(from, from + PAGE_SIZE - 1)
        if (err) throw err
        if (!data || data.length === 0) break
        todas.push(...(data as PainelPerdasAux[]))
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
      setRows(todas)
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

  return { rows, loading, error, recarregar }
}
