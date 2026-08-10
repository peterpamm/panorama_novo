import { useMemo, useState } from 'react'
import { Bar, Cell, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PillToggle } from '@/components/ui/pill-toggle'
import { RankingTabelaIndicador } from '@/components/ranking/RankingTabelas'
import { calcularRankingIndicador, type PeriodoRanking } from '@/lib/ranking-calculations'
import { avrPorPrefixo, normalizarParaCalculo } from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { topContasFaixa } from '@/lib/top-contas'
import { useContas } from '@/hooks/useContas'
import { COR_AVR, COR_META_DESTAQUE, MES_ABREV, getChartColors } from '@/components/farol/chart-shared'
import { corBarraCorporativo } from '@/pages/sdg-corporativo/cores'
import { cn, formatCurrencyCompact, formatPercent } from '@/lib/utils'
import { PACOTES } from '@/lib/constants'
import type { DreLongoRow, OrcamentoLinha, Unidade } from '@/types'

const CODIGO = '157'
const INFO = PACOTES[CODIGO]
/** Faixa das contas do pacote (157 é o total; 158–227 são as subcontas que compõem a Despesa Administrativa). */
const CONTA_INI = 157
const CONTA_FIM = 227

interface Props {
  /** Linhas do negócio selecionado, de todas as unidades, já filtradas pro ano selecionado. */
  rowsAno: DreLongoRow[]
  /** Orçamento do negócio selecionado, de todas as unidades, já filtrado pro ano selecionado. */
  orcamentoAno: OrcamentoLinha[]
  unidades: Unidade[]
  negocio: string
  ano: number
  mes: number
}

const MESES_12 = Array.from({ length: 12 }, (_, i) => i + 1)

function TooltipDespesas({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number | null; color: string }[]; label?: number }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
      <p className="mb-1.5 font-semibold">{MES_ABREV[label ?? 0] ?? label}</p>
      {payload.map(p => (
        <p key={p.name} className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium text-popover-foreground">{p.value != null ? formatPercent(p.value, 2) : '—'}</span>
        </p>
      ))}
    </div>
  )
}

/**
 * Slide "Despesa Administrativa" do SDG Corporativo (pacote 157, o pacote
 * inteiro — maior que 190 "Despesas ADM Gerais", que é só uma parte dele) —
 * mesmo modelo de Receita/EBITDA: evolução mensal do AVR consolidado (AMBEV)
 * em barra, meta orçada em linha, tabela de Ranking (todas as unidades +
 * total AMBEV) com toggle Mensal/YTD — e, abaixo, o Top Contas de 157 a 227
 * (mesmo período do toggle).
 */
