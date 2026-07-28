import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PlanoAcao, PlanoAcaoHistorico } from '@/types'

/**
 * Lista de Planos de Ação visível ao usuário logado (RLS já filtra: admin vê
 * tudo, unidade só as próprias). O histórico de cada plano é buscado à parte,
 * sob demanda, pelo painel de detalhe — ver `buscarHistorico`.
 */
export function usePlanosAcao() {
  const [planos, setPlanos] = useState<PlanoAcao[]>([])
  const [loading, setLoading] = useState(true)

  const recarregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('planos_acao').select('*').order('prazo')
    setPlanos((data as PlanoAcao[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { recarregar() }, [recarregar])

  return { planos, loading, recarregar }
}

export async function buscarHistoricoPlano(planoId: string): Promise<PlanoAcaoHistorico[]> {
  const { data } = await supabase
    .from('planos_acao_historico')
    .select('*')
    .eq('plano_id', planoId)
    .order('created_at', { ascending: false })
  return (data as PlanoAcaoHistorico[]) ?? []
}
