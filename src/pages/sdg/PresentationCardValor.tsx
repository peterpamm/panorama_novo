import { cn, formatCurrencyInteiro } from '@/lib/utils'

interface PresentationCardValorProps {
  nome: string
  periodo: string
  /** Valor em R$ do período; null = sem dado. Positivo = bom (recuperação), negativo = perda. */
  valor: number | null
  /** Valor do mesmo período no ano anterior, para comparação; null = sem dado. */
  valorAnoAnterior: number | null
  anoAnterior: number
  className?: string
}

const COR = {
  positivo: { borda: 'border-emerald-500', texto: 'text-emerald-600 dark:text-emerald-400' },
  negativo: { borda: 'border-red-500',     texto: 'text-red-600 dark:text-red-400'         },
  semCor:   { borda: 'border-gray-300 dark:border-slate-600', texto: 'text-gray-500 dark:text-slate-400' },
}

/** Card grande de indicador em R$ (perdas): colore pelo sinal e compara com o ano anterior. */
export function PresentationCardValor({ nome, periodo, valor, valorAnoAnterior, anoAnterior, className }: PresentationCardValorProps) {
  const cor = valor === null ? COR.semCor : valor >= 0 ? COR.positivo : COR.negativo
  const delta = valor !== null && valorAnoAnterior !== null ? valor - valorAnoAnterior : null

  return (
    <div className={cn(
      'flex flex-col justify-between rounded-2xl border-l-4 bg-white shadow-md dark:bg-slate-800/60 p-6 dark:backdrop-blur-sm',
      cor.borda, className,
    )}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold text-gray-800 dark:text-slate-200">{nome}</span>
        <span className="rounded-full bg-gray-100 dark:bg-slate-700 px-3 py-0.5 text-xs font-medium text-gray-600 dark:text-slate-300 whitespace-nowrap">
          {periodo}
        </span>
      </div>

      <div className="mt-4">
        <div className={cn('text-5xl font-bold tracking-tight', cor.texto)}>
          {valor === null ? '—' : formatCurrencyInteiro(valor)}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-200 dark:border-slate-700 pt-4 text-sm">
        <span className="text-gray-500 dark:text-slate-400">
          {anoAnterior}:{' '}
          <span className="font-medium text-gray-800 dark:text-slate-200">
            {valorAnoAnterior === null ? 'N/A' : formatCurrencyInteiro(valorAnoAnterior)}
          </span>
        </span>
        {delta !== null && (
          <span className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
            delta >= 0
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
              : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
          )}>
            {delta >= 0 ? '+' : '−'}{formatCurrencyInteiro(Math.abs(delta))}
          </span>
        )}
      </div>
    </div>
  )
}
