import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { SdgIndicador, SdgJustificativa } from '@/types'

/**
 * Justificativas do SDG (Pontos Positivos/Negativos) de uma unidade × mês —
 * uma linha por indicador (no máximo 5). Usado tanto na tela de edição
 * (Área Financeira > SDG Financeiro) quanto no modo apresentação (só leitura).
 */
export function useSdgJustificativas(unidade: string, ano: number | null, mes: number | null) {
  const [porIndicador, setPorIndicador] = useState<Partial<Record<SdgIndicador, SdgJustificativa>>>({})
  const [loading, setLoading] = useState(true)

  const recarregar = useCallback(async () => {
    if (!unidade || ano === null || mes === null) { setPorIndicador({}); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('sdg_justificativas')
      .select('*')
      .eq('unidade', unidade)
      .eq('ano', ano)
      .eq('mes', mes)
    const mapa: Partial<Record<SdgIndicador, SdgJustificativa>> = {}
    for (const j of (data as SdgJustificativa[]) ?? []) mapa[j.indicador] = j
    setPorIndicador(mapa)
    setLoading(false)
  }, [unidade, ano, mes])

  useEffect(() => { recarregar() }, [recarregar])

  return { porIndicador, loading, recarregar }
}
