import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FilterLabel, filterTriggerClass } from '@/components/farol/FarolFilters'
import { MES_ABREV } from '@/components/farol/chart-shared'
import { cn } from '@/lib/utils'
import { STATUS_LABEL, STATUS_ORDEM, type FiltrosEcValues } from '@/lib/encontro-contas'
import type { EncontroContasMotivo, Unidade } from '@/types'

interface FiltrosEcBarProps {
  valores: FiltrosEcValues
  onChange: (patch: Partial<FiltrosEcValues>) => void
  unidades: Unidade[]
  motivos: EncontroContasMotivo[]
  anos: number[]
  isAdmin: boolean
  mostrarStatus?: boolean
  idCheckbox: string
}

/** Barra de filtros compartilhada por Tratativas e Histórico — mesmo visual/comportamento nas duas abas. */
export function FiltrosEcBar({ valores, onChange, unidades, motivos, anos, isAdmin, mostrarStatus = true, idCheckbox }: FiltrosEcBarProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[hsl(222,45%,20%)] to-[hsl(222,35%,30%)] dark:from-[hsl(224,28%,14%)] dark:to-[hsl(224,22%,20%)] shadow-xl shadow-blue-900/20 overflow-hidden">
      <div className="flex flex-wrap items-end gap-4 p-4 md:p-6">
        {isAdmin && (
          <div className="space-y-1.5">
            <FilterLabel>Unidade</FilterLabel>
            <Select value={valores.unidade} onValueChange={v => onChange({ unidade: v })}>
              <SelectTrigger className={cn('w-44', filterTriggerClass)}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="sem_unidade">Sem unidade</SelectItem>
                {unidades.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {mostrarStatus && (
          <div className="space-y-1.5">
            <FilterLabel>Status</FilterLabel>
            <Select value={valores.status} onValueChange={v => onChange({ status: v })}>
              <SelectTrigger className={cn('w-40', filterTriggerClass)}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {STATUS_ORDEM.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <FilterLabel>Motivo</FilterLabel>
          <Select value={valores.motivo} onValueChange={v => onChange({ motivo: v })}>
            <SelectTrigger className={cn('w-44', filterTriggerClass)}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {motivos.map(m => <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FilterLabel>Buscar motivo</FilterLabel>
          <Input
            value={valores.buscaMotivo}
            onChange={e => onChange({ buscaMotivo: e.target.value })}
            placeholder="Texto livre..."
            className={cn('w-40 placeholder:text-white/40', filterTriggerClass)}
          />
        </div>
        <div className="space-y-1.5">
          <FilterLabel>Ano</FilterLabel>
          <Select value={valores.ano} onValueChange={v => onChange({ ano: v })}>
            <SelectTrigger className={cn('w-28', filterTriggerClass)}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FilterLabel>Mês</FilterLabel>
          <Select value={valores.mes} onValueChange={v => onChange({ mes: v })}>
            <SelectTrigger className={cn('w-32', filterTriggerClass)}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {Object.entries(MES_ABREV).map(([m, label]) => <SelectItem key={m} value={m}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FilterLabel>Nº do chamado</FilterLabel>
          <Input
            value={valores.chamado}
            onChange={e => onChange({ chamado: e.target.value })}
            placeholder="R14602322"
            className={cn('w-36 placeholder:text-white/40', filterTriggerClass)}
          />
        </div>
        <div className="space-y-1.5">
          <FilterLabel>Quem abriu</FilterLabel>
          <Input
            value={valores.solicitante}
            onChange={e => onChange({ solicitante: e.target.value })}
            placeholder="Nome..."
            className={cn('w-44 placeholder:text-white/40', filterTriggerClass)}
          />
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1.5 pb-2">
            <Checkbox id={idCheckbox} checked={valores.validadosPorMim} onCheckedChange={v => onChange({ validadosPorMim: v === true })} />
            <Label htmlFor={idCheckbox} className="cursor-pointer text-sm font-normal text-white">Validados por mim</Label>
          </div>
        )}
      </div>
    </div>
  )
}
