import { useEffect, useMemo, useState } from 'react'
import { Bar, Cell, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '@/lib/supabase'
import { PillToggle } from '@/components/ui/pill-toggle'
import { RankingTabelaPerdas, type RankingLinhaPerda } from '@/components/ranking/RankingTabelas'
import { calcularMatrizPerdas, type IndicadorKey } from '@/lib/painel-perdas-calculations'
import { COR_AVR, COR_META_DESTAQUE, MES_ABREV, getChartColors } from '@/components/farol/chart-shared'
import { COR_BATEU_CORP, COR_PERDEU_CORP } from '@/pages/sdg-corporativo/cores'
import { formatCurrencyCompact, formatCurrencyInteiro } from '@/lib/utils'
import type { DreLongoRow, MetaPerdaIndicador, Unidade } from '@/types'

interface Props {
  titulo: string
  /** Chave do indicador em `metas_perdas_indicadores`/`INDICADORES_PERDAS` (ex: 'vales', 'multas'). */
  indicador: IndicadorKey
  /** Prefixos de conta do indicador (ex: Vales = ['051','052'], Multas = ['137','222']). */
  contas: readonly string[]
  /** Linhas do ano selecionado, de todas as unidades — sem filtro de negócio (indicadores de Perdas são sempre CONS, ver painel-perdas-calculations.ts). */
  rowsAnoTodosNegocios: DreLongoRow[]
  unidades: Unidade[]
  ano: number
  mes: number
}

const MESES_12 = Array.from({ length: 12 }, (_, i) => i + 1)

/** Soma da diferença (REAL−REMUN) das contas do indicador num ano/mês; null = sem dados no período. */
function valorMes(rows: DreLongoRow[], contas: readonly string[], ano: number, mes: number): number | null {
  const rowsMes = rows.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === ano && r.mes === mes)
  if (rowsMes.length === 0) return null
  return rowsMes
    .filter(r => contas.some(c => r.conta_codigo.startsWith(c)))
    .reduce((acc, r) => acc + (r.diferenca ?? 0), 0)
}

function TooltipIndicador({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number | null; color: string }[]; label?: number }) {
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
 * Slide de indicador do Painel de Perdas (Vales, Multas etc.) no SDG
 * Corporativo — mesmo modelo de Receita/EBITDA/Despesa Administrativa:
 * evolução mensal do resultado consolidado (AMBEV) em barra, meta em linha,
 * tabela de Ranking (todas as unidades + AMBEV) com toggle Mensal/YTD.
 * Diferente dos outros 3: indicadores de Perdas são sempre CONS (não usam
 * `negocio`) e a meta vem de Metas de Perdas (`metas_perdas_indicadores`),
 * não da tabela `orcamentos`.
 */
export function SlideIndicadorPerdas({ titulo, indicador, contas, rowsAnoTodosNegocios, unidades, ano, mes }: Props) {
  const { axis, legend } = getChartColors()
  const nomesUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const rowsCons = useMemo(() => rowsAnoTodosNegocios.filter(r => r.negocio === 'CONS'), [rowsAnoTodosNegocios])
  const rowsAmbev = useMemo(() => rowsCons.filter(r => r.unidade === 'AMBEV'), [rowsCons])

  const [metaAnualIndicador, setMetaAnualIndicador] = useState<number | null>(null)
  useEffect(() => {
    let ativo = true
    supabase
      .from('metas_perdas_indicadores')
      .select('*')
      .eq('unidade', 'AMBEV')
      .eq('ano', ano)
      .eq('indicador', indicador)
      .maybeSingle()
      .then(({ data }) => { if (ativo) setMetaAnualIndicador(data ? (data as MetaPerdaIndicador).meta_anual : null) })
    return () => { ativo = false }
  }, [ano, indicador])
  const metaMensal = metaAnualIndicador != null ? metaAnualIndicador / 12 : null

  const serie = useMemo(() => MESES_12.map(m => ({
    mes: m,
    valor: valorMes(rowsAmbev, contas, ano, m),
    meta: metaMensal,
  })), [rowsAmbev, contas, ano, metaMensal])

  function corBarra(valor: number | null): string {
    if (valor === null || metaMensal === null) return COR_AVR
    return valor >= metaMensal ? COR_BATEU_CORP : COR_PERDEU_CORP
  }

  const [periodoTabela, setPeriodoTabela] = useState<'mensal' | 'ytd'>('mensal')
  const ranking = useMemo(() => {
    const meses = periodoTabela === 'ytd' ? MESES_12.filter(m => m <= mes) : [mes]
    const matriz = calcularMatrizPerdas(rowsCons, [], [], ano, meses)
    const linhaIndicador = matriz.linhas.find(l => l.key === indicador)
    const valores = linhaIndicador?.valores ?? {}
    const individuais = matriz.unidades.filter(u => u !== 'AMBEV')

    // Indicador de perda de verdade (quanto menor melhor) — rank 1 = pior resultado, pra dar destaque a quem mais perde.
    const comValor = individuais
      .map(u => ({ unidade: u, valor: valores[u] ?? null }))
      .filter((x): x is { unidade: string; valor: number } => x.valor !== null)
      .sort((a, b) => a.valor - b.valor)
    const semValor = individuais.filter(u => (valores[u] ?? null) === null)

    let rank = 0
    const linhas: RankingLinhaPerda[] = [
      ...comValor.map(x => ({ ...x, rank: ++rank })),
      ...semValor.map(u => ({ unidade: u, valor: null, rank: null })),
    ]
    linhas.push({ unidade: 'AMBEV', valor: valores['AMBEV'] ?? null, rank: null })
    return linhas
  }, [rowsCons, indicador, ano, mes, periodoTabela])

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            {titulo} — AMBEV — CONS — {ano}
          </p>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
                <XAxis dataKey="mes" tickFormatter={m => MES_ABREV[m] ?? m} tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 12, fontWeight: 500 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 11, fontWeight: 500 }} tickFormatter={v => formatCurrencyCompact(v)} width={64} />
                <Tooltip content={<TooltipIndicador />} />
                <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, color: legend }} />
                <Bar dataKey="valor" name="Realizado" radius={[4, 4, 0, 0]} barSize={32}>
                  {serie.map(p => <Cell key={p.mes} fill={corBarra(p.valor)} />)}
                  <LabelList
                    dataKey="valor"
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
          <PillToggle<'mensal' | 'ytd'>
            opcoes={[{ value: 'mensal', label: `Mensal — M${mes}` }, { value: 'ytd', label: 'YTD' }]}
            value={periodoTabela}
            onChange={setPeriodoTabela}
          />
        </div>

        <RankingTabelaPerdas
          linhas={ranking}
          nomesUnidade={nomesUnidade}
          titulo={titulo}
          subtitulo={`Descontado (diferença DRE, contas ${contas.join('/')}) · ${periodoTabela === 'ytd' ? 'YTD — acumulado do ano' : `Mensal — M${mes}`}`}
        />
      </div>
    </div>
  )
}
