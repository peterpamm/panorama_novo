import { useMemo } from 'react'
import { FileStack, Wallet, Clock, CheckCircle2 } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { COR_AVR, MES_ABREV, getChartColors } from '@/components/farol/chart-shared'
import { useUltimoFollowPorEc } from '@/hooks/useEncontroContas'
import { STATUS_LABEL, STATUS_PILL, STATUS_ORDEM, ND_LABEL, ND_PILL, formatDataBr } from '@/lib/encontro-contas'
import { JustificativaEAcoesCard } from '@/pages/sdg/JustificativaEAcoesCard'
import { cn, formatCurrencyCompact, formatCurrencyInteiro } from '@/lib/utils'
import type { EncontroContas, PlanoAcao, SdgJustificativa } from '@/types'

interface Props {
  /** ECs já escopados pela RLS (admin vê tudo, unidade só a própria) — filtragem por unidade/mês é feita aqui. */
  ecs: EncontroContas[]
  unidadeSel: string
  ano: number
  mes: number
  justificativa: SdgJustificativa | undefined
  acoesRelacionadas: PlanoAcao[]
}

function TooltipEvolucao({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
      <p className="mb-1 font-semibold">{label}</p>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: COR_AVR }} />
        Descontado: <span className="font-medium text-popover-foreground">{formatCurrencyCompact(payload[0].value)}</span>
      </p>
    </div>
  )
}

/**
 * Slide de Encontro de Contas (apresentação SDG): evolução mensal dos
 * descontos da unidade e a lista de todos os ECs abertos no mês da
 * apresentação, com o status e o último Follow ao lado — pra cobrar
 * justificativa ao vivo na reunião de quem ainda não tratou. Justificativa +
 * ações do Plano de Ação no final — útil quando a Ambev descontou errado e a
 * unidade abriu uma ação pra pedir ressarcimento.
 */
export function SlideEncontroContas({ ecs, unidadeSel, ano, mes, justificativa, acoesRelacionadas }: Props) {
  const { axis, cursor } = getChartColors()

  const ecsUnidade = useMemo(() => ecs.filter(e => e.unidade === unidadeSel), [ecs, unidadeSel])

  const evolucaoMensal = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const e of ecsUnidade) {
      const chave = e.data.slice(0, 7) // 'YYYY-MM'
      mapa.set(chave, (mapa.get(chave) ?? 0) + e.valor)
    }
    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([chave, valor]) => ({ mesLabel: `${MES_ABREV[Number(chave.slice(5, 7))]}/${chave.slice(2, 4)}`, valor }))
  }, [ecsUnidade])

  const mesRef = `${ano}-${String(mes).padStart(2, '0')}`
  const ecsDoMes = useMemo(
    () => ecsUnidade
      .filter(e => e.data.slice(0, 7) === mesRef)
      .sort((a, b) => STATUS_ORDEM.indexOf(a.status) - STATUS_ORDEM.indexOf(b.status) || a.data.localeCompare(b.data)),
    [ecsUnidade, mesRef],
  )

  const { porEc: followPorEc } = useUltimoFollowPorEc(useMemo(() => ecsDoMes.map(e => e.id), [ecsDoMes]))

  const cardsMes = useMemo(() => ({
    total: ecsDoMes.length,
    valorTotal: ecsDoMes.reduce((acc, e) => acc + e.valor, 0),
    pendentes: ecsDoMes.filter(e => e.status === 'pendente').length,
    validados: ecsDoMes.filter(e => e.status === 'validado').length,
  }), [ecsDoMes])

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        {/* KPI cards do mês da apresentação */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-400"><FileStack className="h-4 w-4" /> ECs no mês</div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{cardsMes.total}</div>
          </div>
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-400"><Wallet className="h-4 w-4" /> Valor no mês</div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{formatCurrencyCompact(cardsMes.valorTotal)}</div>
          </div>
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-400"><Clock className="h-4 w-4" /> Pendentes</div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{cardsMes.pendentes}</div>
          </div>
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-400"><CheckCircle2 className="h-4 w-4" /> Validados</div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{cardsMes.validados}</div>
          </div>
        </div>

        {/* Evolução mensal */}
        <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Evolução Mensal dos Descontos (últimos 12 meses)
          </p>
          {evolucaoMensal.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-gray-400 dark:text-slate-500">
              Sem ECs registrados ainda.
            </div>
          ) : (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolucaoMensal} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <XAxis dataKey="mesLabel" tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 12, fontWeight: 500 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 11, fontWeight: 500 }} tickFormatter={v => formatCurrencyCompact(v)} width={56} />
                  <Tooltip content={<TooltipEvolucao />} cursor={{ fill: cursor }} />
                  <Bar dataKey="valor" name="Descontado" fill={COR_AVR} radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Lista de ECs do mês, com status + follow — pra cobrar justificativa ao vivo */}
        <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            ECs do mês — {MES_ABREV[mes]}/{ano}
          </p>
          {ecsDoMes.length === 0 ? (
            <div className="flex h-[160px] items-center justify-center text-sm text-gray-400 dark:text-slate-500">
              Sem ECs nesse mês.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase text-gray-400 dark:border-slate-700 dark:text-slate-500">
                    <th className="py-2 pr-3 text-left font-medium">Data</th>
                    <th className="py-2 pr-3 text-left font-medium">Chamado</th>
                    <th className="py-2 pr-3 text-left font-medium">Motivo</th>
                    <th className="py-2 pr-3 text-right font-medium">Valor</th>
                    <th className="py-2 pr-3 text-center font-medium">ND</th>
                    <th className="py-2 pr-3 text-center font-medium">Status</th>
                    <th className="py-2 pl-3 text-left font-medium">Follow</th>
                  </tr>
                </thead>
                <tbody>
                  {ecsDoMes.map(e => {
                    const follow = followPorEc[e.id]
                    return (
                      <tr key={e.id} className="border-b border-gray-100 align-top last:border-0 dark:border-slate-700/50">
                        <td className="py-2 pr-3 whitespace-nowrap text-gray-500 dark:text-slate-400">{formatDataBr(e.data)}</td>
                        <td className="py-2 pr-3 font-medium text-gray-800 dark:text-slate-200">{e.numero_chamado}</td>
                        <td className="py-2 pr-3 text-gray-600 dark:text-slate-300">{e.motivo ?? '—'}</td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums text-gray-800 dark:text-slate-200">
                          {formatCurrencyInteiro(e.valor)}
                        </td>
                        <td className="py-2 pr-3 text-center">
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', ND_PILL[e.nota_debito])}>
                            {ND_LABEL[e.nota_debito]}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-center">
                          <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_PILL[e.status])}>
                            {STATUS_LABEL[e.status]}
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

        <JustificativaEAcoesCard justificativa={justificativa} acoes={acoesRelacionadas} />
      </div>
    </div>
  )
}
