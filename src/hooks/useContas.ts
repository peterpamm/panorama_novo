import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Conta } from '@/types'

export function useContas() {
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('contas')
      .select('*')
      .order('ordem')
      .then(({ data }) => {
        setContas(data ?? [])
        setLoading(false)
      })
  }, [])

  return { contas, loading }
}
