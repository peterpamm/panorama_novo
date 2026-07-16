import { RV_FINANCEIRO_DRE } from '@/lib/constants'
import { PesosDreCard } from '@/components/metas/PesosDreCard'

/**
 * Aba "Metas do Financeiro": os indicadores da RV do Financeiro vêm todos do
 * DRE, então não há metas pra importar — só o peso de cada indicador.
 * Despesa ADM (157) e Custo Operacional (021) apuram por AVR contra a meta do
 * Farol; Vales (051+052) e Multas (137+222) apuram por dispersão (coluna
 * diferença — ≥ 0 = meta batida), as mesmas contas do Painel de Perdas.
 */
export function MetasFinanceiroTab() {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Os indicadores da RV do Financeiro vêm todos do DRE — não tem arquivo de metas pra importar aqui.
        <strong className="text-foreground"> Despesa Administrativa (157)</strong> e{' '}
        <strong className="text-foreground">Custo Operacional (021)</strong> usam o AVR do mês contra a meta do Farol;{' '}
        <strong className="text-foreground">Gastos com Vales (051+052)</strong> e{' '}
        <strong className="text-foreground">Multas (137+222)</strong> usam a dispersão
        (coluna diferença do DRE, contas do Painel de Perdas — ≥ 0 = meta batida).
        Cadastre só o peso de cada indicador.
      </p>

      <PesosDreCard
        tabela="rv_financeiro_pesos_dre"
        indicadores={RV_FINANCEIRO_DRE}
        subtitulo="Peso único por indicador, vale pra todas as unidades. Vales e Multas são dispersão (diferença ≥ 0 = meta batida)."
      />
    </div>
  )
}
