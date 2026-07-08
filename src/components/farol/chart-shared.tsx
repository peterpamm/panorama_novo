import { calcularSemaforo } from '@/lib/farol-calculations'
import { formatPercent } from '@/lib/utils'
import type { Natureza } from '@/types'

export function getChartColors() {
  const isDark = document.documentElement.classList.contains('dark')
  return {
    grid:   isDark ? '#1e2a3a' : '#e2e8f0',
    axis:   isDark ? '#64748b' : '#94a3b8',
    legend: isDark ? '#94a3b8' : '#6b7280',
    dotStroke: isDark ? '#161d2d' : 'white',
  }
}

export const MES_ABREV: Record<number, string> = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
}

export const COR_AVR = '#4f46e5'
export const COR_META = '#94a3b8'
export const COR_POSITIVO = '#16a34a'
export const COR_NEGATIVO = '#dc2626'
export const COR_NECESSARIO = '#f59e0b'

/** Cor do ponto/rótulo conforme a meta foi batida (verde), perdida (vermelho) ou inexistente (indigo neutro). */
export function corPorSemaforo(avr: number, meta: number | null, natureza: Natureza): string {
  if (meta === null) return COR_AVR
  const { corClasse } = calcularSemaforo(avr, meta, natureza)
  if (corClasse === 'positivo') return COR_POSITIVO
  if (corClasse === 'negativo') return COR_NEGATIVO
  return COR_AVR
}

export interface ValorComMeta {
  avr: number | null
  meta: number | null
}

/**
 * Os pontos (dot) e rótulos custom do recharts só recebem cx/cy/x/y/index do
 * próprio recharts — não o resto da linha de dados. Por isso recebem
 * `valores` (a série já normalizada pro formato {avr, meta}, alinhada por
 * índice) em vez de depender do `payload` que o recharts injeta, cujo
 * formato varia entre os gráficos (avr/meta vs avrAcumulado/metaAnual).
 */
interface PontoDotProps {
  cx?: number
  cy?: number
  index?: number
  ultimoIndex: number
  natureza: Natureza
  valores: ValorComMeta[]
}

export function PontoDot({ cx, cy, index, ultimoIndex, natureza, valores }: PontoDotProps) {
  if (cx === undefined || cy === undefined || index === undefined) return null
  const ponto = valores[index]
  if (!ponto || ponto.avr === null) return null
  const atual = index === ultimoIndex
  const cor = corPorSemaforo(ponto.avr, ponto.meta, natureza)
  const { dotStroke } = getChartColors()
  return <circle cx={cx} cy={cy} r={atual ? 6 : 4} fill={cor} stroke={dotStroke} strokeWidth={atual ? 2 : 1.5} />
}

interface PontoLabelProps {
  x?: number
  y?: number
  index?: number
  ultimoIndex: number
  natureza: Natureza
  valores: ValorComMeta[]
  formatter?: (v: number) => string
}

export function PontoLabel({ x, y, index, ultimoIndex, natureza, valores, formatter = v => formatPercent(v, 2) }: PontoLabelProps) {
  if (x === undefined || y === undefined || index === undefined) return null
  const ponto = valores[index]
  if (!ponto || ponto.avr === null) return null
  const atual = index === ultimoIndex
  const cor = corPorSemaforo(ponto.avr, ponto.meta, natureza)
  return (
    <text
      x={x}
      y={y - (atual ? 16 : 12)}
      textAnchor="middle"
      fontSize={atual ? 13 : 11}
      fontWeight={atual ? 700 : 600}
      fill={cor}
    >
      {formatter(ponto.avr)}
    </text>
  )
}

export function TooltipCustom({
  active, payload, label, nomeAvr, dataKeyAvr, dataKeyMeta, formatter = v => formatPercent(v, 2),
}: {
  active?: boolean
  payload?: { value: number; dataKey: string }[]
  label?: number
  nomeAvr: string
  dataKeyAvr: string
  dataKeyMeta: string
  formatter?: (v: number) => string
}) {
  if (!active || !payload || payload.length === 0) return null
  const avr = payload.find(p => p.dataKey === dataKeyAvr)?.value
  const meta = payload.find(p => p.dataKey === dataKeyMeta)?.value
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
      <p className="mb-1.5 font-semibold">{MES_ABREV[label ?? 0] ?? label}</p>
      {avr !== undefined && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: COR_AVR }} />
          {nomeAvr}: <span className="font-medium text-popover-foreground">{formatter(avr)}</span>
        </p>
      )}
      {meta !== undefined && meta !== null && (
        <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full border border-border" style={{ background: COR_META }} />
          Meta: <span className="font-medium text-popover-foreground">{formatter(meta)}</span>
        </p>
      )}
    </div>
  )
}
