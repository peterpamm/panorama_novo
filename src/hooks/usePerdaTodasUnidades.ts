import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DreLongoRow } from '@/types'

/**
 * Busca em mv_dre_longo só as contas de um indicador de perda (CONS + MENSAL + ano),
 * de todas as unidades visíveis pro usuário — consulta pequena (~centenas de linhas),
 * usada pelo ranking dos slides de Vales/Multas do SDG (que fica fora do DataContext).
 */
export function usePerdaTodasUnidades(contas: readonly string[], ano: number | null) {
  const [rows, setRows] = useState<DreLongoRow[]>([])
  const [loading, setLoading] = useState(true)
  const contasKey = contas.join(',')

  useEffect(() => {
    if (!ano) return
    let ativo = true
    setLoading(true)
    const orFiltro = contas.map(c => `conta_codigo.like.${c}%`).join(',')
    supabase
      .from('mv_dre_longo')
      .select('*')
      .eq('negocio', 'CONS')
      .eq('tipo_periodo', 'MENSAL')
      .eq('ano', ano)
      .or(orFiltro)
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) console.error('usePerdaTodasUnidades:', error.message)
        setRows((data as DreLongoRow[]) ?? [])
        setLoading(false)
      })
    return () => { ativo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contasKey, ano])

  return { rows, loading }
}
