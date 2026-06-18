import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DreLongoRow } from '@/types'

const PAGE_SIZE = 1000

/**
 * Busca todas as linhas (todos os negócios e anos) de vw_dre_longo para uma
 * unidade. O filtro por negócio/ano/mês é feito no cliente, espelhando o
 * padrão do Streamlit original (carrega o histórico inteiro em memória e
 * filtra com pandas).
 *
 * Pagina em lotes de 1000 — o PostgREST do Supabase corta qualquer resposta
 * em 1000 linhas por padrão (configuração "Max Rows"), e uma única unidade
 * facilmente passa disso (280 contas × ~13 períodos por ano).
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
      const todas: DreLongoRow[] = []
      let from = 0
      while (true) {
        const { data, error: err } = await supabase
          .from('vw_dre_longo')
          .select('*')
          .eq('unidade', unidade)
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
  }, [unidade])

  return { rows, loading, error }
}
