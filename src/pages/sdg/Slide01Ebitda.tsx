import { useMemo } from 'react'
import {
  normalizarParaCalculo, calcularReceita, avrPorPrefixo,
  calcularSemaforo, calcularImpactoFinanceiro, buscarMetaComFallback,
  calcularSerieAnual, calcularSerieCaptura,
} from '@/lib/farol-calculations'
import { IndicadorChart } from '@/components/farol/IndicadorChart'
import { CapturaChart } from '@/components/farol/CapturaChart'
import { PresentationCard } from '@/pages/sdg/PresentationCard'
import { PACOTES } from '@/lib/constants'
import type { DreLongoRow, Meta } from '@/types'

const CODIGO = '232'
const INFO   = PACOTES[CODIGO]

interface Props {
  rowsAno: DreLongoRow[]
  metas: Meta[]
  unidade: string
  negocio: string
  ano: number
  mes: number
  mesAcumMax: number | null
}

export function Slide01Ebitda({ rowsAno, metas, unidade, negocio, ano, mes, mesAcumMax }: Props) {
  const dfMensal = useMemo(
    () => rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === mes),
    [rowsAno, mes],
  )
  const dfYtd = useMemo(
    () => mesAcumMax === null ? [] : rowsAno.filter(r => r.tipo_periodo === 'ACUMULADO_ANO' && r.mes === mesAcumMax),
    [rowsAno, mesAcumMax],
  )

  const calcMensal = useMemo(() => normalizarParaCalculo(dfMensal), [dfMensal])
  const calcYtd    = useMemo(() => normalizarParaCalculo(dfYtd),    [dfYtd])

  const receitaMensal = useMemo(() => calcularReceita(calcMensal), [calcMensal])
  const receitaYtd    = useMemo(() => calcularReceita(calcYtd),    [calcYtd])

  const ctx = { unidade, negocio, ano, codigo: CODIGO, prefixos: INFO.prefixos }

  const mensal = useMemo(() => {
    const avr  = avrPorPrefixo(calcMensal, INFO.prefixos)
    const meta = buscarMetaComFallback(calcMensal, metas, { ...ctx, isYtd: false, mes })
    return { avr, meta, semaforo: calcularSemaforo(avr, meta, INFO.natureza), impacto: calcularImpactoFinanceiro(avr, meta, receitaMensal, INFO.natureza) }
  }, [calcMensal, metas, mes, receitaMensal])

  const ytd = useMemo(() => {
    const avr  = avrPorPrefixo(calcYtd, INFO.prefixos)
    const meta = buscarMetaComFallback(calcYtd, metas, { ...ctx, isYtd: true, mes: mesAcumMax ?? mes })
    return { avr, meta, semaforo: calcularSemaforo(avr, meta, INFO.natureza), impacto: calcularImpactoFinanceiro(avr, meta, receitaYtd, INFO.natureza) }
  }, [calcYtd, metas, mes, mesAcumMax, receitaYtd])

  const serieAnual = useMemo(
    () => calcularSerieAnual(rowsAno, metas, { ...ctx }),
    [rowsAno, metas],
  )
  const serieCaptura = useMemo(
    () => calcularSerieCaptura(rowsAno, metas, { ...ctx }),
    [rowsAno, metas],
  )

  return (
    <div className="flex h-full flex-col gap-5 p-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <PresentationCard
          nome="EBITDA"
          periodo={`Mensal — M${mes}`}
          avr={mensal.avr}
          meta={mensal.meta}
          impacto={mensal.impacto}
          semaforo={mensal.semaforo}
        />
        <PresentationCard
          nome="EBITDA"
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
              gradientId="sdg-ebitda-mensal"
              natureza={INFO.natureza}
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
              natureza={INFO.natureza}
              nomeSerie="Realizado"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
