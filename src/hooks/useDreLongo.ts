import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DreLongoRow } from '@/types'

/**
 * Busca todas as linhas de mv_dre_longo para uma unidade específica.
 * Usa paginação paralela para evitar o waterfall de requests sequenciais.
 * A view materializada elimina o CROSS JOIN da view original — queries
 * passam de ~2-5s para ~50ms antes de qualquer dado chegar ao cliente.
 */
export function useDreLongo(unidade: string | null) {
  const [rows, setRows] = useState<DreLongoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!unidade) {
      setRows([])
      setLoading(false)
      return
    }

    let ativo = true
    setLoading(true)

    async function carregarTudo() {
      const PAGE = 10000
      const TABELA = 'mv_dre_longo'

      // 1. Conta as linhas da unidade (1 request rápido com índice)
      const { count, error: errCount } = await supabase
        .from(TABELA)
        .select('*', { count: 'exact', head: true })
        .eq('unidade', unidade)

      if (errCount) throw errCount
      if (!count) return []

      // 2. Busca todas as páginas em paralelo
      const numPaginas = Math.ceil(count / PAGE)
      const resultados = await Promise.all(
        Array.from({ length: numPaginas }, (_, i) =>
          supabase
            .from(TABELA)
            .select('*')
            .eq('unidade', unidade)
            .range(i * PAGE, Math.min((i + 1) * PAGE - 1, count - 1)),
        ),
      )

      const todas: DreLongoRow[] = []
      for (const r of resultados) {
        if (r.error) throw r.error
        todas.push(...(r.data as DreLongoRow[]))
      }
      return todas
    }

    carregarTudo()
      .then(todas => {
        if (!ativo) return
        setRows(todas ?? [])
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
  }, [unidade])

  return { rows, loading, error }
}
