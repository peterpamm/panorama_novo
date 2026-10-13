import type { ReactNode } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ColunaOrdenavelProps<T extends string> {
  coluna: T
  colunaAtual: T
  onClick: (coluna: T) => void
  className?: string
  children: ReactNode
}

/** Cabeçalho de coluna clicável pra ordenar — mesmo padrão `ArrowUpDown`/opacidade de `PacoteDeGenteCorporativo.tsx`, reaproveitado pelas tabelas de Acompanhamento e Dashboard do Limpa Pauta. */
export function ColunaOrdenavel<T extends string>({ coluna, colunaAtual, onClick, className, children }: ColunaOrdenavelProps<T>) {
  return (
    <button type="button" onClick={() => onClick(coluna)} className={cn('inline-flex items-center gap-1 hover:opacity-80', className)}>
      {children}
      <ArrowUpDown className={cn('h-3 w-3', colunaAtual === coluna ? 'opacity-100' : 'opacity-50')} />
    </button>
  )
}
