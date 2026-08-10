import { useMemo, useState } from 'react'
import { Bar, Cell, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PillToggle } from '@/components/ui/pill-toggle'
import { RankingTabelaReceita } from '@/components/ranking/RankingTabelas'
import { calcularRankingReceita, type PeriodoRanking } from '@/lib/ranking-calculations'
import { calcularReceita, normalizarParaCalculo } from '@/lib/farol-calculations'
import { COR_AVR, COR_META_DESTAQUE, MES_ABREV, getChartColors } from '@/components/farol/chart-shared'
import { corBarraCorporativo } from '@/pages/sdg-corporativo/cores'
import { formatCurrencyCompact, formatCurrencyInteiro } from '@/lib/utils'
import { CONTA_RECEITA } from '@/lib/constants'
import type { DreLongoRow, OrcamentoLinha, Unidade } from '@/types'

interface Props {
  /** Linhas do negócio selecionado, de todas as unidades, já filtradas pro ano selecionado. */
  rowsAno: DreLongoRow[]
  /** Orçamento do negócio selecionado, de todas as unidades, já filtrado pro ano selecionado. */
  orcamentoAno: OrcamentoLinha[]
  unidades: Unidade[]
  /** Negócio selecionado (CONS/ROTA/ARMAZEM...) — só rotula o slide, o filtro em si já vem aplicado em `rowsAno`/`orcamentoAno`. */
  negocio: string
  ano: number
  mes: number
}

const MESES_12 = Array.from({ length: 12 }, (_, i) => i + 1)

function TooltipReceita({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number | null; color: string }[]; label?: number }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
      <p className="mb-1.5 font-semibold">{MES_ABREV[label ?? 0] ?? label}</p>
      {payload.map(p => (
        <p key={p.name} className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium text-popover-foreground">{p.value != null ? formatCurrencyInteiro(p.value) : '—'}</span>
        </p>
      ))}
    </div>
  )
}

/**
 * Slide "Receita Líquida" do SDG Corporativo: evolução mensal da Receita
 * Líquida Operacional consolidada (AMBEV, visão de todas as unidades) em
 * barra, com a meta orçada em linha, seguido da mesma tabela do Ranking >
 * Receita (todas as unidades + total AMBEV, Realizado/Orçado/Impacto/%
 * Atingimento) — com um toggle Mensal/YTD.
 */
export function SlideReceita({ rowsAno, orcamentoAno, unidades, negocio, ano, mes }: Props) {
  const { axis, legend } = getChartColors()
  const nomesUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const rowsAmbev = useMemo(() => rowsAno.filter(r => r.unidade === 'AMBEV'), [rowsAno])
  const orcamentoAmbev = useMemo(
    () => orcamentoAno.filter(o => o.unidade === 'AMBEV' && o.conta_codigo === CONTA_RECEITA),
    [orcamentoAno],
  )

  const serieReceita = useMemo(() => MESES_12.map(m => {
    const rowsMes = rowsAmbev.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === m)
    const realizado = rowsMes.length > 0 ? calcularReceita(normalizarParaCalculo(rowsMes)) : null
    const orcadoMes = orcamentoAmbev.filter(o => o.mes === m)
    const meta = orcadoMes.length > 0 ? orcadoMes.reduce((acc, o) => acc + o.orcado, 0) : null
    return { mes: m, realizado, meta }
  }), [rowsAmbev, orcamentoAmbev])

  const [periodoTabela, setPeriodoTabela] = useState<PeriodoRanking>('mensal')
  const rankingReceita = useMemo(
    () => calcularRankingReceita(rowsAno, orcamentoAno, { negocio, ano, periodo: periodoTabela, mes }),
    [rowsAno, orcamentoAno, negocio, ano, periodoTabela, mes],
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Receita Líquida Operacional — AMBEV — {negocio} — {ano}
          </p>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serieReceita} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
                <XAxis dataKey="mes" tickFormatter={m => MES_ABREV[m] ?? m} tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 12, fontWeight: 500 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 11, fontWeight: 500 }} tickFormatter={v => formatCurrencyCompact(v)} width={64} />
                <Tooltip content={<TooltipReceita />} />
                <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, color: legend }} />
                <Bar dataKey="realizado" name="Realizado" radius={[4, 4, 0, 0]} barSize={32}>
                  {serieReceita.map(p => (
                    <Cell key={p.mes} fill={p.realizado === null ? COR_AVR : corBarraCorporativo(p.realizado, p.meta, 'performance')} />
                  ))}
                  <LabelList
                    dataKey="realizado"
                    position="top"
                    formatter={(v: unknown) => typeof v === 'number' ? formatCurrencyInteiro(v) : ''}
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

        <RankingTabelaReceita
          linhas={rankingReceita}
          nomesUnidade={nomesUnidade}
          titulo="Receita"
          subtitulo={`Receita Líquida Operacional realizada vs orçada · ${periodoTabela === 'ytd' ? 'YTD — acumulado do ano' : `Mensal — M${mes}`}`}
        />
      </div>
    </div>
  )
}
