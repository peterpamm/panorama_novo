import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Unidade } from '@/types'

export function useUnidades() {
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('unidades')
      .select('*')
      .order('nome')
      .then(({ data }) => {
        setUnidades(data ?? [])
        setLoading(false)
      })
  }, [])

  return { unidades, loading }
}
