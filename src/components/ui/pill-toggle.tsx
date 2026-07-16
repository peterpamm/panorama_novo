import { cn } from '@/lib/utils'

interface PillToggleProps<T extends string> {
  opcoes: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
  /** 'claro' pro conteúdo normal da página; 'navy' pra dentro do bloco de filtros gradiente. */
  variant?: 'claro' | 'navy'
}

/**
 * Toggle de pílula do design system (mesmo visual das TabsList do painel):
 * trilho translúcido, opção ativa branca com sombra. Substituto padrão
 * dos radio buttons em pares de opções (Mensal/YTD, Remunerado/Realizado etc).
 */
export function PillToggle<T extends string>({ opcoes, value, onChange, className, variant = 'claro' }: PillToggleProps<T>) {
  const navy = variant === 'navy'
  return (
    <div
      className={cn(
        'inline-flex h-10 items-center rounded-xl p-1',
        navy ? 'bg-white/10' : 'bg-gray-200/70 dark:bg-gray-700/70',
        className,
      )}
    >
      {opcoes.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 rounded-lg px-4 text-sm font-medium transition-all duration-200 whitespace-nowrap',
            value === o.value
              ? (navy
                ? 'bg-white text-gray-900 shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md')
              : (navy
                ? 'text-white/60 hover:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'),
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
