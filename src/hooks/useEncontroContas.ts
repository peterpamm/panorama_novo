import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { EncontroContas, EncontroContasHistorico, EncontroContasMotivo } from '@/types'

/**
 * Lista de ECs (Encontro de Contas) visível ao usuário logado (RLS já
 * filtra: admin vê tudo, unidade só os próprios). Histórico e Motivos são
 * buscados à parte — ver `buscarHistoricoEc`/`useEncontroContasMotivos`.
 */
export function useEncontroContas() {
  const [ecs, setEcs] = useState<EncontroContas[]>([])
  const [loading, setLoading] = useState(true)

  const recarregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('encontro_contas').select('*').order('data', { ascending: false })
    setEcs((data as EncontroContas[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { recarregar() }, [recarregar])

  return { ecs, loading, recarregar }
}

export async function buscarHistoricoEc(ecId: string): Promise<EncontroContasHistorico[]> {
  const { data } = await supabase
    .from('encontro_contas_historico')
    .select('*')
    .eq('ec_id', ecId)
    .order('created_at', { ascending: false })
  return (data as EncontroContasHistorico[]) ?? []
}

/** Último Follow (histórico de status) de cada EC de uma lista — usado no slide de apresentação, que mostra vários ECs juntos e não pode abrir um de cada vez como o Detalhe. */
export function useUltimoFollowPorEc(ecIds: string[]) {
  const [porEc, setPorEc] = useState<Record<string, EncontroContasHistorico>>({})
  const [loading, setLoading] = useState(false)
  const chave = ecIds.join(',')

  useEffect(() => {
    if (ecIds.length === 0) { setPorEc({}); return }
    let ativo = true
    setLoading(true)
    supabase
      .from('encontro_contas_historico')
      .select('*')
      .in('ec_id', ecIds)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!ativo) return
        const mapa: Record<string, EncontroContasHistorico> = {}
        for (const h of (data as EncontroContasHistorico[]) ?? []) mapa[h.ec_id] = h
        setPorEc(mapa)
        setLoading(false)
      })
    return () => { ativo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  return { porEc, loading }
}

/** Lista de Motivos cadastrados (Select de Motivo + CRUD embutido) — leitura liberada pra todo autenticado, escrita admin-only (ver migration_080). */
export function useEncontroContasMotivos() {
  const [motivos, setMotivos] = useState<EncontroContasMotivo[]>([])
  const [loading, setLoading] = useState(true)

  const recarregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('encontro_contas_motivos').select('*').order('ordem')
    setMotivos((data as EncontroContasMotivo[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { recarregar() }, [recarregar])

  return { motivos, loading, recarregar }
}
