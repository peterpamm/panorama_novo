import { CUSTOS_GERAIS_FROTA_DRE, RV_FROTA_DRE } from '@/lib/constants'
import { PesosDreCard } from '@/components/metas/PesosDreCard'
import { DescontosFrotaMetaCard } from '@/components/metas/DescontosFrotaMetaCard'
import { FrotaT1MetaCard } from '@/components/metas/FrotaT1MetaCard'

const INDICADORES_DRE_FROTA = [...RV_FROTA_DRE, CUSTOS_GERAIS_FROTA_DRE]

/**
 * Aba "Metas de Frota": os indicadores com origem no DRE — Manutenção (118),
 * Pneus (132), Diesel (116) e Custos Gerais Frota (114) — apurados por AVR
 * contra a meta do Orçamento, peso único (Custos Gerais Frota só conta pras 3
 * lideranças T1, mas o peso mora na mesma tabela — a restrição de unidade é
 * só no cálculo, ver useRvApuracao.ts) — o Desconto CIVF / Desconto Stress Test, cadastro
 * manual em R$, meta e peso únicos (vale pra todas as unidades) — e os 4
 * indicadores importados específicos de Estância/Ponta Grossa/CDR Bahia (T1),
 * com meta e peso por unidade.
 */
export function MetasFrotaTab() {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Indicadores de frota com origem no DRE —{' '}
        <strong className="text-foreground">Manutenção (118)</strong>,{' '}
        <strong className="text-foreground">Pneus (132)</strong>,{' '}
        <strong className="text-foreground">Diesel (116)</strong> e{' '}
        <strong className="text-foreground">Custos Gerais Frota (114)</strong> — apurados pelo AVR do
        mês contra a meta do Orçamento. Cadastre só o peso de cada indicador — Custos Gerais Frota só
        entra pras 3 lideranças T1 (Estância/Ponta Grossa/CDR Bahia), os demais valem pra todas.
      </p>

      <PesosDreCard
        tabela="rv_frota_pesos_dre"
        indicadores={INDICADORES_DRE_FROTA}
        subtitulo="Peso único por indicador. Todos por AVR vs meta do Orçamento (quanto menor melhor) — Custos Gerais Frota só conta pras 3 lideranças T1."
      />

      <DescontosFrotaMetaCard />
      <FrotaT1MetaCard />
    </div>
  )
}
