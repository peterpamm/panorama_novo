import { Card } from '@/components/ui/card'
import { cn, formatCurrencyCompact, formatPercent, formatPercentSigned } from '@/lib/utils'
import type { Semaforo, SeriePontoMensal } from '@/lib/farol-calculations'
import { IndicadorChart } from '@/components/farol/IndicadorChart'

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
  nome: string
  periodoTexto: string
  avr: number
  meta: number | null
  impacto: number
  semaforo: Semaforo
  serie: SeriePontoMensal[]
  codigo: string
}

export function MetaCard({ nome, periodoTexto, avr, meta, impacto, semaforo, serie, codigo }: MetaCardProps) {
  const corImpacto = meta === null ? 'semCor' : impacto >= 0 ? 'positivo' : 'negativo'

  return (
    <Card className={cn('border-l-4 p-4', BORDA[semaforo.corClasse])}>
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        {nome}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-medium text-gray-500">
          {periodoTexto}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-2xl font-bold text-gray-900">{formatPercent(avr, 2)}</span>
        <span className={cn('text-lg font-semibold', TEXTO[corImpacto])}>
          {meta === null ? 'R$ 0' : formatCurrencyCompact(impacto)}
        </span>
      </div>
      <div className="mt-3 flex justify-between border-t pt-3 text-sm text-gray-500">
        <span>Meta: {meta === null ? 'N/A' : formatPercent(meta, 2)}</span>
        <span className={cn('font-medium', TEXTO[semaforo.corClasse])}>
          {semaforo.delta === null ? 'N/A' : formatPercentSigned(semaforo.delta)}
        </span>
      </div>
      <div className="-mx-1 mt-2 border-t pt-1">
        <IndicadorChart serie={serie} gradientId={`grad-${codigo}`} />
      </div>
    </Card>
  )
}
