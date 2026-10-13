import { useMemo } from 'react'
import { Area, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPercent } from '@/lib/utils'
import type { SeriePontoCaptura, SeriePontoMensal } from '@/lib/farol-calculations'
import type { Natureza } from '@/types'
import { COR_AVR, COR_META, COR_NECESSARIO, MES_ABREV, PontoDot, PontoLabel, RotuloLinhaExtra, TooltipCustom, getChartColors } from '@/components/farol/chart-shared'

interface PontoGraficoIndicador {
  mes: number
  avr: number | null
  meta: number | null
  curva: number | null
}

interface IndicadorChartProps {
  serie: SeriePontoMensal[]
  gradientId: string
  natureza: Natureza
  /** Nome da série principal na legenda/tooltip — ex: "Realizado" no lugar do default "AVR Realizado". */
  nomeSerie?: string
  /** Nome da 2ª linha (tracejada) na legenda/tooltip — default "Meta"; ex: "Remunerado" pra séries sem meta de orçamento (a linha em si continua vindo do campo `meta` de `serie`). */
  nomeMeta?: string
  /** Como formatar os valores nos rótulos/tooltip — default percentual (AVR); passe formatCurrencyInteiro pra séries em R$. */
  formatter?: (v: number) => string
  /** Curva de Captura (ritmo necessário, ver `calcularSerieCaptura`) — 3ª linha amarela tracejada opcional, ligada por `CurvaCapturaToggle` fora deste componente. Estende o eixo X até os meses futuros da projeção quando `mostrarCurvaCaptura` está ativo. */
  serieCaptura?: SeriePontoCaptura[]
  mostrarCurvaCaptura?: boolean
}

export function IndicadorChart({
  serie, gradientId, natureza, nomeSerie = 'AVR Realizado', nomeMeta = 'Meta', formatter = v => formatPercent(v, 2),
  serieCaptura, mostrarCurvaCaptura,
}: IndicadorChartProps) {
  // Estende os pontos com o campo `curva` (avrNecessario, alinhado por mês) —
  // isso pode incluir meses além do último de `serie` (a projeção continua
  // até dezembro), por isso o eixo X do gráfico cresce junto quando ativo.
  const dadosGrafico = useMemo<PontoGraficoIndicador[]>(() => {
    if (!mostrarCurvaCaptura || !serieCaptura || serieCaptura.length === 0) {
      return serie.map(p => ({ mes: p.mes, avr: p.avr, meta: p.meta, curva: null }))
    }
    const porMes = new Map(serie.map(p => [p.mes, p]))
    const meses = Array.from(new Set([...serie.map(p => p.mes), ...serieCaptura.map(p => p.mes)])).sort((a, b) => a - b)
    return meses.map(mes => {
      const base = porMes.get(mes)
      const captura = serieCaptura.find(p => p.mes === mes)
      return {
        mes,
        avr: base?.avr ?? null,
        meta: base?.meta ?? null,
        curva: captura?.avrNecessario ?? null,
      }
    })
  }, [serie, serieCaptura, mostrarCurvaCaptura])

  if (dadosGrafico.length < 2) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        Sem meses suficientes para o gráfico ainda.
      </div>
    )
  }

  // Índice do último ponto com AVR (não `dadosGrafico.length - 1` — com a
  // curva ativa, o array se estende pros meses futuros da projeção, sem AVR).
  const ultimoIndex = dadosGrafico.reduce((acc, p, i) => (p.avr !== null ? i : acc), -1)
  const valores = dadosGrafico.map(p => ({ avr: p.avr, meta: p.meta }))
  const { axis, legend } = getChartColors()
  const mostraCurva = mostrarCurvaCaptura && !!serieCaptura && serieCaptura.length > 0
  // Rótulo de texto só no primeiro ponto da curva (depois do último realizado) — não em todo mês, senão poluiria o gráfico.
  const primeiroIndexCurva = mostraCurva
    ? dadosGrafico.findIndex((p, i) => i > ultimoIndex && p.curva !== null)
    : -1
  const valorCurvaLabel = primeiroIndexCurva >= 0 ? dadosGrafico[primeiroIndexCurva].curva : null

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dadosGrafico} margin={{ top: 28, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COR_AVR} stopOpacity={0.22} />
              <stop offset="100%" stopColor={COR_AVR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="mes"
            tickFormatter={m => MES_ABREV[m] ?? m}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke={axis}
            padding={{ left: 16, right: 16 }}
          />
          <YAxis hide domain={['auto', 'auto']} padding={{ top: 30 }} />
          <Tooltip content={<TooltipCustom nomeAvr={nomeSerie} nomeMeta={nomeMeta} dataKeyAvr="avr" dataKeyMeta="meta" dataKeyCurva={mostraCurva ? 'curva' : undefined} formatter={formatter} />} />
          <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, color: legend }} />
          <Area type="monotone" dataKey="avr" stroke="none" fill={`url(#${gradientId})`} legendType="none" isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="avr"
            name={nomeSerie}
            stroke={COR_AVR}
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={<PontoDot ultimoIndex={ultimoIndex} natureza={natureza} valores={valores} />}
            activeDot={{ r: 5, fill: COR_AVR, strokeWidth: 0 }}
            label={<PontoLabel ultimoIndex={ultimoIndex} natureza={natureza} valores={valores} formatter={formatter} />}
          />
          <Line
            type="monotone"
            dataKey="meta"
            name={nomeMeta}
            stroke={COR_META}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          {mostraCurva && (
            <Line
              type="monotone"
              dataKey="curva"
              name="Curva de Captura"
              stroke={COR_NECESSARIO}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              isAnimationActive={false}
              label={<RotuloLinhaExtra primeiroIndex={primeiroIndexCurva} valor={valorCurvaLabel} formatter={formatter} />}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
