import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { IndicadorChart } from '@/components/farol/IndicadorChart'
import { CapturaChart } from '@/components/farol/CapturaChart'
import type { SeriePontoCaptura, SeriePontoMensal } from '@/lib/farol-calculations'
import type { Natureza } from '@/types'

export interface IndicadorPainelItem {
  codigo: string
  nome: string
  natureza: Natureza
  serieAnual: SeriePontoMensal[]
  serieCaptura: SeriePontoCaptura[]
}

interface IndicadorPainelProps {
  indicadores: IndicadorPainelItem[]
  ano: number
  /** Nome da série principal na legenda/tooltip dos gráficos — ex: "Realizado" no lugar do default "AVR Realizado". */
  nomeSerie?: string
  /** Nome da linha de meta na curva de captura — ex: "Meta Mensal (méd.)" no lugar do default "Meta Anual". */
  nomeMeta?: string
  /** Como formatar os valores nos gráficos — default percentual (AVR); passe formatCurrencyInteiro pra séries em R$. */
  formatter?: (v: number) => string
  /** Notificado sempre que o indicador selecionado no dropdown muda — pra outro componente (ex: uma tabela abaixo) acompanhar a mesma seleção. */
  onSelecionadoChange?: (codigo: string) => void
}

export function IndicadorPainel({ indicadores, ano, nomeSerie, nomeMeta, formatter, onSelecionadoChange }: IndicadorPainelProps) {
  const [selecionado, setSelecionado] = useState(indicadores[0]?.codigo ?? '')

  useEffect(() => {
    if (indicadores.length > 0 && !indicadores.some(i => i.codigo === selecionado)) {
      setSelecionado(indicadores[0].codigo)
    }
  }, [indicadores, selecionado])

  useEffect(() => {
    if (selecionado) onSelecionadoChange?.(selecionado)
  }, [selecionado, onSelecionadoChange])

  if (indicadores.length === 0) return null
  const atual = indicadores.find(i => i.codigo === selecionado) ?? indicadores[0]

  return (
    <Card className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-foreground">Tendência do indicador</div>
          <div className="text-xs text-muted-foreground">Ano {ano}</div>
        </div>
        <Select value={selecionado} onValueChange={setSelecionado}>
          <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
          <SelectContent>
            {indicadores.map(i => <SelectItem key={i.codigo} value={i.codigo}>{i.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-8">
        <div>
          <div className="mb-2 text-sm font-medium text-muted-foreground">Acompanhamento mensal</div>
          <IndicadorChart serie={atual.serieAnual} gradientId={`grad-mensal-${atual.codigo}`} natureza={atual.natureza} nomeSerie={nomeSerie} formatter={formatter} />
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-muted-foreground">Curva de captura da meta anual</div>
          <CapturaChart serie={atual.serieCaptura} natureza={atual.natureza} nomeSerie={nomeSerie} nomeMeta={nomeMeta} formatter={formatter} />
        </div>
      </div>

      <p className="mt-2 text-right text-[0.65rem] text-muted-foreground">
        <span className="text-green-600">●</span> meta batida &nbsp;
        <span className="text-red-600">●</span> meta não batida
      </p>
    </Card>
  )
}
