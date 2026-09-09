import { useState } from 'react'
import { Info } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { INDICADOR_EXPLICACOES } from '@/lib/indicador-explicacoes'
import { cn } from '@/lib/utils'

interface IndicadorInfoButtonProps {
  /** Mesmo id usado em PACOTES/RV_*_DRE (ex: '233' = EBITDA) — busca a explicação em INDICADOR_EXPLICACOES. */
  codigo: string
  className?: string
}

/**
 * Botão "ⓘ" que abre uma explicação visual de um indicador — o que é, a
 * fórmula (com o código da conta do DRE de cada etapa, quando existe uma
 * conta específica) e como o AVR (%) é calculado. Só aparece quando o
 * indicador tem entrada cadastrada em `indicador-explicacoes.ts` — cadastro
 * incremental, sem botão apontando pra explicação vazia.
 */
export function IndicadorInfoButton({ codigo, className }: IndicadorInfoButtonProps) {
  const explicacao = INDICADOR_EXPLICACOES[codigo]
  const [aberto, setAberto] = useState(false)
  if (!explicacao) return null

  return (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setAberto(true) }}
        aria-label={`O que é ${explicacao.titulo}`}
        title={`O que é ${explicacao.titulo}`}
        className={cn(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400',
          className,
        )}
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{explicacao.titulo}</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">{explicacao.resumo}</p>

          <div className="space-y-1.5 rounded-xl border bg-muted/30 p-4">
            {explicacao.formula.map((etapa, i) => (
              <div key={i} className="flex items-center gap-3">
                {i === 0 ? (
                  <span className="w-6 shrink-0" />
                ) : (
                  <span className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    etapa.operador === '='
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : etapa.operador === '+'
                        ? 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                        : 'bg-red-500/15 text-red-600 dark:text-red-400',
                  )}>
                    {etapa.operador}
                  </span>
                )}
                <div className={cn(
                  'flex flex-1 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm',
                  etapa.operador === '=' ? 'border-emerald-500/30 bg-emerald-500/5 font-semibold text-emerald-700 dark:text-emerald-400' : 'bg-card',
                )}>
                  <span>{etapa.rotulo}</span>
                  {etapa.codigo && (
                    <span className="shrink-0 rounded-md bg-blue-500/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                      linha {etapa.codigo}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {explicacao.notaFormula && (
            <p className="text-xs text-muted-foreground">{explicacao.notaFormula}</p>
          )}

          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Como o AVR (%) é calculado</p>
            <p className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
              {explicacao.formulaAvr}
            </p>
            <p className="whitespace-pre-line text-sm text-foreground">{explicacao.comoAvrEhCalculado}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
