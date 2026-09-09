import { RV_FINANCEIRO_DRE } from '@/lib/constants'
import { PesosDreCard } from '@/components/metas/PesosDreCard'
import { ValesMetaCard } from '@/components/metas/ValesMetaCard'

/**
 * Aba "Metas do Financeiro": Despesa ADM (158) e Custo Operacional (021)
 * apuram por AVR contra a meta do Farol; Multas (138+223) apura por
 * dispersão (coluna diferença — ≥ 0 = meta batida) — todos com origem no
 * DRE, só o peso pra cadastrar. Vales (052+053) é à parte (ValesMetaCard,
 * reaproveitado da Distribuição) — usa a Meta de Perdas de Vales (Metas de
 * Perdas), cadastra-se só o peso e o % dela que pode ser gasto.
 */
export function MetasFinanceiroTab() {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        <strong className="text-foreground">Despesa Administrativa (158)</strong> e{' '}
        <strong className="text-foreground">Custo Operacional (021)</strong> usam o AVR do mês contra a meta do Farol;{' '}
        <strong className="text-foreground">Multas (138+223)</strong> usa a dispersão
        (coluna diferença do DRE, contas do Painel de Perdas — ≥ 0 = meta batida). Cadastre só o peso de cada
        indicador. <strong className="text-foreground">Gastos com Vales (052+053)</strong> usa a Meta de Perdas de
        Vales (Metas &gt; Metas de Perdas) — cadastre o peso e o % dela que pode ser gasto no mês.
      </p>

      <PesosDreCard
        tabela="rv_financeiro_pesos_dre"
        indicadores={RV_FINANCEIRO_DRE}
        subtitulo="Peso único por indicador, vale pra todas as unidades. Multas é dispersão (diferença ≥ 0 = meta batida)."
      />

      <ValesMetaCard tabela="rv_vales_financeiro_meta" />
    </div>
  )
}
