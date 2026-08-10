import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DreLongoRow } from '@/types'

/**
 * Busca só as contas de um indicador de perda (CONS + MENSAL + ano), de
 * TODAS as unidades — usada pelo ranking dos slides de Vales/Multas do SDG
 * (que fica fora do DataContext). Chama a função `ranking_perda_indicador`
 * (ver migration_090) em vez de ler `mv_dre_longo` direto: essa view tem uma
 * trava que restringe um usuário "unidade" a só ver a própria unidade, mas
 * o ranking desses 4 indicadores é uma exceção proposital — todo mundo pode
 * comparar a própria posição com as demais unidades nesse recorte
 * específico (só soma dessas contas, nada mais do DRE).
 */
export function usePerdaTodasUnidades(contas: readonly string[], ano: number | null) {
  const [rows, setRows] = useState<DreLongoRow[]>([])
  const [loading, setLoading] = useState(true)
  const contasKey = contas.join(',')

  useEffect(() => {
    if (!ano) return
    let ativo = true
    setLoading(true)
    supabase
      .rpc('ranking_perda_indicador', { p_ano: ano, p_contas: [...contas] })
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) console.error('usePerdaTodasUnidades:', error.message)
        setRows((data as DreLongoRow[]) ?? [])
        setLoading(false)
      })
    return () => { ativo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contasKey, ano])

  return { rows, loading }
}
