import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '@/lib/supabase'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { OPERACOES_ARMAZEM_T1 } from '@/lib/armazem-t1-bi-parser'
import { JustificativaEAcoesCard } from '@/pages/sdg/JustificativaEAcoesCard'
import { COR_AVR, COR_META, MES_ABREV, getChartColors } from '@/components/farol/chart-shared'
import { cn, formatCurrencyCompact, formatCurrencyInteiro, formatPercent } from '@/lib/utils'
import type {
  MetaArmazemQuebras, MetaArmazemRefugo, MetaArmazemT1Quebras, PlanoAcao,
  ResultadoArmazemBi, ResultadoArmazemQuebras, SdgJustificativa, Unidade,
} from '@/types'

const COR_BATEU = '#10b981'
const COR_PERDEU = '#ef4444'

interface Props {
  tipo: 'refugo' | 'quebras'
  unidadeSel: string
  unidades: Unidade[]
  ano: number
  mes: number
  justificativa: SdgJustificativa | undefined
  acoesRelacionadas: PlanoAcao[]
}

const MESES_12 = Array.from({ length: 12 }, (_, i) => i + 1)

function TooltipMesSimples({ active, payload, label, formatarValor, nomeSerie }: {
  active?: boolean
  payload?: { value: number | null }[]
  label?: number
  formatarValor: (v: number) => string
  nomeSerie: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const valor = payload[0].value
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
      <p className="mb-1 font-semibold">{MES_ABREV[label ?? 0] ?? label}</p>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: COR_AVR }} />
        {nomeSerie}: <span className="font-medium text-popover-foreground">{valor == null ? '—' : formatarValor(valor)}</span>
      </p>
    </div>
  )
}

/**
 * Slide de Refugo ou Quebras (abertura de Vales Físicos) — mesma fonte usada
 * no cálculo da RV de Armazém (`resultados_armazem_bi`/`resultados_armazem_quebras`).
 * Quanto menor melhor nos dois: barra verde quando bate a meta, vermelha
 * quando perde.
 */
export function SlideIndicadorArmazem({ tipo, unidadeSel, unidades, ano, mes, justificativa, acoesRelacionadas }: Props) {
  const { axis, cursor } = getChartColors()
  const titulo = tipo === 'refugo' ? 'Refugo' : 'Quebras'
  const formatarValor = tipo === 'refugo' ? (v: number) => formatPercent(v, 2) : formatCurrencyInteiro
  const formatarEixo = tipo === 'refugo' ? (v: number) => `${v}%` : (v: number) => formatCurrencyCompact(v)

  const ehArmazemT1 = useMemo(
    () => OPERACOES_ARMAZEM_T1.some(nome => resolverUnidade(nome, unidades)?.codigo === unidadeSel),
    [unidades, unidadeSel],
  )

  const [rows, setRows] = useState<{ mes: number; valor: number }[]>([])
  const [meta, setMeta] = useState<number | null>(null)
  useEffect(() => {
    let ativo = true
    if (tipo === 'refugo') {
      Promise.all([
        supabase.from('resultados_armazem_bi').select('*').eq('unidade', unidadeSel).eq('ano', ano).eq('indicador', 'refugo'),
        supabase.from('rv_armazem_refugo_meta').select('*').maybeSingle(),
      ]).then(([r, m]) => {
        if (!ativo) return
        setRows(((r.data as ResultadoArmazemBi[]) ?? []).map(x => ({ mes: x.mes, valor: x.valor })))
        setMeta(m.data ? (m.data as MetaArmazemRefugo).meta_pct : null)
      })
    } else {
      Promise.all([
        supabase.from('resultados_armazem_quebras').select('*').eq('unidade', unidadeSel).eq('ano', ano),
        supabase.from(ehArmazemT1 ? 'rv_armazem_t1_quebras_meta' : 'rv_armazem_quebras_meta').select('*').maybeSingle(),
      ]).then(([r, m]) => {
        if (!ativo) return
        setRows(((r.data as ResultadoArmazemQuebras[]) ?? []).map(x => ({ mes: x.mes, valor: x.valor })))
        setMeta(m.data ? (m.data as MetaArmazemQuebras | MetaArmazemT1Quebras).meta_valor : null)
      })
    }
    return () => { ativo = false }
  }, [tipo, unidadeSel, ano, ehArmazemT1])

  const porMes = useMemo(() => {
    const mapa = new Map(rows.map(r => [r.mes, r.valor]))
    return MESES_12.map(m => ({ mes: m, valor: mapa.get(m) ?? null }))
  }, [rows])

  const valorMesAtual = porMes.find(p => p.mes === mes)?.valor ?? null
  const bateuMes = valorMesAtual !== null && meta !== null ? valorMesAtual <= meta : null

  function corBarra(valor: number | null): string {
    if (valor === null || meta === null) return COR_AVR
    return valor <= meta ? COR_BATEU : COR_PERDEU
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div className={cn(
            'rounded-2xl border-l-4 bg-white shadow-md dark:bg-slate-800/60 p-4',
            bateuMes === null ? 'border-gray-300 dark:border-slate-600' : bateuMes ? 'border-emerald-500' : 'border-red-500',
          )}>
            <div className="text-sm font-semibold text-gray-800 dark:text-slate-200">{titulo} — M{mes}</div>
            <div className={cn(
              'mt-2 text-3xl font-bold tracking-tight',
              bateuMes === null ? 'text-gray-500 dark:text-slate-400' : bateuMes ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
            )}>
              {valorMesAtual === null ? '—' : formatarValor(valorMesAtual)}
            </div>
          </div>
          <div className="rounded-2xl border-l-4 border-gray-300 bg-white shadow-md dark:border-slate-600 dark:bg-slate-800/60 p-4">
            <div className="text-sm font-semibold text-gray-800 dark:text-slate-200">Meta</div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-gray-700 dark:text-slate-300">
              {meta === null ? 'N/A' : formatarValor(meta)}
            </div>
          </div>
        </div>

        <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            {titulo} Mensal — {ano}
          </p>
          <div className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porMes} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
                <XAxis dataKey="mes" tickFormatter={m => MES_ABREV[m] ?? m} tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 12, fontWeight: 500 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 11, fontWeight: 500 }} tickFormatter={formatarEixo} width={56} />
                <Tooltip content={<TooltipMesSimples formatarValor={formatarValor} nomeSerie={titulo} />} cursor={{ fill: cursor }} />
                {meta !== null && <ReferenceLine y={meta} stroke={COR_META} strokeDasharray="4 4" />}
                <Bar dataKey="valor" name={titulo} radius={[4, 4, 0, 0]} barSize={36}>
                  {porMes.map(p => <Cell key={p.mes} fill={corBarra(p.valor)} />)}
                  <LabelList
                    dataKey="valor"
                    position="top"
                    formatter={(v: unknown) => typeof v === 'number' ? formatarValor(v) : ''}
                    style={{ fontSize: 11, fontWeight: 600 }}
                    className="fill-gray-600 dark:fill-slate-300"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <JustificativaEAcoesCard justificativa={justificativa} acoes={acoesRelacionadas} />
      </div>
    </div>
  )
}
