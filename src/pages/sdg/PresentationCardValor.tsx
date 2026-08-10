import { cn, formatCurrencyInteiro } from '@/lib/utils'

interface PresentationCardValorProps {
  nome: string
  periodo: string
  /** Valor em R$ do período; null = sem dado. Positivo = bom (recuperação), negativo = perda. */
  valor: number | null
  /** Valor do mesmo período no ano anterior, para comparação; null = sem dado. */
  valorAnoAnterior: number | null
  anoAnterior: number
  /**
   * Orçado (Metas de Perdas, `metas_perdas_indicadores.meta_anual`/12) do
   * mesmo período — mesma escala/sinal de `valor` (soma da diferença do DRE),
   * então a comparação é uma subtração direta, igual à do ano anterior.
   * Omitir a prop inteira quando o indicador não tem orçamento próprio (ex:
   * contas filhas de Vales) — diferente de passar `null`, que mostra "N/A".
   */
  orcado?: number | null
  className?: string
}

const COR = {
  positivo: { borda: 'border-emerald-500', texto: 'text-emerald-600 dark:text-emerald-400' },
  negativo: { borda: 'border-red-500',     texto: 'text-red-600 dark:text-red-400'         },
  semCor:   { borda: 'border-gray-300 dark:border-slate-600', texto: 'text-gray-500 dark:text-slate-400' },
}

/** Card grande de indicador em R$ (perdas): colore pelo sinal e compara com o ano anterior (e, quando informado, com o orçado). */
export function PresentationCardValor({ nome, periodo, valor, valorAnoAnterior, anoAnterior, orcado, className }: PresentationCardValorProps) {
  const cor = valor === null ? COR.semCor : valor >= 0 ? COR.positivo : COR.negativo
  const delta = valor !== null && valorAnoAnterior !== null ? valor - valorAnoAnterior : null
  const deltaOrcado = valor !== null && orcado !== null && orcado !== undefined ? valor - orcado : null

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
          {valor === null ? '—' : formatCurrencyInteiro(valor)}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-gray-200 dark:border-slate-700 pt-3 text-sm">
        <div className="flex items-center justify-between">
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
        {orcado !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-slate-400">
              Orçado:{' '}
              <span className="font-medium text-gray-800 dark:text-slate-200">
                {orcado === null ? 'N/A' : formatCurrencyInteiro(orcado)}
              </span>
            </span>
            {deltaOrcado !== null && (
              <span className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                deltaOrcado >= 0
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
              )}>
                {deltaOrcado >= 0 ? '+' : '−'}{formatCurrencyInteiro(Math.abs(deltaOrcado))}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
