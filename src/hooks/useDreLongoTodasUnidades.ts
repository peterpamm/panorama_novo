import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DreLongoRow } from '@/types'

const PAGE_SIZE = 1000

/**
 * Busca todas as linhas de vw_dre_longo visíveis ao usuário atual, sem
 * filtrar por unidade — usado pela página Ranking, que compara várias
 * unidades ao mesmo tempo. O RLS de `dre_lancamentos` já restringe o
 * resultado: admin/AMBEV veem todas as unidades, usuário comum só vê a
 * própria unidade + AMBEV (mesma regra das outras páginas).
 */
export function useDreLongoTodasUnidades() {
  const [rows, setRows] = useState<DreLongoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)

    async function carregarTudo() {
      const todas: DreLongoRow[] = []
      let from = 0
      while (true) {
        const { data, error: err } = await supabase
          .from('vw_dre_longo')
          .select('*')
          .range(from, from + PAGE_SIZE - 1)

        if (err) throw err
        if (!data || data.length === 0) break
        todas.push(...(data as DreLongoRow[]))
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
      return todas
    }

    carregarTudo()
      .then(todas => {
        if (!ativo) return
        setRows(todas)
        setError(null)
      })
      .catch((err: Error) => {
        if (!ativo) return
        setError(err.message)
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [])

  return { rows, loading, error }
}
