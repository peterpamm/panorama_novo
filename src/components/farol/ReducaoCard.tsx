import { Card } from '@/components/ui/card'
import { cn, formatCurrencyCompact, formatPercentSigned } from '@/lib/utils'
import type { ReducaoCustosResultado } from '@/lib/farol-calculations'

const BORDA: Record<ReducaoCustosResultado['corClasse'], string> = {
  positivo: 'border-l-farol-positivo',
  atencao: 'border-l-farol-atencao',
  negativo: 'border-l-farol-negativo',
}

const TEXTO: Record<ReducaoCustosResultado['corClasse'], string> = {
  positivo: 'text-farol-positivo',
  atencao: 'text-farol-atencao',
  negativo: 'text-farol-negativo',
}

const STATUS_LABEL: Record<ReducaoCustosResultado['status'], string> = {
  meta_atingida: 'Meta atingida',
  reduziu_nao_bateu: 'Reduziu, mas não bateu meta',
  aumentou: 'Aumentou custo',
}

interface ReducaoCardProps {
  nome: string
  periodoTexto: string
  resultado: ReducaoCustosResultado
}

export function ReducaoCard({ nome, periodoTexto, resultado }: ReducaoCardProps) {
  return (
    <Card className={cn('border-l-4 p-4', BORDA[resultado.corClasse])}>
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        {nome}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-medium text-gray-500">
          {periodoTexto}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-2xl font-bold text-gray-900">{formatCurrencyCompact(resultado.realAtual)}</span>
        <span className={cn('text-lg font-semibold', TEXTO[resultado.corClasse])}>
          {formatPercentSigned(resultado.variacaoPct, 1)}
        </span>
      </div>
      <div className="mt-3 flex justify-between border-t pt-3 text-sm text-gray-500">
        <span>Ano ant: {formatCurrencyCompact(resultado.realAnterior)}</span>
        <span>Meta (-15%): {formatCurrencyCompact(resultado.metaValor)}</span>
      </div>
      <div className={cn('mt-1 text-xs font-medium', TEXTO[resultado.corClasse])}>
        {STATUS_LABEL[resultado.status]}
      </div>
    </Card>
  )
}
