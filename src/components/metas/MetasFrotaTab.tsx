import { RV_FROTA_DRE } from '@/lib/constants'
import { PesosDreCard } from '@/components/metas/PesosDreCard'

/**
 * Aba "Metas de Frota": por enquanto só os indicadores com origem no DRE —
 * Manutenção (117), Pneus (131) e Diesel (115), todos apurados por AVR contra
 * a meta do Farol. Os indicadores de fora do DRE entram quando a importação
 * deles for estruturada.
 */
export function MetasFrotaTab() {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Indicadores de frota com origem no DRE —{' '}
        <strong className="text-foreground">Manutenção (117)</strong>,{' '}
        <strong className="text-foreground">Pneus (131)</strong> e{' '}
        <strong className="text-foreground">Diesel (115)</strong> — apurados pelo AVR do mês
        contra a meta do Farol. Cadastre só o peso de cada indicador.
        Os indicadores de fora do DRE serão adicionados quando a importação deles estiver definida.
      </p>

      <PesosDreCard
        tabela="rv_frota_pesos_dre"
        indicadores={RV_FROTA_DRE}
        subtitulo="Peso único por indicador, vale pra todas as unidades. Todos por AVR vs meta do Farol (quanto menor melhor)."
      />
    </div>
  )
}
