import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { SdgIndicador, SdgJustificativa } from '@/types'

/**
 * Justificativas do SDG (Pontos Positivos/Negativos) de uma unidade × mês —
 * uma linha por indicador (no máximo 5). Usado tanto na tela de edição
 * (Área Financeira > SDG Financeiro) quanto no modo apresentação (só leitura).
 *
 * `negocio` (default 'CONS') filtra por negócio — só importa pro Resumo
 * Executivo do SDG Gerentes em unidade com 2 gerentes reais (Camaçari/Ponta
 * Grossa, ver migration_132); todo o resto do app sempre grava/lê 'CONS'
 * (comportamento de sempre, sem precisar passar nada).
 */
export function useSdgJustificativas(unidade: string, ano: number | null, mes: number | null, negocio: string = 'CONS') {
  const [porIndicador, setPorIndicador] = useState<Partial<Record<SdgIndicador, SdgJustificativa>>>({})
  const [loading, setLoading] = useState(true)

  const recarregar = useCallback(async () => {
    if (!unidade || ano === null || mes === null) { setPorIndicador({}); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('sdg_justificativas')
      .select('*')
      .eq('unidade', unidade)
      .eq('negocio', negocio)
      .eq('ano', ano)
      .eq('mes', mes)
    const mapa: Partial<Record<SdgIndicador, SdgJustificativa>> = {}
    for (const j of (data as SdgJustificativa[]) ?? []) mapa[j.indicador] = j
    setPorIndicador(mapa)
    setLoading(false)
  }, [unidade, ano, mes, negocio])

  useEffect(() => { recarregar() }, [recarregar])

  return { porIndicador, loading, recarregar }
}
