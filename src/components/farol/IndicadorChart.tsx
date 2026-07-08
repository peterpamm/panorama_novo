import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPercent } from '@/lib/utils'
import type { SeriePontoMensal } from '@/lib/farol-calculations'
import type { Natureza } from '@/types'
import { COR_AVR, COR_META, MES_ABREV, PontoDot, PontoLabel, TooltipCustom, getChartColors } from '@/components/farol/chart-shared'

interface IndicadorChartProps {
  serie: SeriePontoMensal[]
  gradientId: string
  natureza: Natureza
  /** Nome da série principal na legenda/tooltip — ex: "Realizado" no lugar do default "AVR Realizado". */
  nomeSerie?: string
  /** Como formatar os valores nos rótulos/tooltip — default percentual (AVR); passe formatCurrencyInteiro pra séries em R$. */
  formatter?: (v: number) => string
}

export function IndicadorChart({ serie, gradientId, natureza, nomeSerie = 'AVR Realizado', formatter = v => formatPercent(v, 2) }: IndicadorChartProps) {
  if (serie.length < 2) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        Sem meses suficientes para o gráfico ainda.
      </div>
    )
  }

  const ultimoIndex = serie.length - 1
  const valores = serie.map(p => ({ avr: p.avr, meta: p.meta }))
  const { grid, axis, legend } = getChartColors()

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={serie} margin={{ top: 28, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COR_AVR} stopOpacity={0.22} />
              <stop offset="100%" stopColor={COR_AVR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={grid} />
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
          <Tooltip content={<TooltipCustom nomeAvr={nomeSerie} dataKeyAvr="avr" dataKeyMeta="meta" formatter={formatter} />} />
          <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, color: legend }} />
          <Area type="monotone" dataKey="avr" stroke="none" fill={`url(#${gradientId})`} legendType="none" isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="avr"
            name={nomeSerie}
            stroke={COR_AVR}
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={<PontoDot ultimoIndex={ultimoIndex} natureza={natureza} valores={valores} />}
            activeDot={{ r: 7 }}
            label={<PontoLabel ultimoIndex={ultimoIndex} natureza={natureza} valores={valores} formatter={formatter} />}
          />
          <Line
            type="monotone"
            dataKey="meta"
            name="Meta"
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