export function SlideDespesaAdministrativa({ rowsAno, orcamentoAno, unidades, negocio, ano, mes }: Props) {
  const { axis, legend } = getChartColors()
  const { contas } = useContas()
  const nomesUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])
  const nomesPorCodigo = useMemo(() => new Map(contas.map(c => [c.codigo, c.descricao])), [contas])

  const rowsAmbev = useMemo(() => rowsAno.filter(r => r.unidade === 'AMBEV'), [rowsAno])
  const orcamentoAmbev = useMemo(() => orcamentoAno.filter(o => o.unidade === 'AMBEV'), [orcamentoAno])

  const serieDespesas = useMemo(() => MESES_12.map(m => {
    const rowsMes = rowsAmbev.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === m)
    const avr = rowsMes.length > 0 ? avrPorPrefixo(normalizarParaCalculo(rowsMes), INFO.prefixos) : null
    const meta = buscarMetaOrcamento(orcamentoAmbev, { unidade: 'AMBEV', negocio, ano, codigo: CODIGO, mes: m })
    return { mes: m, avr, meta }
  }), [rowsAmbev, orcamentoAmbev, negocio, ano])

  const [periodoTabela, setPeriodoTabela] = useState<PeriodoRanking>('mensal')
  const rankingDespesas = useMemo(
    () => calcularRankingIndicador(rowsAno, orcamentoAno, INFO, CODIGO, { negocio, ano, periodo: periodoTabela, mes }),
    [rowsAno, orcamentoAno, negocio, ano, periodoTabela, mes],
  )

  // Top contas 157–227 da AMBEV, no mesmo período do toggle Mensal/YTD.
  const rowsAmbevPeriodo = useMemo(() => {
    if (periodoTabela === 'ytd') {
      const acumulado = rowsAmbev.filter(r => r.tipo_periodo === 'ACUMULADO_ANO')
      if (acumulado.length === 0) return []
      const mesMax = Math.max(...acumulado.map(r => r.mes))
      return acumulado.filter(r => r.mes === mesMax)
    }
    return rowsAmbev.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === mes)
  }, [rowsAmbev, periodoTabela, mes])

  const topContas = useMemo(
    () => topContasFaixa(normalizarParaCalculo(rowsAmbevPeriodo), CONTA_INI, CONTA_FIM),
    [rowsAmbevPeriodo],
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Despesa Administrativa — AMBEV — {negocio} — {ano}
          </p>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serieDespesas} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
                <XAxis dataKey="mes" tickFormatter={m => MES_ABREV[m] ?? m} tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 12, fontWeight: 500 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 11, fontWeight: 500 }} tickFormatter={v => `${v}%`} width={56} />
                <Tooltip content={<TooltipDespesas />} />
                <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, color: legend }} />
                <Bar dataKey="avr" name="Realizado" radius={[4, 4, 0, 0]} barSize={32}>
                  {serieDespesas.map(p => (
                    <Cell key={p.mes} fill={p.avr === null ? COR_AVR : corBarraCorporativo(p.avr, p.meta, INFO.natureza)} />
                  ))}
                  <LabelList
                    dataKey="avr"
                    position="top"
                    formatter={(v: unknown) => typeof v === 'number' ? formatPercent(v, 2) : ''}
                    style={{ fontSize: 10, fontWeight: 600 }}
                    className="fill-gray-600 dark:fill-slate-300"
                  />
                </Bar>
                <Line
                  type="monotone"
                  dataKey="meta"
                  name="Meta"
                  stroke={COR_META_DESTAQUE}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: COR_META_DESTAQUE, strokeWidth: 0 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <PillToggle<PeriodoRanking>
            opcoes={[{ value: 'mensal', label: `Mensal — M${mes}` }, { value: 'ytd', label: 'YTD' }]}
            value={periodoTabela}
            onChange={setPeriodoTabela}
          />
        </div>

        <RankingTabelaIndicador
          linhas={rankingDespesas}
          nomesUnidade={nomesUnidade}
          titulo="Despesa Administrativa"
          subtitulo={`AVR vs meta orçada · ${periodoTabela === 'ytd' ? 'YTD — acumulado do ano' : `Mensal — M${mes}`}`}
        />

        {/* Top contas */}
        <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Top Contas — {CONTA_INI} a {CONTA_FIM} — AMBEV
          </p>
          {topContas.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-gray-400 dark:text-slate-500">
              Sem dados na faixa de contas.
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-800">
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-400 dark:border-slate-700 dark:text-slate-500">
                    <th className="pb-2 pr-2 font-medium">Conta</th>
                    <th className="pb-2 pr-2 text-right font-medium">Realizado</th>
                    <th className="pb-2 text-right font-medium">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {topContas.map(l => (
                    <tr key={l.codigo} className="border-b border-gray-100 last:border-0 dark:border-slate-700/50">
                      <td className="py-1.5 pr-2 text-gray-700 dark:text-slate-300">
                        <span className="mr-1.5 text-xs text-gray-400 dark:text-slate-500">{l.codigo}</span>
                        {nomesPorCodigo.get(l.codigo) ?? '—'}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-gray-800 dark:text-slate-200">
                        {formatCurrencyCompact(l.realizado)}
                      </td>
                      <td className={cn(
                        'py-1.5 text-right font-medium tabular-nums',
                        l.gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                      )}>
                        {formatCurrencyCompact(l.gap)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
