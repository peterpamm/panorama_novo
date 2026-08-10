import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '@/lib/supabase'
import { COR_AVR, COR_META, MES_ABREV, getChartColors } from '@/components/farol/chart-shared'
import { calcularAderenciaPorUnidade } from '@/lib/rotinas-financeiras'
import { cn, formatPercent } from '@/lib/utils'
import type { RotinaFinanceira, RotinaFinanceiraStatus } from '@/types'

interface Props {
  unidadeSel: string
  ano: number
  mes: number
}

const STATUS_PILL: Record<string, string> = {
  OK: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  NOK: 'bg-red-500/15 text-red-700 dark:text-red-400',
  'N/A': 'bg-muted text-muted-foreground',
}

function TooltipAderencia({ active, payload, label, meta }: { active?: boolean; payload?: { value: number | null }[]; label?: string; meta: number | null }) {
  if (!active || !payload || payload.length === 0) return null
  const valor = payload[0].value
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
      <p className="mb-1 font-semibold">{label}</p>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: COR_AVR }} />
        Aderência: <span className="font-medium text-popover-foreground">{valor === null ? '—' : formatPercent(valor, 1)}</span>
      </p>
      {meta !== null && (
        <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full border border-border" style={{ background: COR_META }} />
          Meta: <span className="font-medium text-popover-foreground">{formatPercent(meta, 0)}</span>
        </p>
      )}
    </div>
  )
}

/**
 * Slide "Rotinas" (apresentação SDG) — resumo do GOP de Rotinas da unidade:
 * o que não foi feito no prazo no mês da apresentação (status NOK, com a
 * observação já registrada, se tiver), a evolução da aderência no ano e as
 * rotinas que mais viram NOK (pra apontar onde a unidade trava de verdade).
 */
