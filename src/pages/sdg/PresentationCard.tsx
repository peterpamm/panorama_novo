import { cn, formatCurrencyCompact, formatPercent, formatPercentSigned } from '@/lib/utils'
import type { Semaforo } from '@/lib/farol-calculations'

const COR: Record<Semaforo['corClasse'], { borda: string; texto: string; badge: string }> = {
  positivo: { borda: 'border-emerald-500', texto: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
  negativo: { borda: 'border-red-500',     texto: 'text-red-600 dark:text-red-400',         badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'               },
  semCor:   { borda: 'border-gray-300 dark:border-slate-600', texto: 'text-gray-500 dark:text-slate-400', badge: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300' },
}

interface PresentationCardProps {
  nome: string
  periodo: string
  avr: number
  meta: number | null
  impacto: number
  semaforo: Semaforo
  className?: string
}

export function PresentationCard({ nome, periodo, avr, meta, impacto, semaforo, className }: PresentationCardProps) {
  const cor = COR[semaforo.corClasse]
  const corImpacto = meta === null ? 'semCor' : impacto >= 0 ? 'positivo' : 'negativo'

  return (
    <div className={cn(
      'flex flex-col justify-between rounded-2xl border-l-4 bg-white shadow-md dark:bg-slate-800/60 p-4 dark:backdrop-blur-sm',
      cor.borda, className,
    )}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">{nome}</span>
        <span className="rounded-full bg-gray-100 dark:bg-slate-700 px-3 py-0.5 text-xs font-medium text-gray-600 dark:text-slate-300 whitespace-nowrap">
          {periodo}
        </span>
      </div>

      <div className="mt-3">
        <div className={cn('text-4xl font-bold tracking-tight', cor.texto)}>
          {formatPercent(avr, 2)}
        </div>
        <div className={cn('mt-1 text-xl font-semibold', COR[corImpacto].texto)}>
          {meta === null ? '—' : formatCurrencyCompact(impacto)}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-gray-200 dark:border-slate-700 pt-3 text-sm">
        <span className="text-gray-500 dark:text-slate-400">
          Meta: <span className="font-medium text-gray-800 dark:text-slate-200">{meta === null ? 'N/A' : formatPercent(meta, 2)}</span>
        </span>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', cor.badge)}>
          {semaforo.delta === null ? 'N/A' : formatPercentSigned(semaforo.delta)}
        </span>
      </div>
    </div>
  )
}
