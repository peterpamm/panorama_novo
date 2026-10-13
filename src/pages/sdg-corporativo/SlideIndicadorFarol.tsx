import { useMemo, useState } from 'react'
import { Bar, Cell, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PillToggle } from '@/components/ui/pill-toggle'
import { RankingTabelaIndicador } from '@/components/ranking/RankingTabelas'
import { calcularRankingIndicador, type PeriodoRanking } from '@/lib/ranking-calculations'
import { avrPorPrefixo, normalizarParaCalculo } from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { COR_AVR, COR_META_DESTAQUE, MES_ABREV, getChartColors } from '@/components/farol/chart-shared'
import { corBarraCorporativo } from '@/pages/sdg-corporativo/cores'
import { formatPercent } from '@/lib/utils'
import { PACOTES } from '@/lib/constants'
import type { DreLongoRow, OrcamentoLinha, Unidade } from '@/types'

interface Props {
  titulo: string
  /** Código do pacote em `PACOTES` (ex: '233' EBITDA, '900' Gastos Totais). */
  codigo: string
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

function TooltipIndicador({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number | null; color: string }[]; label?: number }) {
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
 * Slide genérico de indicador % do Farol (ex: EBITDA, Gastos Totais) no SDG
 * Corporativo — evolução mensal do AVR consolidado (AMBEV) em barra, meta
 * orçada em linha, tabela de Ranking (todas as unidades + total AMBEV, AVR/
 * Meta/Δ da Meta/Impacto) — com toggle Mensal/YTD. Indicadores com quebra em
 * subcontas (ex: Despesa Administrativa → Top Contas) têm slide próprio.
 */
export function SlideIndicadorFarol({ titulo, codigo, rowsAno, orcamentoAno, unidades, negocio, ano, mes }: Props) {
  const { axis, legend, cursor } = getChartColors()
  const info = PACOTES[codigo]
  const nomesUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const rowsAmbev = useMemo(() => rowsAno.filter(r => r.unidade === 'AMBEV'), [rowsAno])
  const orcamentoAmbev = useMemo(() => orcamentoAno.filter(o => o.unidade === 'AMBEV'), [orcamentoAno])

  const serie = useMemo(() => MESES_12.map(m => {
    const rowsMes = rowsAmbev.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === m)
    const avr = rowsMes.length > 0 ? avrPorPrefixo(normalizarParaCalculo(rowsMes), info.prefixos) : null
    const meta = buscarMetaOrcamento(orcamentoAmbev, { unidade: 'AMBEV', negocio, ano, codigo, mes: m })
    return { mes: m, avr, meta }
  }), [rowsAmbev, orcamentoAmbev, negocio, ano, codigo, info.prefixos])

  const [periodoTabela, setPeriodoTabela] = useState<PeriodoRanking>('mensal')
  const ranking = useMemo(
    () => calcularRankingIndicador(rowsAno, orcamentoAno, info, codigo, { negocio, ano, periodo: periodoTabela, mes }),
    [rowsAno, orcamentoAno, info, codigo, negocio, ano, periodoTabela, mes],
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            {titulo} — AMBEV — {negocio} — {ano}
          </p>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
                <XAxis dataKey="mes" tickFormatter={m => MES_ABREV[m] ?? m} tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 12, fontWeight: 500 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 11, fontWeight: 500 }} tickFormatter={v => `${v}%`} width={56} />
                <Tooltip content={<TooltipIndicador />} cursor={{ fill: cursor }} />
                <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, color: legend }} />
                <Bar dataKey="avr" name="Realizado" radius={[4, 4, 0, 0]} barSize={32}>
                  {serie.map(p => (
                    <Cell key={p.mes} fill={p.avr === null ? COR_AVR : corBarraCorporativo(p.avr, p.meta, info.natureza)} />
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
          linhas={ranking}
          nomesUnidade={nomesUnidade}
          titulo={titulo}
          subtitulo={`AVR vs meta orçada · ${periodoTabela === 'ytd' ? 'YTD — acumulado do ano' : `Mensal — M${mes}`}`}
        />
      </div>
    </div>
  )
}
