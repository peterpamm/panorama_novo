import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Unidade } from '@/types'

export function useUnidades() {
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [loading, setLoading] = useState(true)

  async function recarregar() {
    setLoading(true)
    const { data } = await supabase.from('unidades').select('*').order('nome')
    setUnidades(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    recarregar()
  }, [])

  return { unidades, loading, recarregar }
}
