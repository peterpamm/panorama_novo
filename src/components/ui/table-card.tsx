import * as React from 'react'
import { cn } from '@/lib/utils'

interface TableCardProps {
  titulo: React.ReactNode
  subtitulo?: React.ReactNode
  /** Conteúdo à direita do header (botões, selects, contadores). Fica fora de capturas de imagem (data-no-print). */
  acoes?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/**
 * Container padrão de tabelas do painel (design system LOG20, como a tabela
 * "Multas por Unidade" do Painel Multas): card glass com header em gradiente
 * navy — título branco + subtítulo white/60 — e a tabela direto embaixo.
 * Aceita ref no elemento raiz (usado pra "copiar como imagem").
 */
export const TableCard = React.forwardRef<HTMLDivElement, TableCardProps>(
  ({ titulo, subtitulo, acoes, className, children }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-gray-200/30 dark:border-gray-700/30 shadow-xl shadow-gray-200/20 dark:shadow-black/20 overflow-hidden transition-all duration-300',
          className,
        )}
      >
        <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-[hsl(222,45%,20%)] to-[hsl(222,35%,30%)] dark:from-[hsl(224,28%,14%)] dark:to-[hsl(224,22%,20%)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-white">{titulo}</h3>
              {subtitulo && <p className="mt-0.5 truncate text-xs text-white/60">{subtitulo}</p>}
            </div>
            {acoes && <div data-no-print className="flex shrink-0 items-center gap-2">{acoes}</div>}
          </div>
        </div>
        <div className="overflow-x-auto">{children}</div>
      </div>
    )
  },
)
TableCard.displayName = 'TableCard'

/** Botão claro pra usar nas ações do header navy do TableCard (ex: Exportar CSV). */
export const tableCardActionClass =
  'border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white'