export function SlideRotinas({ unidadeSel, ano, mes }: Props) {
  const { axis, cursor } = getChartColors()

  const [rotinas, setRotinas] = useState<RotinaFinanceira[]>([])
  const [statusAno, setStatusAno] = useState<RotinaFinanceiraStatus[]>([])
  const [meta, setMeta] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    Promise.all([
      supabase.from('rotinas_financeiras').select('*').eq('ativo', true).order('setor').order('ordem'),
      supabase.from('rotinas_financeiras_status').select('*').eq('ano', ano),
      supabase.from('meta_rotinas_financeiras').select('*').maybeSingle(),
    ]).then(([r, s, m]) => {
      if (!ativo) return
      setRotinas((r.data as RotinaFinanceira[]) ?? [])
      setStatusAno((s.data as RotinaFinanceiraStatus[]) ?? [])
      setMeta(m.data ? Number((m.data as { meta_pct: number }).meta_pct) : null)
      setLoading(false)
    })
    return () => { ativo = false }
  }, [ano])

  const rotinasIds = useMemo(() => new Set(rotinas.map(r => r.id!)), [rotinas])
  const rotinaPorId = useMemo(() => new Map(rotinas.map(r => [r.id!, r])), [rotinas])

  const aderencia = useMemo(
    () => calcularAderenciaPorUnidade(rotinasIds, statusAno, unidadeSel),
    [rotinasIds, statusAno, unidadeSel],
  )
  const serieAderencia = useMemo(
    () => aderencia.porMes.map((valor, i) => ({ mesLabel: MES_ABREV[i + 1], valor })),
    [aderencia],
  )

  const statusUnidadeAno = useMemo(
    () => statusAno.filter(s => s.unidade === unidadeSel && rotinasIds.has(s.rotina_id)),
    [statusAno, unidadeSel, rotinasIds],
  )

  const nokDoMes = useMemo(() => {
    return statusUnidadeAno
      .filter(s => s.mes === mes && s.status === 'NOK')
      .map(s => ({ status: s, rotina: rotinaPorId.get(s.rotina_id) }))
      .filter((x): x is { status: RotinaFinanceiraStatus; rotina: RotinaFinanceira } => x.rotina !== undefined)
      .sort((a, b) => a.rotina.setor.localeCompare(b.rotina.setor) || a.rotina.ordem - b.rotina.ordem)
  }, [statusUnidadeAno, mes, rotinaPorId])

  const piores = useMemo(() => {
    const mapa = new Map<string, { nok: number; total: number }>()
    for (const s of statusUnidadeAno) {
      if (s.status !== 'OK' && s.status !== 'NOK') continue
      const atual = mapa.get(s.rotina_id) ?? { nok: 0, total: 0 }
      atual.total += 1
      if (s.status === 'NOK') atual.nok += 1
      mapa.set(s.rotina_id, atual)
    }
    return Array.from(mapa.entries())
      .map(([rotinaId, v]) => ({ rotina: rotinaPorId.get(rotinaId), ...v, pct: v.total > 0 ? (v.nok / v.total) * 100 : 0 }))
      .filter((x): x is { rotina: RotinaFinanceira; nok: number; total: number; pct: number } => x.rotina !== undefined && x.nok > 0)
      .sort((a, b) => b.nok - a.nok || b.pct - a.pct)
      .slice(0, 8)
  }, [statusUnidadeAno, rotinaPorId])

  const aderenciaMesAtual = aderencia.porMes[mes - 1] ?? null

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-slate-500">
        Carregando rotinas...
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-4">
            <div className="text-xs text-gray-400 dark:text-slate-400">Aderência do mês</div>
            <div className={cn(
              'mt-1.5 text-2xl font-bold tabular-nums',
              aderenciaMesAtual === null ? 'text-gray-400 dark:text-slate-500'
                : meta !== null && aderenciaMesAtual >= meta ? 'text-emerald-600 dark:text-emerald-400'
                : meta !== null ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white',
            )}>
              {aderenciaMesAtual === null ? '—' : formatPercent(aderenciaMesAtual, 1)}
            </div>
          </div>
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-4">
            <div className="text-xs text-gray-400 dark:text-slate-400">Aderência acumulada — {ano}</div>
            <div className={cn(
              'mt-1.5 text-2xl font-bold tabular-nums',
              aderencia.acumulado === null ? 'text-gray-400 dark:text-slate-500'
                : meta !== null && aderencia.acumulado >= meta ? 'text-emerald-600 dark:text-emerald-400'
                : meta !== null ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white',
            )}>
              {aderencia.acumulado === null ? '—' : formatPercent(aderencia.acumulado, 1)}
            </div>
          </div>
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-4">
            <div className="text-xs text-gray-400 dark:text-slate-400">Rotinas fora do prazo no mês</div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{nokDoMes.length}</div>
          </div>
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-4">
            <div className="text-xs text-gray-400 dark:text-slate-400">Meta de aderência</div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{meta === null ? '—' : formatPercent(meta, 0)}</div>
          </div>
        </div>

        {/* Evolução da aderência no ano */}
        <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Aderência Mensal — {ano}
          </p>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serieAderencia} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <XAxis dataKey="mesLabel" tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 12, fontWeight: 500 }} />
                <YAxis
                  tickLine={false} axisLine={false} domain={[0, 100]}
                  tick={{ fill: axis, fontSize: 11, fontWeight: 500 }} tickFormatter={v => `${v}%`} width={44}
                />
                <Tooltip content={<TooltipAderencia meta={meta} />} cursor={{ fill: cursor }} />
                {meta !== null && <ReferenceLine y={meta} stroke={COR_META} strokeDasharray="4 4" />}
                <Bar dataKey="valor" name="Aderência" fill={COR_AVR} radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Rotinas fora do prazo no mês */}
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Fora do prazo — {MES_ABREV[mes]}/{ano}
            </p>
            {nokDoMes.length === 0 ? (
              <div className="flex h-[180px] items-center justify-center text-sm text-gray-400 dark:text-slate-500">
                Nenhuma rotina NOK nesse mês.
              </div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-gray-400 dark:border-slate-700 dark:text-slate-500">
                      <th className="py-2 pr-3 text-left font-medium">Rotina</th>
                      <th className="py-2 pr-3 text-left font-medium">Prazo</th>
                      <th className="py-2 pl-3 text-left font-medium">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nokDoMes.map(({ status, rotina }) => (
                      <tr key={status.id} className="border-b border-gray-100 align-top last:border-0 dark:border-slate-700/50">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-gray-800 dark:text-slate-200">{rotina.nome}</div>
                          <div className="text-xs text-gray-400 dark:text-slate-500">{rotina.setor}</div>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap text-gray-500 dark:text-slate-400">{rotina.prazo}</td>
                        <td className="py-2 pl-3 text-gray-600 dark:text-slate-300">
                          {status.observacao || <span className="italic text-red-500 dark:text-red-400">Sem observação registrada</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rotinas que mais travam no ano */}
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Rotinas que mais travam — {ano}
            </p>
            {piores.length === 0 ? (
              <div className="flex h-[180px] items-center justify-center text-sm text-gray-400 dark:text-slate-500">
                Nenhum NOK registrado no ano.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase text-gray-400 dark:border-slate-700 dark:text-slate-500">
                    <th className="py-2 pr-3 text-left font-medium">Rotina</th>
                    <th className="py-2 pr-3 text-center font-medium">NOK</th>
                    <th className="py-2 pl-3 text-center font-medium">% NOK</th>
                  </tr>
                </thead>
                <tbody>
                  {piores.map(p => (
                    <tr key={p.rotina.id} className="border-b border-gray-100 last:border-0 dark:border-slate-700/50">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-800 dark:text-slate-200">{p.rotina.nome}</div>
                        <div className="text-xs text-gray-400 dark:text-slate-500">{p.rotina.setor}</div>
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_PILL.NOK)}>{p.nok}/{p.total}</span>
                      </td>
                      <td className="py-2 pl-3 text-center font-semibold tabular-nums text-red-600 dark:text-red-400">
                        {formatPercent(p.pct, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
