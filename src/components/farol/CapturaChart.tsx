import { ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SeriePontoCaptura } from '@/lib/farol-calculations'
import type { Natureza } from '@/types'
import { COR_AVR, COR_META, COR_NECESSARIO, MES_ABREV, PontoDot, PontoLabel, getChartColors } from '@/components/farol/chart-shared'
import { formatPercent } from '@/lib/utils'

function TooltipCaptura({
  active, payload, label, nomeSerie, nomeMeta, formatter,
}: {
  active?: boolean
  payload?: { value: number; dataKey: string }[]
  label?: number
  nomeSerie: string
  nomeMeta: string
  formatter: (v: number) => string
}) {
  if (!active || !payload || payload.length === 0) return null
  const realizado = payload.find(p => p.dataKey === 'avrRealizado')?.value
  const necessario = payload.find(p => p.dataKey === 'avrNecessario')?.value
  const meta = payload.find(p => p.dataKey === 'metaAnual')?.value
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
      <p className="mb-1.5 font-semibold">{MES_ABREV[label ?? 0] ?? label}</p>
      {realizado !== undefined && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: COR_AVR }} />
          {nomeSerie}: <span className="font-medium text-popover-foreground">{formatter(realizado)}</span>
        </p>
      )}
      {necessario !== undefined && (
        <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: COR_NECESSARIO }} />
          Necessário: <span className="font-medium text-popover-foreground">{formatter(necessario)}</span>
        </p>
      )}
      {meta !== undefined && meta !== null && (
        <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full border border-border" style={{ background: COR_META }} />
          {nomeMeta}: <span className="font-medium text-popover-foreground">{formatter(meta)}</span>
        </p>
      )}
    </div>
  )
}

interface NecessarioLabelProps {
  x?: number
  y?: number
  index?: number
  primeiroFuturoIndex: number
  valor: number | null
  formatter: (v: number) => string
}

function NecessarioLabel({ x, y, index, primeiroFuturoIndex, valor, formatter }: NecessarioLabelProps) {
  if (x === undefined || y === undefined || index !== primeiroFuturoIndex || valor === null) return null
  return (
    <text x={x} y={y - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill={COR_NECESSARIO}>
      {`Necessário: ${formatter(valor)}`}
    </text>
  )
}

interface CapturaChartProps {
  serie: SeriePontoCaptura[]
  natureza: Natureza
  /** Nome da série principal na legenda/tooltip — ex: "Realizado" no lugar do default "AVR Realizado". */
  nomeSerie?: string
  /** Nome da linha de meta na legenda/tooltip — ex: "Meta Mensal (méd.)" quando `metaAnual` carrega uma média mensal em vez do total anual. */
  nomeMeta?: string
  /** Como formatar os valores nos rótulos/tooltip — default percentual (AVR); passe formatCurrencyInteiro pra séries em R$. */
  formatter?: (v: number) => string
}

/** Curva de captura: AVR acumulado realizado x ritmo necessário pros meses restantes x meta anual fixa (cadastro manual). */
export function CapturaChart({ serie, natureza, nomeSerie = 'AVR Realizado', nomeMeta = 'Meta Anual', formatter = v => formatPercent(v, 2) }: CapturaChartProps) {
  if (serie.length < 2) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        Sem meses suficientes para o gráfico ainda.
      </div>
    )
  }

  const { axis, legend } = getChartColors()
  const ultimoRealizadoIndex = serie.reduce((acc, p, i) => (p.avrRealizado !== null ? i : acc), -1)
  const primeiroFuturoIndex = serie.findIndex((p, i) => i > ultimoRealizadoIndex && p.avrNecessario !== null)
  const valoresRealizado = serie.map(p => ({ avr: p.avrRealizado, meta: p.metaAnual }))
  const valorNecessario = primeiroFuturoIndex >= 0 ? serie[primeiroFuturoIndex].avrNecessario : null

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={serie} margin={{ top: 28, right: 16, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="mes"
            tickFormatter={m => MES_ABREV[m] ?? m}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke={axis}
            padding={{ left: 16, right: 16 }}
          />
          <YAxis hide domain={['auto', 'auto']} padding={{ top: 30 }} />
          <Tooltip content={<TooltipCaptura nomeSerie={nomeSerie} nomeMeta={nomeMeta} formatter={formatter} />} />
          <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, color: legend }} />
          <Line
            type="monotone"
            dataKey="avrRealizado"
            name={nomeSerie}
            stroke={COR_AVR}
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={<PontoDot ultimoIndex={ultimoRealizadoIndex} natureza={natureza} valores={valoresRealizado} />}
            activeDot={{ r: 7 }}
            label={<PontoLabel ultimoIndex={ultimoRealizadoIndex} natureza={natureza} valores={valoresRealizado} formatter={formatter} />}
          />
          <Line
            type="monotone"
            dataKey="avrNecessario"
            name="Necessário"
            stroke={COR_NECESSARIO}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            isAnimationActive={false}
            label={<NecessarioLabel primeiroFuturoIndex={primeiroFuturoIndex} valor={valorNecessario} formatter={formatter} />}
          />
          <Line
            type="monotone"
            dataKey="metaAnual"
            name={nomeMeta}
            stroke={COR_META}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
