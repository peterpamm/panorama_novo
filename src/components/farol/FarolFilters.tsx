import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Opcao {
  value: string
  label: string
}

/** Período do Farol: mês selecionado, acumulado do ano (YTD), 1º ou 2º semestre. */
export type PeriodoFarol = 'mensal' | 'ytd' | 's1' | 's2'

interface FarolFiltersProps {
  unidades: Opcao[]
  negocios: Opcao[]
  anos: number[]
  meses: number[]
  selUnidade: string
  selNegocio: string
  selAno: number
  selMes: number
  periodo: PeriodoFarol
  onUnidadeChange: (v: string) => void
  onNegocioChange: (v: string) => void
  onAnoChange: (v: number) => void
  onMesChange: (v: number) => void
  onPeriodoChange: (p: PeriodoFarol) => void
}

/** Label do bloco de filtros — texto claro sobre o gradiente navy (token filter-label do design system). */
export function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/60">
      {children}
    </span>
  )
}

/** SelectTrigger translúcido pra usar sobre o gradiente navy do bloco de filtros. */
export const filterTriggerClass = 'bg-white/10 border-white/20 text-white hover:bg-white/20 focus:ring-white/30'

const triggerClass = filterTriggerClass

export function FarolFilters({
  unidades, negocios, anos, meses,
  selUnidade, selNegocio, selAno, selMes, periodo,
  onUnidadeChange, onNegocioChange, onAnoChange, onMesChange, onPeriodoChange,
}: FarolFiltersProps) {
  const isYtd = periodo !== 'mensal'
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <FilterLabel>Unidade</FilterLabel>
          <Select value={selUnidade} onValueChange={onUnidadeChange}>
            <SelectTrigger className={triggerClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {unidades.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FilterLabel>Negócio</FilterLabel>
          <Select value={selNegocio} onValueChange={onNegocioChange}>
            <SelectTrigger className={triggerClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {negocios.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FilterLabel>Ano</FilterLabel>
          <Select value={String(selAno)} onValueChange={v => onAnoChange(Number(v))}>
            <SelectTrigger className={triggerClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FilterLabel>Mês</FilterLabel>
          <Select value={String(selMes)} onValueChange={v => onMesChange(Number(v))} disabled={isYtd}>
            <SelectTrigger className={cn(triggerClass, isYtd && 'opacity-50')}><SelectValue /></SelectTrigger>
            <SelectContent>
              {meses.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Toggle Mensal / YTD / 1º Semestre */}
      <div className="space-y-1.5">
        <FilterLabel>Período</FilterLabel>
        <div className="flex h-10 items-center rounded-lg bg-white/10 p-1">
          {([
            { id: 'mensal', label: 'Mensal', title: 'Mês selecionado' },
            { id: 'ytd',    label: 'YTD',    title: 'Acumulado do ano' },
            { id: 's1',     label: '1º Sem', title: 'Acumulado Jan–Jun vs meta do 1º semestre' },
            { id: 's2',     label: '2º Sem', title: 'Acumulado Jul–Dez vs meta do 2º semestre' },
          ] as const).map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => onPeriodoChange(o.id)}
              title={o.title}
              className={cn(
                'h-8 rounded-md px-4 text-sm font-medium transition-all whitespace-nowrap',
                periodo === o.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-white/60 hover:text-white',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
