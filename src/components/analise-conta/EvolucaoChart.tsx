import { Bar, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SeriePontoConta } from '@/lib/analise-conta-calculations'
import { COR_AVR, COR_META, COR_NEGATIVO, COR_POSITIVO, GapPill, MES_ABREV, getChartColors } from '@/components/farol/chart-shared'
import { formatCurrencyCompact } from '@/lib/utils'

function TooltipEvolucao({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: number }) {
  if (!active || !payload || payload.length === 0) return null
  const remunerado = payload.find(p => p.dataKey === 'remunerado')?.value
  const realizado = payload.find(p => p.dataKey === 'realizado')?.value
  const gap = payload.find(p => p.dataKey === 'gap')?.value
  return (
    <div className="rounded-lg border bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-3 py-2.5 text-xs shadow-xl border-gray-200/50 dark:border-gray-700/50">
      <p className="mb-1.5 font-semibold text-gray-900 dark:text-white">{MES_ABREV[label ?? 0] ?? label}</p>
      {remunerado !== undefined && (
        <p className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <span className="h-2 w-2 rounded-full" style={{ background: COR_META }} />
          Remunerado: <span className="font-medium text-gray-900 dark:text-white">{formatCurrencyCompact(remunerado)}</span>
        </p>
      )}
      {realizado !== undefined && (
        <p className="mt-1 flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <span className="h-2 w-2 rounded-full" style={{ background: COR_AVR }} />
          Realizado: <span className="font-medium text-gray-900 dark:text-white">{formatCurrencyCompact(realizado)}</span>
        </p>
      )}
      {gap !== undefined && (
        <p className="mt-1 flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <span className="h-2 w-2 rounded-full" style={{ background: gap >= 0 ? COR_POSITIVO : COR_NEGATIVO }} />
          Gap: <span className="font-medium text-gray-900 dark:text-white">{formatCurrencyCompact(gap)}</span>
        </p>
      )}
    </div>
  )
}

function GapDot({ cx, cy, index, payload }: { cx?: number; cy?: number; index?: number; payload?: SeriePontoConta }) {
  if (cx === undefined || cy === undefined || index === undefined || !payload) return null
  return <circle cx={cx} cy={cy} r={5} fill={payload.gap >= 0 ? COR_POSITIVO : COR_NEGATIVO} stroke="#ffffff" strokeWidth={2} />
}

/** Rótulo do gap em pílula (ver GapPill em chart-shared) acima do ponto da linha. */
function GapLabel({ x, y, value }: { x?: number; y?: number; value?: number }) {
  if (x === undefined || y === undefined || value === undefined) return null
  return <GapPill x={x} y={y - 18} value={value} positivo={value >= 0} />
}

interface EvolucaoChartProps {
  serie: SeriePontoConta[]
}

/** Barras Remunerado/Realizado por mês + linha do Gap (REAL-REMUN), com pontos verdes/vermelhos. */
export function EvolucaoChart({ serie }: EvolucaoChartProps) {
  if (serie.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Nenhum dado disponível para esse período.
      </div>
    )
  }

  const { axis, legend, cursor } = getChartColors()
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={serie} margin={{ top: 36, right: 16, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="mes"
            tickFormatter={m => MES_ABREV[m] ?? m}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke={axis}
            tick={{ fill: axis, fontSize: 12, fontWeight: 500 }}
          />
          <YAxis 
            tick={{ fill: axis, fontSize: 11, fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCurrencyCompact(v)}
            width={50}
          />
          <Tooltip content={<TooltipEvolucao />} cursor={{ fill: cursor }} />
          <Legend 
            verticalAlign="top" 
            align="right" 
            iconType="circle" 
            wrapperStyle={{ 
              fontSize: 12, 
              color: legend,
              fontWeight: 500,
              paddingBottom: 8
            }} 
          />
          <Bar dataKey="remunerado" name="Remunerado" fill={COR_META} radius={[4, 4, 0, 0]} barSize={32} />
          <Bar dataKey="realizado" name="Realizado" fill={COR_AVR} radius={[4, 4, 0, 0]} barSize={32} />
          <Line
            type="monotone"
            dataKey="gap"
            name="Gap"
            stroke="#9ca3af"
            strokeWidth={2}
            dot={<GapDot />}
            label={<GapLabel />}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}