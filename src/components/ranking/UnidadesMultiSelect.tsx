import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

interface Opcao {
  codigo: string
  nome: string
}

interface UnidadesMultiSelectProps {
  opcoes: Opcao[]
  selecionadas: Set<string>
  onToggle: (codigo: string) => void
  onSelecionarTodas: () => void
  onLimpar: () => void
  /** Classes extras do botão (ex: estilo translúcido pro bloco de filtros navy). */
  className?: string
}

/** Dropdown com checkbox por unidade (não fecha ao marcar, pra selecionar várias de uma vez). */
export function UnidadesMultiSelect({ opcoes, selecionadas, onToggle, onSelecionarTodas, onLimpar, className }: UnidadesMultiSelectProps) {
  const [open, setOpen] = useState(false)

  const label = selecionadas.size === 0
    ? 'Nenhuma unidade selecionada'
    : selecionadas.size === opcoes.length
      ? 'Todas as unidades'
      : `${selecionadas.size} unidade${selecionadas.size > 1 ? 's' : ''} selecionada${selecionadas.size > 1 ? 's' : ''}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn('w-full justify-between font-normal', className)}>
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar unidade..." />
          <CommandList>
            <CommandEmpty>Nenhuma unidade encontrada.</CommandEmpty>
            <CommandGroup>
              {opcoes.map(opcao => (
                <CommandItem key={opcao.codigo} value={opcao.nome} onSelect={() => onToggle(opcao.codigo)}>
                  <Check className={cn('mr-2 h-4 w-4', selecionadas.has(opcao.codigo) ? 'opacity-100' : 'opacity-0')} />
                  {opcao.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex justify-between border-t p-2">
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onSelecionarTodas}>
            Selecionar todas
          </Button>
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onLimpar}>
            Limpar seleção
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
