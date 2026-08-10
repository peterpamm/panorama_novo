import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Clock, PlayCircle } from 'lucide-react'
import { useUltimoFollowPorPlano } from '@/hooks/usePlanosAcao'
import { STATUS_LABEL, STATUS_PILL, STATUS_ORDEM, estaAtrasado, formatDataBr } from '@/lib/plano-acao'
import { cn } from '@/lib/utils'
import type { PlanoAcao } from '@/types'

interface Props {
  /** Planos já escopados pela RLS (admin vê tudo, unidade só os próprios) — filtragem por unidade é feita aqui. */
  planos: PlanoAcao[]
  unidadeSel: string
}

/**
 * Slide "Plano de Ação" (apresentação SDG) — acompanhamento das ações ativas
 * (ainda não validadas) da unidade: contagens por status + atrasadas, e a
 * lista com prazo e o último Follow ao lado, pra cobrar justificativa ao
 * vivo na reunião de quem ainda não avançou.
 */
export function SlidePlanoAcao({ planos, unidadeSel }: Props) {
  const planosUnidade = useMemo(() => planos.filter(p => p.unidade === unidadeSel), [planos, unidadeSel])

  const ativos = useMemo(
    () => planosUnidade
      .filter(p => p.status !== 'validado')
      .sort((a, b) => {
        const aAtrasado = estaAtrasado(a.prazo, a.status)
        const bAtrasado = estaAtrasado(b.prazo, b.status)
        if (aAtrasado !== bAtrasado) return aAtrasado ? -1 : 1
        return a.prazo.localeCompare(b.prazo)
      }),
    [planosUnidade],
  )

  const { porPlano: followPorPlano } = useUltimoFollowPorPlano(useMemo(() => ativos.map(p => p.id), [ativos]))

  const contagens = useMemo(() => ({
    pendente: ativos.filter(p => p.status === 'pendente').length,
    em_andamento: ativos.filter(p => p.status === 'em_andamento').length,
    concluido: ativos.filter(p => p.status === 'concluido').length,
    atrasadas: ativos.filter(p => estaAtrasado(p.prazo, p.status)).length,
  }), [ativos])

  const CARDS = [
    { label: 'Pendentes', valor: contagens.pendente, icone: Clock, cor: 'text-gray-500 dark:text-slate-400' },
    { label: 'Em Andamento', valor: contagens.em_andamento, icone: PlayCircle, cor: 'text-blue-600 dark:text-blue-400' },
    { label: 'Aguardando Validação', valor: contagens.concluido, icone: CheckCircle2, cor: 'text-amber-600 dark:text-amber-400' },
    { label: 'Atrasadas', valor: contagens.atrasadas, icone: AlertTriangle, cor: 'text-red-600 dark:text-red-400' },
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {CARDS.map(c => {
            const Icone = c.icone
            return (
              <div key={c.label} className="flex items-center gap-3 rounded-2xl bg-white shadow dark:bg-slate-800/60 p-4">
                <Icone className={cn('h-8 w-8 shrink-0', c.cor)} />
                <div>
                  <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{c.valor}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-400">{c.label}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Lista de ações ativas, com follow — pra cobrar justificativa ao vivo */}
        <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Ações Ativas — {STATUS_ORDEM.filter(s => s !== 'validado').map(s => STATUS_LABEL[s]).join(' / ')}
          </p>
          {ativos.length === 0 ? (
            <div className="flex h-[180px] items-center justify-center text-sm text-gray-400 dark:text-slate-500">
              Nenhuma ação ativa pra essa unidade.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase text-gray-400 dark:border-slate-700 dark:text-slate-500">
                    <th className="py-2 pr-3 text-left font-medium">Título</th>
                    <th className="py-2 pr-3 text-left font-medium">Responsável</th>
                    <th className="py-2 pr-3 text-left font-medium">Tag</th>
                    <th className="py-2 pr-3 text-left font-medium">Prazo</th>
                    <th className="py-2 pr-3 text-center font-medium">Status</th>
                    <th className="py-2 pl-3 text-left font-medium">Follow</th>
                  </tr>
                </thead>
                <tbody>
                  {ativos.map(p => {
                    const atrasado = estaAtrasado(p.prazo, p.status)
                    const follow = followPorPlano[p.id]
                    return (
                      <tr key={p.id} className="border-b border-gray-100 align-top last:border-0 dark:border-slate-700/50">
                        <td className="max-w-[220px] py-2 pr-3 font-medium text-gray-800 dark:text-slate-200">{p.titulo}</td>
                        <td className="py-2 pr-3 text-gray-500 dark:text-slate-400">{p.responsavel || '—'}</td>
                        <td className="py-2 pr-3">
                          {p.tag && (
                            <span className="rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-slate-300">
                              {p.tag}
                            </span>
                          )}
                        </td>
                        <td className={cn(
                          'py-2 pr-3 whitespace-nowrap',
                          atrasado ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400',
                        )}>
                          {formatDataBr(p.prazo)}
                        </td>
                        <td className="py-2 pr-3 text-center">
                          <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_PILL[p.status])}>
                            {STATUS_LABEL[p.status]}
                          </span>
                        </td>
                        <td className="py-2 pl-3 text-gray-600 dark:text-slate-300">
                          {follow ? follow.observacao || <span className="italic text-gray-400 dark:text-slate-500">Sem observação registrada</span>
                            : <span className="italic text-red-500 dark:text-red-400">Sem follow registrado</span>}
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
