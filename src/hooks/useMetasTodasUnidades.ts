import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Meta } from '@/types'

const PAGE_SIZE = 1000

/** Busca todas as metas visíveis ao usuário atual, sem filtrar por unidade — mesma lógica de `useDreLongoTodasUnidades`, usada pela página Ranking. */
export function useMetasTodasUnidades() {
  const [metas, setMetas] = useState<Meta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)

    async function carregarTudo() {
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
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)

        if (err) throw err
        if (!data || data.length === 0) break
        todas.push(...(data as Meta[]))
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
      return todas
    }

    carregarTudo()
      .then(todas => {
        if (!ativo) return
        setMetas(todas)
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

  return { metas, loading, error }
}
