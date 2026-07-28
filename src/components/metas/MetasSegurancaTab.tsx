import { RV_SEGURANCA_DRE } from '@/lib/constants'
import { PesosDreCard } from '@/components/metas/PesosDreCard'
import { IndicadoresMetaUnicaCard } from '@/components/metas/IndicadoresMetaUnicaCard'
import { DtoT1MetaCard } from '@/components/metas/DtoT1MetaCard'
import { ExcessoVelocidadeFaiMetaCard } from '@/components/metas/ExcessoVelocidadeFaiMetaCard'

/**
 * Aba "Metas de Segurança": indicadores com origem no DRE — EPI's (074) e
 * Uniformes (075), os mesmos acompanhados no Farol de Metas, apurados por
 * AVR contra a meta do Farol — o DTO T2, GSD e LogOn, importados do
 * BI/planilha, com meta e peso únicos (não vêm do DRE nem têm meta por
 * operação/mês, por isso ficam juntos num card só) — o DTO T1, com meta e
 * peso por unidade (só ESTÂNCIA e CDR BAHIA) — e o Excesso de Velocidade/FAI,
 * também com meta (máximo de ocorrências) e peso por unidade (Excesso de
 * Velocidade pra todas menos ESTÂNCIA, FAI só ESTÂNCIA/CDR BAHIA — os dois
 * juntos num card só porque são complementares e ambos de quantidade).
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

      <IndicadoresMetaUnicaCard />
      <div className="flex flex-wrap gap-6">
        <DtoT1MetaCard />
        <ExcessoVelocidadeFaiMetaCard />
      </div>
    </div>
  )
}
