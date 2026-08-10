import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PlanoAcao, PlanoAcaoHistorico, PlanoAcaoTag } from '@/types'

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

/** Último Follow (histórico de status) de cada plano de uma lista — usado no slide de apresentação, que mostra vários planos juntos e não pode abrir um de cada vez como o Detalhe. */
export function useUltimoFollowPorPlano(planoIds: string[]) {
  const [porPlano, setPorPlano] = useState<Record<string, PlanoAcaoHistorico>>({})
  const chave = planoIds.join(',')

  useEffect(() => {
    if (planoIds.length === 0) { setPorPlano({}); return }
    let ativo = true
    supabase
      .from('planos_acao_historico')
      .select('*')
      .in('plano_id', planoIds)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!ativo) return
        const mapa: Record<string, PlanoAcaoHistorico> = {}
        for (const h of (data as PlanoAcaoHistorico[]) ?? []) mapa[h.plano_id] = h
        setPorPlano(mapa)
      })
    return () => { ativo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  return { porPlano }
}

/** Catálogo de tags do Plano de Ação (Cadastro, admin-only pra escrever) — leitura liberada pra todo autenticado, é o Select de tag do formulário. */
export function usePlanoAcaoTags() {
  const [tags, setTags] = useState<PlanoAcaoTag[]>([])
  const [loading, setLoading] = useState(true)

  const recarregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('planos_acao_tags').select('*').order('ordem')
    setTags((data as PlanoAcaoTag[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { recarregar() }, [recarregar])

  return { tags, loading, recarregar }
}
