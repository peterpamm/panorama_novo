import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

interface CurvaCapturaToggleProps {
  mostrar: boolean
  onChange: (mostrar: boolean) => void
  /** Prefixo único pros ids dos radios (um gráfico por slide/bloco pode ter mais de uma instância na mesma página). */
  idPrefix: string
}

/** Radio "Meta" / "Curva de Captura" — alterna a linha amarela tracejada extra (ritmo necessário, ver `calcularSerieCaptura`) nos gráficos de Acompanhamento Mensal do SDG Gerentes. */
export function CurvaCapturaToggle({ mostrar, onChange, idPrefix }: CurvaCapturaToggleProps) {
  return (
    <RadioGroup
      className="flex items-center gap-4"
      value={mostrar ? 'curva' : 'meta'}
      onValueChange={v => onChange(v === 'curva')}
    >
      <div className="flex items-center gap-1.5">
        <RadioGroupItem value="meta" id={`${idPrefix}-sem-curva`} className="h-3.5 w-3.5" />
        <Label htmlFor={`${idPrefix}-sem-curva`} className="text-xs font-normal text-muted-foreground">Meta</Label>
      </div>
      <div className="flex items-center gap-1.5">
        <RadioGroupItem value="curva" id={`${idPrefix}-com-curva`} className="h-3.5 w-3.5" />
        <Label htmlFor={`${idPrefix}-com-curva`} className="text-xs font-normal text-muted-foreground">Curva de Captura</Label>
      </div>
    </RadioGroup>
  )
}
