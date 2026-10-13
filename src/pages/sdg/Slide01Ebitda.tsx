import { useMemo } from 'react'
import {
  normalizarParaCalculo, calcularReceita, avrPorPrefixo,
  calcularSemaforo, calcularImpactoFinanceiro,
  calcularSerieAnual, calcularSerieCaptura,
} from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { IndicadorChart } from '@/components/farol/IndicadorChart'
import { CapturaChart } from '@/components/farol/CapturaChart'
import { PresentationCard } from '@/pages/sdg/PresentationCard'
import { JustificativaEAcoesCard } from '@/pages/sdg/JustificativaEAcoesCard'
import { PACOTES } from '@/lib/constants'
import type { DreLongoRow, OrcamentoLinha, PlanoAcao, SdgJustificativa } from '@/types'

const CODIGO = '233'
const INFO   = PACOTES[CODIGO]

interface Props {
  rowsAno: DreLongoRow[]
  orcamentoRows: OrcamentoLinha[]
  unidade: string
  negocio: string
  ano: number
  mes: number
  mesAcumMax: number | null
  justificativa: SdgJustificativa | undefined
  acoesRelacionadas: PlanoAcao[]
}

export function Slide01Ebitda({ rowsAno, orcamentoRows, unidade, negocio, ano, mes, mesAcumMax, justificativa, acoesRelacionadas }: Props) {
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

  const ctx = { unidade, negocio, ano, codigo: CODIGO }

  const mensal = useMemo(() => {
    const avr  = avrPorPrefixo(calcMensal, INFO.prefixos)
    const meta = buscarMetaOrcamento(orcamentoRows, { ...ctx, mes })
    return { avr, meta, semaforo: calcularSemaforo(avr, meta, INFO.natureza), impacto: calcularImpactoFinanceiro(avr, meta, receitaMensal, INFO.natureza) }
  }, [calcMensal, orcamentoRows, mes, receitaMensal])

  const ytd = useMemo(() => {
    const avr  = avrPorPrefixo(calcYtd, INFO.prefixos)
    const meta = buscarMetaOrcamento(orcamentoRows, { ...ctx, mes: 0 })
    return { avr, meta, semaforo: calcularSemaforo(avr, meta, INFO.natureza), impacto: calcularImpactoFinanceiro(avr, meta, receitaYtd, INFO.natureza) }
  }, [calcYtd, orcamentoRows, receitaYtd])

  const serieAnual = useMemo(() => {
    const base = calcularSerieAnual(rowsAno, [], { ...ctx, prefixos: INFO.prefixos })
    return base.map(ponto => ({ ...ponto, meta: buscarMetaOrcamento(orcamentoRows, { ...ctx, mes: ponto.mes }) }))
  }, [rowsAno, orcamentoRows])

  const serieCaptura = useMemo(() => {
    const metaAnual = buscarMetaOrcamento(orcamentoRows, { ...ctx, mes: 0 })
    return calcularSerieCaptura(rowsAno, [], orcamentoRows, { ...ctx, prefixos: INFO.prefixos, natureza: INFO.natureza }, metaAnual)
  }, [rowsAno, orcamentoRows])

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
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
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Acompanhamento Mensal — {ano}
            </p>
            <div className="h-[280px]">
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
            <div className="h-[280px]">
              <CapturaChart
                serie={serieCaptura}
                natureza={INFO.natureza}
                nomeSerie="Realizado"
              />
            </div>
          </div>
        </div>

        <JustificativaEAcoesCard justificativa={justificativa} acoes={acoesRelacionadas} />
      </div>
    </div>
  )
}
