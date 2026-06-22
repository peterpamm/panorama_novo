import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SeriePontoMensal } from '@/lib/farol-calculations'
import { formatPercent } from '@/lib/utils'

const MES_ABREV: Record<number, string> = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
}

const COR_AVR = '#4f46e5'
const COR_META = '#94a3b8'

function TooltipCustom({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: number }) {
  if (!active || !payload || payload.length === 0) return null
  const avr = payload.find(p => p.dataKey === 'avr')?.value
  const meta = payload.find(p => p.dataKey === 'meta')?.value
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-gray-700">{MES_ABREV[label ?? 0] ?? label}</p>
      {avr !== undefined && (
        <p className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: COR_AVR }} />
          AVR: <span className="font-medium">{formatPercent(avr, 2)}</span>
        </p>
      )}
      {meta !== undefined && meta !== null && (
        <p className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-gray-400" style={{ background: 'white' }} />
          Meta: <span className="font-medium">{formatPercent(meta, 2)}</span>
        </p>
      )}
    </div>
  )
}

interface IndicadorChartProps {
  serie: SeriePontoMensal[]
  gradientId: string
}

export function IndicadorChart({ serie, gradientId }: IndicadorChartProps) {
  if (serie.length < 2) {
    return (
      <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">
        Sem meses suficientes para o gráfico ainda.
      </div>
    )
  }

  return (
    <div className="h-[140px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={serie} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COR_AVR} stopOpacity={0.25} />
              <stop offset="100%" stopColor={COR_AVR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="mes"
            tickFormatter={m => MES_ABREV[m] ?? m}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="#94a3b8"
          />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip content={<TooltipCustom />} />
          <Area
            type="monotone"
            dataKey="avr"
            stroke={COR_AVR}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={{ r: 2.5, fill: COR_AVR, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="meta"
            stroke={COR_META}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
