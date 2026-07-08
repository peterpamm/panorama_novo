import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import type { Conta } from '@/types'

interface ContaComboboxProps {
  contas: Conta[]
  value: string
  onChange: (codigo: string) => void
}

export function ContaCombobox({ contas, value, onChange }: ContaComboboxProps) {
  const [open, setOpen] = useState(false)
  const selecionada = contas.find(c => c.codigo === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selecionada ? `${selecionada.codigo} — ${selecionada.descricao}` : 'Selecione uma conta...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por código ou nome..." />
          <CommandList>
            <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
            <CommandGroup>
              {contas.map(conta => (
                <CommandItem
                  key={conta.codigo}
                  value={`${conta.codigo} ${conta.descricao}`}
                  onSelect={() => { onChange(conta.codigo); setOpen(false) }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === conta.codigo ? 'opacity-100' : 'opacity-0')} />
                  <span className="font-mono text-xs text-muted-foreground">{conta.codigo}</span>
                  <span className="ml-2 truncate">{conta.descricao}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
