import { Card } from '@/components/ui/card'
import { cn, formatCurrencyCompact, formatPercentSigned } from '@/lib/utils'
import { corClasseGap, type ResumoConta } from '@/lib/analise-conta-calculations'

const BORDA = { positivo: 'border-l-farol-positivo', negativo: 'border-l-farol-negativo' } as const
const TEXTO = { positivo: 'text-farol-positivo', negativo: 'text-farol-negativo' } as const

interface ResumoCardsProps {
  resumo: ResumoConta
}

export function ResumoCards({ resumo }: ResumoCardsProps) {
  const corGap = corClasseGap(resumo.gap)

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="p-4">
        <div className="text-sm font-semibold text-foreground">Remunerado</div>
        <div className="mt-2 text-2xl font-bold text-foreground">{formatCurrencyCompact(resumo.remunerado)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {resumo.variacaoRemun === null ? 'Sem dado do ano anterior' : `${formatPercentSigned(resumo.variacaoRemun, 1)} vs. ano anterior`}
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold text-foreground">Realizado</div>
        <div className="mt-2 text-2xl font-bold text-foreground">{formatCurrencyCompact(resumo.realizado)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {resumo.variacaoReal === null ? 'Sem dado do ano anterior' : `${formatPercentSigned(resumo.variacaoReal, 1)} vs. ano anterior`}
        </div>
      </Card>

      <Card className={cn('border-l-4 p-4', BORDA[corGap])}>
        <div className="text-sm font-semibold text-foreground">Gap (Realizado − Remunerado)</div>
        <div className={cn('mt-2 text-2xl font-bold', TEXTO[corGap])}>{formatCurrencyCompact(resumo.gap)}</div>
        <div className="mt-1 text-xs text-muted-foreground">{formatPercentSigned(resumo.gapPercent, 1)} do remunerado</div>
      </Card>
    </div>
  )
}
