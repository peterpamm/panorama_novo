import { Card } from '@/components/ui/card'
import { IndicadorChart } from '@/components/farol/IndicadorChart'
import type { SeriePontoMensal } from '@/lib/farol-calculations'

interface IndicadorChartCardProps {
  codigo: string
  nome: string
  serie: SeriePontoMensal[]
}

export function IndicadorChartCard({ codigo, nome, serie }: IndicadorChartCardProps) {
  return (
    <Card className="p-4">
      <div className="mb-1 text-sm font-semibold text-gray-700">{nome}</div>
      <IndicadorChart serie={serie} gradientId={`grad-${codigo}`} />
    </Card>
  )
}
