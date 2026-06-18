import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Negocio } from '@/types'

export function useNegocios() {
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('negocios')
      .select('*')
      .order('nome')
      .then(({ data }) => {
        setNegocios(data ?? [])
        setLoading(false)
      })
  }, [])

  return { negocios, loading }
}
