import { useEffect, useState } from 'react'
import { CONTAS_ORCAMENTO_USADAS } from '@/lib/constants'
import { fetchRpcPorUnidade } from '@/lib/fetch-rpc-todas-unidades'
import type { DreLongoRow, OrcamentoLinha, PainelPerdasAux, Unidade } from '@/types'

/**
 * Dataset SEM restrição de unidade — só pra página Ranking, cujo objetivo é
 * justamente incentivar a competição mostrando o resultado de todo mundo,
 * ao contrário do resto do app (Farol, Análise por Conta, SDG Financeiro
 * etc.), que continua restrito à própria unidade + AMBEV. Busca das RPCs
 * `ranking_*` (ver migration_093), não das tabelas com RLS normal — por
 * isso é um hook separado do `DataContext` global. DRE/Orçamento daqui
 * também são reaproveitados pelo Farol Gerentes (`useFarolGerentesDados`),
 * que precisa do mesmo "todas as unidades" — só o TRI dele vem de uma RPC
 * própria (migration_094), que o Ranking não usa.
 */
export function useRankingDados(unidades: Unidade[]) {
  const [rows, setRows] = useState<DreLongoRow[]>([])
  const [rowsAux, setRowsAux] = useState<PainelPerdasAux[]>([])
  const [orcamentos, setOrcamentos] = useState<OrcamentoLinha[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const codigosKey = unidades.map(u => u.codigo).join(',')

  useEffect(() => {
    if (unidades.length === 0) return
    let ativo = true
    async function carregar() {
      setLoading(true)
      setError(null)
      const codigos = unidades.map(u => u.codigo)
      // Promise.allSettled, não Promise.all: uma RPC falhar não pode
      // derrubar as outras junto — mesmo motivo de DataContext.tsx.
      const [dreR, auxR, orcR] = await Promise.allSettled([
        fetchRpcPorUnidade<DreLongoRow>('ranking_dre_longo', undefined, codigos, ['negocio', 'ano', 'mes', 'tipo_periodo', 'conta_codigo']),
        fetchRpcPorUnidade<PainelPerdasAux>('ranking_painel_perdas_aux', undefined, codigos, ['id']),
        fetchRpcPorUnidade<OrcamentoLinha>('ranking_orcamentos', { p_contas: CONTAS_ORCAMENTO_USADAS }, codigos, ['id']),
      ])
      if (!ativo) return

      const erros: string[] = []
      if (dreR.status === 'fulfilled') setRows(dreR.value)
      else erros.push(`DRE: ${(dreR.reason as Error)?.message ?? dreR.reason}`)
      if (auxR.status === 'fulfilled') setRowsAux(auxR.value)
      else erros.push(`Painel de Perdas: ${(auxR.reason as Error)?.message ?? auxR.reason}`)
      if (orcR.status === 'fulfilled') setOrcamentos(orcR.value)
      else erros.push(`Orçamento: ${(orcR.reason as Error)?.message ?? orcR.reason}`)

      setError(erros.length > 0 ? erros.join(' · ') : null)
      setLoading(false)
    }
    carregar()
    return () => { ativo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigosKey])

  return { rows, rowsAux, orcamentos, loading, error }
}
