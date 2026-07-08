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
  /** Ano anterior sem nenhum ajuste (DRE bruto importado) — só é exibido quando difere de `resultado.realAnterior` (ex: AMBEV com unidades novas, ou a própria unidade nova). */
  realAnteriorBruto?: number
}

export function ReducaoCard({ nome, periodoTexto, resultado, realAnteriorBruto }: ReducaoCardProps) {
  const mostrarBruto = realAnteriorBruto !== undefined && Math.round(realAnteriorBruto) !== Math.round(resultado.realAnterior)

  return (
    <Card className={cn('border-l-4 p-4', BORDA[resultado.corClasse])}>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {nome}
        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
          {periodoTexto}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-2xl font-bold text-foreground">{formatCurrencyCompact(resultado.realAtual)}</span>
        <span className={cn('text-lg font-semibold', TEXTO[resultado.corClasse])}>
          {formatPercentSigned(resultado.variacaoPct, 1)}
        </span>
      </div>
      <div className="mt-3 flex items-start justify-between border-t pt-3 text-sm text-muted-foreground">
        <div className="space-y-0.5">
          {mostrarBruto ? (
            <>
              <div>Ano ant. (DRE): {formatCurrencyCompact(realAnteriorBruto)}</div>
              <div>Ano ant. (ajustado): {formatCurrencyCompact(resultado.realAnterior)}</div>
            </>
          ) : (
            <div>Ano ant: {formatCurrencyCompact(resultado.realAnterior)}</div>
          )}
        </div>
        <span>Meta (-15%): {formatCurrencyCompact(resultado.metaValor)}</span>
      </div>
      <div className={cn('mt-1 text-xs font-medium', TEXTO[resultado.corClasse])}>
        {STATUS_LABEL[resultado.status]}
      </div>
    </Card>
  )
}
