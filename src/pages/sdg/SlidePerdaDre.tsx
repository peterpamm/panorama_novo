import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BlocoIndicadorPerda } from '@/pages/sdg/BlocoIndicadorPerda'
import { JustificativaEAcoesCard } from '@/pages/sdg/JustificativaEAcoesCard'
import type { DreLongoRow, MetaPerdaIndicador, PlanoAcao, SdgJustificativa, Unidade } from '@/types'

interface SlidePerdaDreProps {
  titulo: string
  /** Prefixos de conta do indicador de perda (ex: Vales combinado = ['052','053'], Vales Financeiros = ['052'], Multas = ['138','223']). */
  contas: readonly string[]
  /** Linhas da unidade em todos os anos (negócio CONS, sem filtro de ano). */
  rowsTodosAnos: DreLongoRow[]
  unidadeSel: string
  unidades: Unidade[]
  ano: number
  mes: number
  /** Indicador de `metas_perdas_indicadores` (ex: 'vales') pra comparar com o orçado — omitir quando esse recorte não tem Meta de Perdas própria (ex: Multas, ou uma conta filha isolada de Vales). */
  metaIndicador?: string
  /** false só no pacote geral de Vales — ele abre em Vales Financeiros/Vales Físicos/Refugo/Quebras, cada um com sua própria Justificativa e ações. Default true. */
  mostrarJustificativa?: boolean
  justificativa?: SdgJustificativa
  acoesRelacionadas?: PlanoAcao[]
}

/** Slide de indicador de perda em R$ (Painel de Perdas): cards mensal/YTD, evolução vs ano anterior, ranking entre unidades e detalhe mensal — com comparação opcional com o orçado (Metas de Perdas). */
export function SlidePerdaDre({
  titulo, contas, rowsTodosAnos, unidadeSel, unidades, ano, mes,
  metaIndicador, mostrarJustificativa = true, justificativa, acoesRelacionadas,
}: SlidePerdaDreProps) {
  const [metaAnualIndicador, setMetaAnualIndicador] = useState<number | null>(null)
  useEffect(() => {
    if (!metaIndicador) { setMetaAnualIndicador(null); return }
    let ativo = true
    supabase
      .from('metas_perdas_indicadores')
      .select('*')
      .eq('unidade', unidadeSel)
      .eq('ano', ano)
      .eq('indicador', metaIndicador)
      .maybeSingle()
      .then(({ data }) => { if (ativo) setMetaAnualIndicador(data ? (data as MetaPerdaIndicador).meta_anual : null) })
    return () => { ativo = false }
  }, [metaIndicador, unidadeSel, ano])

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        <BlocoIndicadorPerda
          titulo={titulo}
          contas={contas}
          rowsTodosAnos={rowsTodosAnos}
          unidadeSel={unidadeSel}
          unidades={unidades}
          ano={ano}
          mes={mes}
          metaAnualIndicador={metaIndicador ? metaAnualIndicador : undefined}
        />

        {mostrarJustificativa && (
          <JustificativaEAcoesCard justificativa={justificativa} acoes={acoesRelacionadas ?? []} />
        )}
      </div>
    </div>
  )
}
