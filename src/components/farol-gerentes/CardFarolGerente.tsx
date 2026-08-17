import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, Circle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LinhaFarolGerente } from '@/lib/farol-gerentes'

export interface SecaoFarolGerente {
  titulo: string
  icone: LucideIcon
  linhas: LinhaFarolGerente[]
}

function StatusIcone({ status }: { status: LinhaFarolGerente['status'] }) {
  if (status === 'bateu') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (status === 'perdeu') return <XCircle className="h-4 w-4 text-red-500" />
  return <Circle className="h-4 w-4 text-muted-foreground/40" />
}

function LinhaIndicador({ linha }: { linha: LinhaFarolGerente }) {
  return (
    <div className="grid grid-cols-[1fr_3.5rem_3.5rem_1.5rem] items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-sm transition-colors hover:bg-muted/50">
      <span className="truncate font-medium text-foreground">{linha.indicador}</span>
      <span className="text-center text-xs tabular-nums text-muted-foreground">{linha.meta}</span>
      <span className="text-center text-xs font-semibold tabular-nums text-foreground">{linha.real}</span>
      <span className="flex justify-center"><StatusIcone status={linha.status} /></span>
    </div>
  )
}

function Secao({ titulo, icone: Icone, linhas }: SecaoFarolGerente) {
  if (linhas.length === 0) return null
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icone className="h-3.5 w-3.5" />
        {titulo}
      </div>
      <div className="grid grid-cols-[1fr_3.5rem_3.5rem_1.5rem] gap-2 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
        <span>Indicador</span>
        <span className="text-center">Meta</span>
        <span className="text-center">Real</span>
        <span />
      </div>
      <div className="space-y-1">
        {linhas.map((l, i) => <LinhaIndicador key={`${l.indicador}-${i}`} linha={l} />)}
      </div>
    </div>
  )
}

interface CardFarolGerenteProps {
  titulo: string
  subtitulo?: string
  /** Card especial (AMBEV/corporativo) — acento roxo e leve gradiente, igual o resto do design system pra destaque de "consolidado". */
  destaque?: boolean
  secoes: SecaoFarolGerente[]
}

/**
 * Card de uma unidade (ou o card corporativo consolidado) do Farol
 * Gerentes — 1 ou 2 seções lado a lado (Semestre/Anual), cada uma com suas
 * linhas de indicador (Indicador · Meta · Real · Status).
 */
export function CardFarolGerente({ titulo, subtitulo, destaque, secoes }: CardFarolGerenteProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl',
        destaque
          ? 'border-violet-300/40 bg-gradient-to-br from-white/80 to-violet-50/60 shadow-violet-200/20 dark:border-violet-500/20 dark:from-gray-800/60 dark:to-violet-950/30 dark:shadow-black/20'
          : 'border-gray-200/30 bg-white/60 shadow-gray-200/20 dark:border-gray-700/30 dark:bg-gray-800/60 dark:shadow-black/20',
      )}
    >
      <div className="mb-4">
        <h3 className={cn('text-base font-bold', destaque ? 'text-violet-700 dark:text-violet-300' : 'text-foreground')}>
          {titulo}
        </h3>
        {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
      </div>
      <div className={cn('grid gap-5', secoes.filter(s => s.linhas.length > 0).length > 1 && 'sm:grid-cols-2')}>
        {secoes.map(s => <Secao key={s.titulo} {...s} />)}
      </div>
    </div>
  )
}
