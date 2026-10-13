import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CONTAS_ORCAMENTO_USADAS } from '@/lib/constants'
import { fetchRpcPorUnidade } from '@/lib/fetch-rpc-todas-unidades'
import type {
  DisponibilidadeArmazemAcumulada, DisponibilidadeEmpurradaAcumulada, DisponibilidadeRotaAcumulada, DreLongoRow,
  Log20PosicaoAmbev, MetaPerdaIndicador, OrcamentoLinha, PainelPerdasAux, ResultadoTri, Unidade,
} from '@/types'

/**
 * Dataset SEM restrição de unidade pro Farol Gerentes — mesma ideia do
 * `useRankingDados` (ver lá o motivo): a página mostra todas as unidades
 * pra qualquer usuário logado, então busca das RPCs `ranking_dre_longo`/
 * `ranking_orcamentos`/`ranking_painel_perdas_aux` (reaproveitadas do
 * Ranking, migration_093), `farol_gerentes_resultados_tri` (migration_094),
 * `farol_gerentes_metas_perdas_indicadores` (migration_095),
 * `farol_gerentes_disponibilidade_rota` (migration_096),
 * `farol_gerentes_disponibilidade_armazem` (migration_097) e
 * `farol_gerentes_disponibilidade_empurrada` (migration_119) — não das
 * tabelas com RLS normal. `log20_posicao_ambev` (migration_127) é exceção:
 * não é por unidade (é a empresa toda), então lê direto com RLS normal
 * (leitura liberada pra todo autenticado), sem RPC nem filtro de unidade.
 */
export function useFarolGerentesDados(unidades: Unidade[]) {
  const [rows, setRows] = useState<DreLongoRow[]>([])
  const [orcamentos, setOrcamentos] = useState<OrcamentoLinha[]>([])
  const [resultadosTri, setResultadosTri] = useState<ResultadoTri[]>([])
  const [rowsAux, setRowsAux] = useState<PainelPerdasAux[]>([])
  const [metasPerdasIndicadores, setMetasPerdasIndicadores] = useState<MetaPerdaIndicador[]>([])
  const [disponibilidadeRota, setDisponibilidadeRota] = useState<DisponibilidadeRotaAcumulada[]>([])
  const [disponibilidadeArmazem, setDisponibilidadeArmazem] = useState<DisponibilidadeArmazemAcumulada[]>([])
  const [disponibilidadeEmpurrada, setDisponibilidadeEmpurrada] = useState<DisponibilidadeEmpurradaAcumulada[]>([])
  const [posicoesLog20, setPosicoesLog20] = useState<Log20PosicaoAmbev[]>([])
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
      // Promise.allSettled, não Promise.all: uma RPC falhar (ex: migration
      // ainda não rodada) não pode derrubar as outras junto — mesmo motivo
      // de DataContext.tsx.
      const [dreR, orcR, triR, auxR, metasPerdasR, dispRotaR, dispArmazemR, dispEmpurradaR, posicaoLog20R] = await Promise.allSettled([
        fetchRpcPorUnidade<DreLongoRow>('ranking_dre_longo', undefined, codigos, ['negocio', 'ano', 'mes', 'tipo_periodo', 'conta_codigo']),
        fetchRpcPorUnidade<OrcamentoLinha>('ranking_orcamentos', { p_contas: CONTAS_ORCAMENTO_USADAS }, codigos, ['id']),
        fetchRpcPorUnidade<ResultadoTri>('farol_gerentes_resultados_tri', undefined, codigos, ['id']),
        fetchRpcPorUnidade<PainelPerdasAux>('ranking_painel_perdas_aux', undefined, codigos, ['id']),
        fetchRpcPorUnidade<MetaPerdaIndicador>('farol_gerentes_metas_perdas_indicadores', undefined, codigos, ['id']),
        fetchRpcPorUnidade<DisponibilidadeRotaAcumulada>('farol_gerentes_disponibilidade_rota', undefined, codigos, ['id']),
        fetchRpcPorUnidade<DisponibilidadeArmazemAcumulada>('farol_gerentes_disponibilidade_armazem', undefined, codigos, ['id']),
        fetchRpcPorUnidade<DisponibilidadeEmpurradaAcumulada>('farol_gerentes_disponibilidade_empurrada', undefined, codigos, ['id']),
        supabase.from('log20_posicao_ambev').select('*').then(({ data, error }) => {
          if (error) throw new Error(error.message)
          return (data ?? []) as Log20PosicaoAmbev[]
        }),
      ])
      if (!ativo) return

      const erros: string[] = []
      if (dreR.status === 'fulfilled') setRows(dreR.value)
      else erros.push(`DRE: ${(dreR.reason as Error)?.message ?? dreR.reason}`)
      if (orcR.status === 'fulfilled') setOrcamentos(orcR.value)
      else erros.push(`Orçamento: ${(orcR.reason as Error)?.message ?? orcR.reason}`)
      if (triR.status === 'fulfilled') setResultadosTri(triR.value)
      else erros.push(`TRI: ${(triR.reason as Error)?.message ?? triR.reason}`)
      if (auxR.status === 'fulfilled') setRowsAux(auxR.value)
      else erros.push(`Painel de Perdas: ${(auxR.reason as Error)?.message ?? auxR.reason}`)
      if (metasPerdasR.status === 'fulfilled') setMetasPerdasIndicadores(metasPerdasR.value)
      else erros.push(`Metas de Perdas: ${(metasPerdasR.reason as Error)?.message ?? metasPerdasR.reason}`)
      if (dispRotaR.status === 'fulfilled') setDisponibilidadeRota(dispRotaR.value)
      else erros.push(`Disponibilidade Rota: ${(dispRotaR.reason as Error)?.message ?? dispRotaR.reason}`)
      if (dispArmazemR.status === 'fulfilled') setDisponibilidadeArmazem(dispArmazemR.value)
      else erros.push(`Disponibilidade Armazém: ${(dispArmazemR.reason as Error)?.message ?? dispArmazemR.reason}`)
      if (dispEmpurradaR.status === 'fulfilled') setDisponibilidadeEmpurrada(dispEmpurradaR.value)
      else erros.push(`Disponibilidade Empurrada: ${(dispEmpurradaR.reason as Error)?.message ?? dispEmpurradaR.reason}`)
      if (posicaoLog20R.status === 'fulfilled') setPosicoesLog20(posicaoLog20R.value)
      else erros.push(`Posição LOG20: ${(posicaoLog20R.reason as Error)?.message ?? posicaoLog20R.reason}`)

      setError(erros.length > 0 ? erros.join(' · ') : null)
      setLoading(false)
    }
    carregar()
    return () => { ativo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigosKey])

  return {
    rows, orcamentos, resultadosTri, rowsAux, metasPerdasIndicadores, disponibilidadeRota, disponibilidadeArmazem,
    disponibilidadeEmpurrada, posicoesLog20, loading, error,
  }
}
