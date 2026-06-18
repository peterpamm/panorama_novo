import { Card } from '@/components/ui/card'
import { cn, formatCurrencyCompact } from '@/lib/utils'
import type { EstouroZeroResultado } from '@/lib/farol-calculations'

interface EstouroZeroCardProps {
  nome: string
  periodoTexto: string
  resultado: EstouroZeroResultado
}

export function EstouroZeroCard({ nome, periodoTexto, resultado }: EstouroZeroCardProps) {
  const positivo = resultado.impacto >= 0

  return (
    <Card className={cn('border-l-4 p-4', positivo ? 'border-l-farol-positivo' : 'border-l-farol-negativo')}>
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        {nome}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-medium text-gray-500">
          {periodoTexto}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-2xl font-bold text-gray-900">{formatCurrencyCompact(resultado.real)}</span>
        <span className={cn('text-lg font-semibold', positivo ? 'text-farol-positivo' : 'text-farol-negativo')}>
          {formatCurrencyCompact(resultado.impacto)}
        </span>
      </div>
      <div className="mt-3 border-t pt-3 text-sm text-gray-500">
        Remunerado: {formatCurrencyCompact(resultado.remun)}
      </div>
    </Card>
  )
}
