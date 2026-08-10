import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'
import { POSICOES_AMBEV_VAZIAS, type PosicoesAmbev } from '@/lib/resumo-geral-calculations'
import type { ResumoGeralAmbevSetor, ResumoGeralHistorico, ResumoGeralRankingAmbev } from '@/types'

/**
 * Dados exclusivos do Resumo Geral que `useReuniaoDados` não tem: posição
 * manual da unidade em cada um dos 3 Rankings Ambev (Gente/Frota/Segurança
 * — independentes entre si, bônus calculado em
 * `resumo-geral-calculations.ts`) e a pontuação final já fechada de meses
 * anteriores ao início oficial do sistema (Importação de Histórico) — ambos
 * por ano, igual `metas_perdas_indicadores` (sem filtro de unidade).
 */
export function useResumoGeralRanking(ano: string) {
  const { toast } = useToast()
  const [rankingAmbev, setRankingAmbev] = useState<ResumoGeralRankingAmbev[]>([])
  const [historico, setHistorico] = useState<ResumoGeralHistorico[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    const [ra, hi] = await Promise.all([
      supabase.from('resumo_geral_ranking_ambev').select('*').eq('ano', Number(ano)),
      supabase.from('resumo_geral_historico').select('*').eq('ano', Number(ano)),
    ])
    if (ra.error) toast({ title: 'Erro ao carregar Ranking Ambev', description: ra.error.message, variant: 'destructive' })
    if (hi.error) toast({ title: 'Erro ao carregar histórico', description: hi.error.message, variant: 'destructive' })
    setRankingAmbev((ra.data as ResumoGeralRankingAmbev[]) ?? [])
    setHistorico((hi.data as ResumoGeralHistorico[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [ano]) // eslint-disable-line react-hooks/exhaustive-deps

  /** As 3 posições da unidade+negócio no mês (Gente/Frota/Segurança) — null pra quem não foi lançado. Camaçari tem negócio 'ROTA'/'ARM' com colocações diferentes entre si; as demais unidades usam sempre 'CONS'. */
  function posicoesAmbev(unidade: string, negocio: string, mes: number): PosicoesAmbev {
    const doMes = rankingAmbev.filter(r => r.unidade === unidade && r.negocio === negocio && r.mes === mes)
    if (doMes.length === 0) return POSICOES_AMBEV_VAZIAS
    return {
      gente: doMes.find(r => r.setor === 'gente')?.posicao ?? null,
      frota: doMes.find(r => r.setor === 'frota')?.posicao ?? null,
      seguranca: doMes.find(r => r.setor === 'seguranca')?.posicao ?? null,
    }
  }

  /** Acumulado até o mês de corte da unidade no ano deste hook (já filtrado em `carregar`), se existir — base do Ranking Anual (soma os meses ao vivo só depois do corte, ver `somarAcumuladoAnual`). Camaçari usa o mesmo valor pras duas linhas (Rota/Armazém), igual EBITDA/Financeiro. */
  function historicoDoAno(unidade: string): ResumoGeralHistorico | null {
    return historico.find(h => h.unidade === unidade) ?? null
  }

  /** Salva (ou remove, se `posicao` for null) a posição da unidade+negócio num dos 3 Rankings Ambev daquele mês. */
  async function salvarPosicaoAmbev(unidade: string, negocio: string, mes: number, setor: ResumoGeralAmbevSetor, posicao: number | null) {
    if (posicao === null) {
      const { error } = await supabase.from('resumo_geral_ranking_ambev')
        .delete().eq('unidade', unidade).eq('negocio', negocio).eq('ano', Number(ano)).eq('mes', mes).eq('setor', setor)
      if (error) { toast({ title: 'Erro ao salvar posição', description: error.message, variant: 'destructive' }); return }
      setRankingAmbev(prev => prev.filter(r => !(r.unidade === unidade && r.negocio === negocio && r.mes === mes && r.setor === setor)))
      return
    }
    const { error } = await supabase.from('resumo_geral_ranking_ambev')
      .upsert({ unidade, negocio, ano: Number(ano), mes, setor, posicao }, { onConflict: 'unidade,negocio,ano,mes,setor' })
    if (error) { toast({ title: 'Erro ao salvar posição', description: error.message, variant: 'destructive' }); return }
    setRankingAmbev(prev => [...prev.filter(r => !(r.unidade === unidade && r.negocio === negocio && r.mes === mes && r.setor === setor)), { unidade, negocio, ano: Number(ano), mes, setor, posicao }])
  }

  return { rankingAmbev, historico, carregando, posicoesAmbev, historicoDoAno, salvarPosicaoAmbev, recarregar: carregar }
}
