import { RV_SEGURANCA_DRE } from '@/lib/constants'
import { PesosDreCard } from '@/components/metas/PesosDreCard'

/**
 * Aba "Metas de Segurança": indicadores com origem no DRE — EPI's (074) e
 * Uniformes (075), os mesmos acompanhados no Farol de Metas, apurados por
 * AVR contra a meta do Farol. Só o peso é cadastrado aqui.
 */
export function MetasSegurancaTab() {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Indicadores de segurança com origem no DRE —{' '}
        <strong className="text-foreground">EPI's (074)</strong> e{' '}
        <strong className="text-foreground">Uniformes (075)</strong>, os mesmos acompanhados
        no Farol de Metas — apurados pelo AVR do mês contra a meta do Farol.
        Cadastre só o peso de cada indicador.
      </p>

      <PesosDreCard
        tabela="rv_seguranca_pesos_dre"
        indicadores={RV_SEGURANCA_DRE}
        subtitulo="Peso único por indicador, vale pra todas as unidades. Todos por AVR vs meta do Farol (quanto menor melhor)."
      />
    </div>
  )
}
