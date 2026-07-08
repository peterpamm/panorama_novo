import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

interface Opcao {
  value: string
  label: string
}

interface FarolFiltersProps {
  unidades: Opcao[]
  negocios: Opcao[]
  anos: number[]
  meses: number[]
  selUnidade: string
  selNegocio: string
  selAno: number
  selMes: number
  isYtd: boolean
  onUnidadeChange: (v: string) => void
  onNegocioChange: (v: string) => void
  onAnoChange: (v: number) => void
  onMesChange: (v: number) => void
  onModoChange: (isYtd: boolean) => void
}

export function FarolFilters({
  unidades, negocios, anos, meses,
  selUnidade, selNegocio, selAno, selMes, isYtd,
  onUnidadeChange, onNegocioChange, onAnoChange, onMesChange, onModoChange,
}: FarolFiltersProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Unidade</Label>
          <Select value={selUnidade} onValueChange={onUnidadeChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {unidades.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Negócio</Label>
          <Select value={selNegocio} onValueChange={onNegocioChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {negocios.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Select value={String(selAno)} onValueChange={v => onAnoChange(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mês</Label>
          <Select value={String(selMes)} onValueChange={v => onMesChange(Number(v))} disabled={isYtd}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {meses.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <RadioGroup
        className="flex gap-6"
        value={isYtd ? 'YTD' : 'Mensal'}
        onValueChange={v => onModoChange(v === 'YTD')}
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="Mensal" id="modo-mensal" />
          <Label htmlFor="modo-mensal">Mensal</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="YTD" id="modo-ytd" />
          <Label htmlFor="modo-ytd">YTD (acumulado do ano)</Label>
        </div>
      </RadioGroup>
    </div>
  )
}
