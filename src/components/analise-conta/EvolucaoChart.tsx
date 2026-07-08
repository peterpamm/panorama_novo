import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SeriePontoConta } from '@/lib/analise-conta-calculations'
import { COR_AVR, COR_META, COR_NEGATIVO, COR_POSITIVO, MES_ABREV, getChartColors } from '@/components/farol/chart-shared'
import { formatCurrencyCompact } from '@/lib/utils'

function TooltipEvolucao({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: number }) {
  if (!active || !payload || payload.length === 0) return null
  const remunerado = payload.find(p => p.dataKey === 'remunerado')?.value
  const realizado = payload.find(p => p.dataKey === 'realizado')?.value
  const gap = payload.find(p => p.dataKey === 'gap')?.value
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
      <p className="mb-1.5 font-semibold">{MES_ABREV[label ?? 0] ?? label}</p>
      {remunerado !== undefined && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: COR_META }} />
          Remunerado: <span className="font-medium text-popover-foreground">{formatCurrencyCompact(remunerado)}</span>
        </p>
      )}
      {realizado !== undefined && (
        <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: COR_AVR }} />
          Realizado: <span className="font-medium text-popover-foreground">{formatCurrencyCompact(realizado)}</span>
        </p>
      )}
      {gap !== undefined && (
        <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: gap >= 0 ? COR_POSITIVO : COR_NEGATIVO }} />
          Gap: <span className="font-medium text-popover-foreground">{formatCurrencyCompact(gap)}</span>
        </p>
      )}
    </div>
  )
}

function GapDot({ cx, cy, index, payload }: { cx?: number; cy?: number; index?: number; payload?: SeriePontoConta }) {
  if (cx === undefined || cy === undefined || index === undefined || !payload) return null
  return <circle cx={cx} cy={cy} r={4} fill={payload.gap >= 0 ? COR_POSITIVO : COR_NEGATIVO} stroke={getChartColors().dotStroke} strokeWidth={1.5} />
}

function GapLabel({ x, y, value }: { x?: number; y?: number; value?: number }) {
  if (x === undefined || y === undefined || value === undefined) return null
  return (
    <text x={x} y={y - 10} textAnchor="middle" fontSize={11} fontWeight={600} fill={value >= 0 ? COR_POSITIVO : COR_NEGATIVO}>
      {formatCurrencyCompact(value)}
    </text>
  )
}

interface EvolucaoChartProps {
  serie: SeriePontoConta[]
}

/** Barras Remunerado/Realizado por mês + linha do Gap (REAL-REMUN), com pontos verdes/vermelhos. */
export function EvolucaoChart({ serie }: EvolucaoChartProps) {
  if (serie.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        Nenhum dado disponível para esse período.
      </div>
    )
  }

  const { grid, axis, legend } = getChartColors()
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={serie} margin={{ top: 36, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={grid} />
          <XAxis
            dataKey="mes"
            tickFormatter={m => MES_ABREV[m] ?? m}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke={axis}
          />
          <YAxis hide />
          <Tooltip content={<TooltipEvolucao />} />
          <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, color: legend }} />
          <Bar dataKey="remunerado" name="Remunerado" fill={COR_META} radius={[3, 3, 0, 0]} barSize={28} />
          <Bar dataKey="realizado" name="Realizado" fill={COR_AVR} radius={[3, 3, 0, 0]} barSize={28} />
          <Line
            type="monotone"
            dataKey="gap"
            name="Gap"
            stroke="#9ca3af"
            strokeWidth={1.5}
            dot={<GapDot />}
            label={<GapLabel />}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
