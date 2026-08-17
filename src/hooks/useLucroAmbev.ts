import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LucroAmbevRow } from '@/types'

/** Lucro Ambev (SDG Corp Fin > Lucro) — RLS já restringe a leitura ao dono. */
export function useLucroAmbev() {
  const [linhas, setLinhas] = useState<LucroAmbevRow[]>([])
  const [loading, setLoading] = useState(true)

  const recarregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('lucro_ambev').select('*')
    setLinhas((data as LucroAmbevRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { recarregar() }, [recarregar])

  return { linhas, loading, recarregar }
}
