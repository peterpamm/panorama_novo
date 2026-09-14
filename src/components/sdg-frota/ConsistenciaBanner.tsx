import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatCurrencyParenteses, formatPercent } from '@/lib/utils'
import type { ResultadoConsistencia } from '@/lib/consistencia-dre'

export interface ChecagemConsistencia {
  nome: string
  resultado: ResultadoConsistencia
  /** Como formatar valorA/valorB/diferenca — default R$ (a maioria das regras compara valores em reais); passe formatPercent pra regra 3 (percentual recalculado). */
  formatador?: (v: number) => string
}

/**
 * Avisa quando os dados não fecham, em vez de esconder o problema (pedido
 * explícito do SDG Corporativo de Frota) — mostra a diferença exata de cada
 * checagem que falhou. Quando tudo bate, só uma nota discreta (não some do
 * layout, mas não chama atenção à toa).
 */
export function ConsistenciaBanner({ checagens }: { checagens: ChecagemConsistencia[] }) {
  const falhas = checagens.filter(c => !c.resultado.ok)

  if (falhas.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        Dados consistentes — conta-mãe, soma das unidades e percentuais recalculados batem com o arquivo.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="h-3.5 w-3.5" />
        {falhas.length} inconsistência(s) nos dados desse período:
      </p>
      <ul className="space-y-1">
        {falhas.map(c => {
          const fmt = c.formatador ?? formatCurrencyParenteses
          return (
            <li key={c.nome}>
              <span className="font-medium">{c.nome}:</span>{' '}
              {fmt(c.resultado.valorA)} vs. {fmt(c.resultado.valorB)} — diferença de {fmt(c.resultado.diferenca)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Formatador pronto pra passar em `formatador` na checagem de percentual recalculado. */
export const formatadorPercentualConsistencia = (v: number) => formatPercent(v, 2)
