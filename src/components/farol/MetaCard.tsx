import { Card } from '@/components/ui/card'
import { IndicadorInfoButton } from '@/components/farol/IndicadorInfoButton'
import { cn, formatCurrencyInteiro, formatPercent, formatPercentSigned } from '@/lib/utils'
import type { Semaforo } from '@/lib/farol-calculations'

const BORDA: Record<Semaforo['corClasse'], string> = {
  positivo: 'border-l-farol-positivo',
  negativo: 'border-l-farol-negativo',
  semCor: 'border-l-farol-neutro',
}

const TEXTO: Record<Semaforo['corClasse'], string> = {
  positivo: 'text-farol-positivo',
  negativo: 'text-farol-negativo',
  semCor: 'text-farol-neutro',
}

interface MetaCardProps {
  /** Id do pacote (mesma chave de PACOTES) — usado só pro botão de info achar a explicação em indicador-explicacoes.ts. */
  codigo: string
  nome: string
  periodoTexto: string
  avr: number
  meta: number | null
  impacto: number
  semaforo: Semaforo
}

export function MetaCard({ codigo, nome, periodoTexto, avr, meta, impacto, semaforo }: MetaCardProps) {
  const corImpacto = meta === null ? 'semCor' : impacto >= 0 ? 'positivo' : 'negativo'

  return (
    <Card className={cn('border-l-4 p-4', BORDA[semaforo.corClasse])}>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {nome}
        <IndicadorInfoButton codigo={codigo} />
        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
          {periodoTexto}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-2xl font-bold text-foreground">{formatPercent(avr, 2)}</span>
        <span className={cn('text-lg font-semibold', TEXTO[corImpacto])}>
          {meta === null ? 'R$ 0' : formatCurrencyInteiro(impacto)}
        </span>
      </div>
      <div className="mt-3 flex justify-between border-t pt-3 text-sm text-muted-foreground">
        <span>Meta: {meta === null ? 'N/A' : formatPercent(meta, 2)}</span>
        <span className={cn('font-medium', TEXTO[semaforo.corClasse])}>
          {semaforo.delta === null ? 'N/A' : formatPercentSigned(semaforo.delta)}
        </span>
      </div>
    </Card>
  )
}
