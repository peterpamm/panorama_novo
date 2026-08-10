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

      // Busca páginas sequenciais até uma voltar com menos linhas que PAGE
      // (fim dos dados) — evita o COUNT(*) exato, que na pior das hipóteses
      // pode estourar o statement_timeout do Supabase.
      const todas: DreLongoRow[] = []
      let pagina = 0
      let acabou = false
      while (!acabou) {
        // .order() é obrigatório com .range(): sem ordem explícita o Postgres
        // não garante a mesma ordem entre duas chamadas separadas, então a
        // página 1 pode pular/repetir linhas que a página 0 já devolveu —
        // bug real já visto (resultado de um pacote zerado só numa unidade,
        // sumindo/reaparecendo a cada F5, ver DataContext.tsx).
        const { data, error } = await supabase
          .from(TABELA)
          .select('*')
          .eq('unidade', unidade)
          .order('negocio', { ascending: true })
          .order('ano', { ascending: true })
          .order('mes', { ascending: true })
          .order('tipo_periodo', { ascending: true })
          .order('conta_codigo', { ascending: true })
          .range(pagina * PAGE, (pagina + 1) * PAGE - 1)

        if (error) throw error
        const dados = (data as DreLongoRow[]) ?? []
        todas.push(...dados)
        if (dados.length < PAGE) acabou = true
        pagina += 1
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
