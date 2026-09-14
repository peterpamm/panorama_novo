import { Bar, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getChartColors } from '@/components/farol/chart-shared'
import { formatCurrencyParenteses, formatPercent } from '@/lib/utils'
import type { LinhaPareto } from '@/lib/pareto-calculations'

const COR_BARRA = '#4f46e5'
const COR_LINHA_ACUMULADA = '#eab308'
const COR_80 = '#9C1B1E'

interface TooltipParetoProps {
  active?: boolean
  payload?: { payload: LinhaPareto & { label: string } }[]
}

function TooltipPareto({ active, payload }: TooltipParetoProps) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
      <p className="mb-1.5 font-semibold">{p.label}</p>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: COR_BARRA }} />
        Realizado: <span className="font-medium text-popover-foreground">{formatCurrencyParenteses(p.realizado)}</span>
        {' '}({formatPercent(p.percentualDoTotal, 1)})
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: COR_LINHA_ACUMULADA }} />
        Acumulado: <span className="font-medium text-popover-foreground">{formatPercent(p.percentualAcumulado, 1)}</span>
      </p>
    </div>
  )
}

interface ParetoChartProps {
  linhas: LinhaPareto[]
  /** Rótulo de cada código (nome da conta ou da unidade) — sem entrada, mostra o próprio código. */
  nomesPorCodigo?: Map<string, string>
}

/**
 * Gráfico de Pareto: barras de REALIZADO (eixo esquerdo, R$) + linha de %
 * acumulado (eixo direito, 0-100%), com referência nos 80% — destaca quais
 * contas/unidades concentram a maior parte do custo. `linhas` já vem
 * ordenada (maior realizado primeiro) e com os percentuais calculados por
 * `calcularParetoContas`/`calcularParetoUnidades` (pareto-calculations.ts).
 */
export function ParetoChart({ linhas, nomesPorCodigo }: ParetoChartProps) {
  const { axis, legend, grid } = getChartColors()

  if (linhas.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        Sem contas com movimento nesse período.
      </div>
    )
  }

  const dados = linhas.map(l => ({ ...l, label: nomesPorCodigo?.get(l.codigo) ?? l.codigo }))

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 16, right: 24, bottom: 48, left: 8 }}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke={axis}
            angle={-30}
            textAnchor="end"
            interval={0}
            height={64}
          />
          <YAxis
            yAxisId="valor"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke={axis}
            tickFormatter={v => formatCurrencyParenteses(v)}
            width={90}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke={axis}
            tickFormatter={v => `${v}%`}
            width={44}
          />
          <Tooltip content={<TooltipPareto />} cursor={{ fill: 'transparent' }} />
          <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 12, color: legend }} />
          <ReferenceLine yAxisId="pct" y={80} stroke={COR_80} strokeDasharray="4 4" label={{ value: '80%', position: 'insideTopRight', fontSize: 11, fill: COR_80 }} />
          <Bar yAxisId="valor" dataKey="realizado" name="Realizado" fill={COR_BARRA} radius={[4, 4, 0, 0]} barSize={28} />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="percentualAcumulado"
            name="% Acumulado"
            stroke={COR_LINHA_ACUMULADA}
            strokeWidth={2.5}
            dot={{ r: 3, fill: COR_LINHA_ACUMULADA, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-[0.65rem] text-muted-foreground" style={{ borderTop: `1px solid ${grid}` }}>
        Ordenado do maior pro menor realizado — linha amarela é o % acumulado, referência vermelha nos 80%.
      </p>
    </div>
  )
}
