import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LimpaPauta } from '@/types'

/** Lista de Limpa Pauta visível ao usuário logado (RLS já filtra: admin vê tudo, unidade só os próprios). */
export function useLimpaPauta() {
  const [registros, setRegistros] = useState<LimpaPauta[]>([])
  const [loading, setLoading] = useState(true)

  const recarregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('limpa_pauta').select('*').order('ano', { ascending: false }).order('mes', { ascending: false })
    setRegistros((data as LimpaPauta[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { recarregar() }, [recarregar])

  return { registros, loading, recarregar }
}
