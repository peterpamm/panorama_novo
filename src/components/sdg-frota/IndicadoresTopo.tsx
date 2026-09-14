import { calcularImpactoFinanceiro, calcularSemaforo } from '@/lib/farol-calculations'
import { corBarraCorporativo, COR_BATEU_CORP, COR_PERDEU_CORP } from '@/pages/sdg-corporativo/cores'
import { formatCurrencyParenteses, formatPercent, formatPercentSigned } from '@/lib/utils'
import type { Natureza } from '@/types'

interface CardIndicadorProps {
  rotulo: string
  valor: string
  cor?: string
}

function CardIndicador({ rotulo, valor, cor }: CardIndicadorProps) {
  return (
    <div className="flex flex-col rounded-xl bg-gray-50 px-4 py-3 dark:bg-slate-900/40">
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">{rotulo}</span>
      <span className="mt-1 text-lg font-bold tabular-nums" style={cor ? { color: cor } : undefined}>{valor}</span>
    </div>
  )
}

interface IndicadoresTopoProps {
  /** Realizado em R$ do período (magnitude — já em `Math.abs`, mesma convenção de `normalizarParaCalculo`). */
  realizado: number
  /** Receita do mesmo período — base do impacto financeiro (Desvio R$). */
  receita: number
  avrPct: number
  /** AVO — meta importada do Orçamento (`buscarMetaOrcamento`). null = sem meta cadastrada pro período/pacote. */
  avoPct: number | null
  natureza: Natureza
}

/**
 * Linha de indicadores no topo de cada tela do SDG Corporativo de Frota:
 * Realizado, Meta (AVO), Desvio em R$, AVR%, AVO% e a divergência AVO×AVR
 * (em pontos percentuais e em termos relativos) — com sinalização verde/
 * vermelho de quem está dentro ou fora da meta. Reaproveita
 * `calcularSemaforo`/`calcularImpactoFinanceiro` (farol-calculations.ts) e
 * as cores do SDG Corporativo (`cores.ts`) — não recalcula nada daquilo.
 */
export function IndicadoresTopo({ realizado, receita, avrPct, avoPct, natureza }: IndicadoresTopoProps) {
  const semaforo = calcularSemaforo(avrPct, avoPct, natureza)
  const desvioRs = avoPct === null ? null : calcularImpactoFinanceiro(avrPct, avoPct, receita, natureza)
  // Meta em R$ — só magnitude (avoPct já vem sempre positivo pra custo, mesma
  // convenção de normalizarParaCalculo/buscarMetaOrcamento em todo o resto do app).
  const metaRs = avoPct === null ? null : (avoPct / 100) * receita
  const divergenciaPp = semaforo.delta
  const divergenciaRelativa = divergenciaPp !== null && avoPct !== null && avoPct !== 0
    ? (divergenciaPp / Math.abs(avoPct)) * 100
    : null

  const cor = corBarraCorporativo(avrPct, avoPct, natureza)
  const corDesvio = desvioRs === null ? undefined : desvioRs >= 0 ? COR_BATEU_CORP : COR_PERDEU_CORP

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <CardIndicador rotulo="Meta (AVO)" valor={metaRs === null ? '—' : formatCurrencyParenteses(metaRs)} />
      <CardIndicador rotulo="Realizado" valor={formatCurrencyParenteses(realizado)} />
      <CardIndicador rotulo="Desvio (R$)" valor={desvioRs === null ? '—' : formatCurrencyParenteses(desvioRs)} cor={corDesvio} />
      <CardIndicador rotulo="AVO (%)" valor={formatPercent(avoPct, 1)} />
      <CardIndicador rotulo="AVR (%)" valor={formatPercent(avrPct, 1)} cor={cor} />
      <CardIndicador
        rotulo="Divergência AVO×AVR"
        valor={divergenciaPp === null
          ? '—'
          : `${formatPercentSigned(divergenciaPp, 1)} p.p.${divergenciaRelativa === null ? '' : ` (${formatPercentSigned(divergenciaRelativa, 0)})`}`}
        cor={cor}
      />
    </div>
  )
}
