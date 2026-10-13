import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RelatoSeguranca } from '@/types'

/**
 * Relatos de segurança de uma unidade no ANO inteiro (Pirâmide de Segurança,
 * SDG Gerentes) — ver `relatos_seguranca`, migration 115. Busca o ano
 * inteiro (não só o mês selecionado) porque a grade de meses do slide mostra
 * Jan até o mês selecionado lado a lado; filtrar por mês fica por conta de
 * quem consome (`agruparPorMes`, `piramide-seguranca.ts`).
 */
export function useRelatosSeguranca(unidade: string, ano: number | null) {
  const [relatos, setRelatos] = useState<RelatoSeguranca[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!unidade || ano === null) { setRelatos([]); setLoading(false); return }
    let ativo = true
    setLoading(true)
    supabase
      .from('relatos_seguranca')
      .select('*')
      .eq('unidade', unidade)
      .eq('ano', ano)
      .then(({ data }) => {
        if (!ativo) return
        setRelatos((data as RelatoSeguranca[]) ?? [])
        setLoading(false)
      })
    return () => { ativo = false }
  }, [unidade, ano])

  return { relatos, loading }
}
