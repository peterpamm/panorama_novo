import { useMemo } from 'react'
import { useUltimoFollowPorPlano } from '@/hooks/usePlanosAcao'
import { STATUS_LABEL, estaAtrasado, formatDataBr } from '@/lib/plano-acao'
import { SDG_INDICADORES_GERENTES } from '@/lib/sdg-indicadores'
import { cn } from '@/lib/utils'
import type { PlanoAcao, PlanoAcaoStatus, PlanoAcaoTag, SdgIndicador } from '@/types'

interface Props {
  /** Planos já escopados pela RLS (admin vê tudo, unidade só os próprios) — filtragem por unidade é feita aqui. */
  planos: PlanoAcao[]
  tags: PlanoAcaoTag[]
  unidadeSel: string
}

/** Pílula de status desse slide — cores PRÓPRIAS (mais fortes que o padrão cinza/azul/âmbar do resto do Plano de Ação), pedido do usuário depois de ver a apresentação real: Pendente em vermelho, Em Andamento em amarelo (mesmo atrasado — o usuário não quer que atraso sobreponha essa cor), Concluído em verde. */
function corStatusGerentes(status: PlanoAcaoStatus): string {
  if (status === 'em_andamento') return 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
  if (status === 'concluido' || status === 'validado') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
  return 'bg-red-500/15 text-red-700 dark:text-red-400' // pendente (atrasado ou não)
}

/** Mapa indicador → label curto (sem o prefixo "SDG Gerentes · ", redundante numa coluna que já é só desse deck). */
const LABEL_POR_INDICADOR = new Map(SDG_INDICADORES_GERENTES.map(i => [i.id, i.label.replace('SDG Gerentes · ', '')]))

/**
 * Slide final "Plano de Ação" do SDG Gerentes — lista única (não mais
 * blocos por indicador, pedido do usuário depois de testar) de todas as
 * ações ativas da unidade vinculadas a algum indicador do SDG Gerentes
 * (`SDG_INDICADORES_GERENTES`), com coluna "Indicador" dizendo o assunto de
 * cada uma e coluna "Follow" com a última observação registrada (mesmo
 * conceito de `SlidePlanoAcao.tsx`, `useUltimoFollowPorPlano`). Ordenada
 * como `SlidePlanoAcao.tsx`: atrasadas primeiro, depois por prazo.
 */
export function SlidePlanoAcaoGerentes({ planos, tags, unidadeSel }: Props) {
  const indicadorPorTagNome = useMemo(() => {
    const mapa = new Map<string, SdgIndicador>()
    for (const t of tags) {
      if (t.sdg_indicador?.startsWith('gerentes-')) mapa.set(t.nome, t.sdg_indicador)
    }
    return mapa
  }, [tags])

  const linhas = useMemo(() => {
    return planos
      .filter(p => p.unidade === unidadeSel && p.status !== 'validado')
      .map(p => ({ plano: p, indicador: indicadorPorTagNome.get(p.tag) }))
      .filter((l): l is { plano: PlanoAcao; indicador: SdgIndicador } => l.indicador !== undefined)
      .sort((a, b) => {
        const aAtrasado = estaAtrasado(a.plano.prazo, a.plano.status)
        const bAtrasado = estaAtrasado(b.plano.prazo, b.plano.status)
        if (aAtrasado !== bAtrasado) return aAtrasado ? -1 : 1
        return a.plano.prazo.localeCompare(b.plano.prazo)
      })
  }, [planos, unidadeSel, indicadorPorTagNome])

  const { porPlano: followPorPlano } = useUltimoFollowPorPlano(useMemo(() => linhas.map(l => l.plano.id), [linhas]))

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          {linhas.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-400 dark:text-slate-500">
              Nenhuma ação ativa vinculada ao SDG Gerentes pra essa unidade.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[13%]" />
                  <col className="w-[8%]" />
                  <col className="w-[9%]" />
                  <col className="w-[40%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase text-gray-400 dark:border-slate-700 dark:text-slate-500">
                    <th className="py-2 pr-3 text-left font-medium">Ação</th>
                    <th className="py-2 pr-3 text-left font-medium">Indicador</th>
                    <th className="py-2 pr-3 text-left font-medium">Prazo</th>
                    <th className="py-2 pr-3 text-center font-medium">Status</th>
                    <th className="py-2 pl-3 text-left font-medium">Follow</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({ plano, indicador }) => {
                    const atrasado = estaAtrasado(plano.prazo, plano.status)
                    const follow = followPorPlano[plano.id]
                    return (
                      <tr key={plano.id} className="border-b border-gray-100 align-top last:border-0 dark:border-slate-700/50">
                        <td className="break-words py-2 pr-3 font-medium text-gray-800 dark:text-slate-200">{plano.titulo}</td>
                        <td className="py-2 pr-3 text-gray-500 dark:text-slate-400">{LABEL_POR_INDICADOR.get(indicador) ?? indicador}</td>
                        <td className={cn(
                          'py-2 pr-3 whitespace-nowrap',
                          atrasado ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400',
                        )}>
                          {formatDataBr(plano.prazo)}
                        </td>
                        <td className="py-2 pr-3 text-center">
                          <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', corStatusGerentes(plano.status))}>
                            {STATUS_LABEL[plano.status]}
                          </span>
                        </td>
                        <td className="break-words py-2 pl-3 text-gray-600 dark:text-slate-300">
                          {follow ? follow.observacao || <span className="italic text-gray-400 dark:text-slate-500">Sem observação registrada</span>
                            : <span className="italic text-gray-400 dark:text-slate-500">Sem follow registrado</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
