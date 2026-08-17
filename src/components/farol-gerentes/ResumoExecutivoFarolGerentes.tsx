import type { LucideIcon } from 'lucide-react'
import { BarChart3, CalendarDays, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LinhaResumoFarolGerente {
  unidade: string
  nome: string
  semestreBatidos: number
  semestreTotal: number
  anoBatidos: number
  anoTotal: number
}

interface ItemRanking {
  chave: string
  nome: string
  batidos: number
  total: number
}

const MEDALHAS = ['🥇', '🥈', '🥉']

function corBarra(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

function corBadge(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
  if (pct >= 50) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
  return 'bg-red-500/15 text-red-700 dark:text-red-400'
}

function ListaRanking({ titulo, icone: Icone, corPonto, itens }: {
  titulo: string
  icone: LucideIcon
  corPonto: string
  itens: ItemRanking[]
}) {
  const ordenado = [...itens].sort((a, b) => b.batidos - a.batidos)
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', corPonto)} />
        <Icone className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">{titulo}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">indicadores batidos</span>
      </div>
      <div className="space-y-1">
        {ordenado.map((item, i) => {
          const pct = item.total > 0 ? (item.batidos / item.total) * 100 : 0
          return (
            <div key={item.chave} className="flex items-center gap-2.5 rounded-lg bg-muted/30 px-2.5 py-1.5">
              <span className="w-6 shrink-0 text-center text-sm">
                {i < 3 ? MEDALHAS[i] : <span className="text-xs font-semibold text-muted-foreground">{i + 1}º</span>}
              </span>
              <span className="flex-1 truncate text-sm text-foreground">{item.nome}</span>
              <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums', corBadge(pct))}>
                {item.batidos}/{item.total}
              </span>
              <div className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', corBarra(pct))} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Resumo Executivo — dois rankings lado a lado (Semestre/Anual), cada
 * unidade ordenada por quantos indicadores bateu, com medalha nas 3
 * primeiras. Mesmo painel do Farol Gerentes antigo, sem a AMBEV (ela é o
 * consolidado, não compete no ranking).
 */
export function ResumoExecutivoFarolGerentes({ linhas }: { linhas: LinhaResumoFarolGerente[] }) {
  if (linhas.length === 0) return null

  const semestre = linhas.map(l => ({ chave: l.unidade, nome: l.nome, batidos: l.semestreBatidos, total: l.semestreTotal }))
  const ano = linhas.map(l => ({ chave: l.unidade, nome: l.nome, batidos: l.anoBatidos, total: l.anoTotal }))
  const liderSemestre = [...semestre].sort((a, b) => b.batidos - a.batidos)[0]
  const liderAno = [...ano].sort((a, b) => b.batidos - a.batidos)[0]

  return (
    <div className="rounded-2xl border border-gray-200/30 bg-white/60 p-5 shadow-xl shadow-gray-200/20 backdrop-blur-xl dark:border-gray-700/30 dark:bg-gray-800/60 dark:shadow-black/20 sm:p-6">
      <div className="mb-5 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">Resumo Executivo</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ListaRanking titulo="Semestre" icone={CalendarDays} corPonto="bg-blue-500" itens={semestre} />
        <ListaRanking titulo="Anual" icone={BarChart3} corPonto="bg-violet-500" itens={ano} />
      </div>

      <div className="mt-5 flex flex-col gap-1.5 border-t border-gray-200/50 pt-4 text-xs text-muted-foreground dark:border-gray-700/50 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
          <strong className="text-foreground">{liderSemestre.nome}</strong> lidera no Semestre com {liderSemestre.batidos}/{liderSemestre.total}
        </span>
        <span className="flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
          <strong className="text-foreground">{liderAno.nome}</strong> lidera no Ano com {liderAno.batidos}/{liderAno.total}
        </span>
        <span>Meta: bater ≥70% dos indicadores</span>
      </div>
    </div>
  )
}
