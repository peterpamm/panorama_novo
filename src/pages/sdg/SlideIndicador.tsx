import { IndicadorChart } from '@/components/farol/IndicadorChart'
import { CapturaChart } from '@/components/farol/CapturaChart'
import { PresentationCard } from '@/pages/sdg/PresentationCard'
import { useIndicadorSdg, type IndicadorSdgParams } from '@/pages/sdg/useIndicadorSdg'

export function SlideIndicador(props: IndicadorSdgParams) {
  const { codigo, ano, mes, mesAcumMax } = props
  const { info, mensal, ytd, serieAnual, serieCaptura } = useIndicadorSdg(props)

  return (
    <div className="flex h-full flex-col gap-5 p-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <PresentationCard
          nome={info.nome}
          periodo={`Mensal — M${mes}`}
          avr={mensal.avr}
          meta={mensal.meta}
          impacto={mensal.impacto}
          semaforo={mensal.semaforo}
        />
        <PresentationCard
          nome={info.nome}
          periodo={`YTD — M${mesAcumMax ?? mes}`}
          avr={ytd.avr}
          meta={ytd.meta}
          impacto={ytd.impacto}
          semaforo={ytd.semaforo}
        />
      </div>

      {/* Gráficos */}
      <div className="grid flex-1 grid-cols-2 gap-4 min-h-0">
        <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Acompanhamento Mensal — {ano}
          </p>
          <div className="flex-1 min-h-0">
            <IndicadorChart
              serie={serieAnual}
              gradientId={`sdg-${codigo}-mensal`}
              natureza={info.natureza}
              nomeSerie="Realizado"
            />
          </div>
        </div>

        <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Curva de Captura da Meta
          </p>
          <div className="flex-1 min-h-0">
            <CapturaChart
              serie={serieCaptura}
              natureza={info.natureza}
              nomeSerie="Realizado"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
