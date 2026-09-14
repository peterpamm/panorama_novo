import { useMemo } from 'react'
import { Bar, Cell, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { calcularRankingIndicador, type PeriodoRanking, type RankingLinhaIndicador } from '@/lib/ranking-calculations'
import { getChartColors } from '@/components/farol/chart-shared'
import { COR_BATEU_CORP, COR_PERDEU_CORP } from '@/pages/sdg-corporativo/cores'
import { formatPercent } from '@/lib/utils'
import type { DreLongoRow, Natureza, OrcamentoLinha } from '@/types'

const COR_AVO = '#94a3b8'

interface TooltipComparativoProps {
  active?: boolean
  payload?: { payload: RankingLinhaIndicador & { nome: string } }[]
}

function TooltipComparativo({ active, payload }: TooltipComparativoProps) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
      <p className="mb-1.5 font-semibold">{p.nome}</p>
      <p className="text-muted-foreground">AVR: <span className="font-medium text-popover-foreground">{formatPercent(p.avr, 2)}</span></p>
      <p className="text-muted-foreground">AVO (meta): <span className="font-medium text-popover-foreground">{p.meta === null ? '—' : formatPercent(p.meta, 2)}</span></p>
      <p className="text-muted-foreground">Divergência: <span className="font-medium text-popover-foreground">{p.delta === null ? '—' : formatPercent(p.delta, 2)}</span></p>
    </div>
  )
}

interface ComparativoUnidadesChartProps {
  rowsNegocioAno: DreLongoRow[]
  orcamentoRows: OrcamentoLinha[]
  pacote: { natureza: Natureza; prefixos: string[] }
  codigo: string
  params: { negocio: string; ano: number; periodo: PeriodoRanking; mes: number }
  nomesUnidade: Map<string, string>
}

/**
 * Comparativo AVO x AVR por unidade, ordenado da MAIOR pra menor divergência
 * (pior primeiro) — pro contrário de `RankingTabelaIndicador` (que ordena
 * melhor primeiro, pra ranking). Reaproveita `calcularRankingIndicador`
 * (ranking-calculations.ts) pro cálculo por unidade — só reordena o
 * resultado aqui, não duplica a conta.
 */
export function ComparativoUnidadesChart({ rowsNegocioAno, orcamentoRows, pacote, codigo, params, nomesUnidade }: ComparativoUnidadesChartProps) {
  const { axis, legend } = getChartColors()

  const linhas = useMemo(() => {
    const ranking = calcularRankingIndicador(rowsNegocioAno, orcamentoRows, pacote, codigo, params, ['AMBEV'])
    return ranking
      .filter(l => l.unidade !== 'AMBEV')
      .map(l => ({ ...l, nome: nomesUnidade.get(l.unidade) ?? l.unidade }))
      .sort((a, b) => {
        if (a.delta === null && b.delta === null) return 0
        if (a.delta === null) return 1
        if (b.delta === null) return -1
        return a.delta - b.delta // pior (mais negativo) primeiro
      })
  }, [rowsNegocioAno, orcamentoRows, pacote, codigo, params, nomesUnidade])

  if (linhas.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        Sem unidades com dado nesse período.
      </div>
    )
  }

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={linhas} margin={{ top: 16, right: 16, bottom: 48, left: 0 }}>
          <XAxis dataKey="nome" tickLine={false} axisLine={false} fontSize={11} stroke={axis} angle={-30} textAnchor="end" interval={0} height={64} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} stroke={axis} tickFormatter={v => `${v}%`} width={48} />
          <Tooltip content={<TooltipComparativo />} cursor={{ fill: 'transparent' }} />
          <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 12, color: legend }} />
          <Bar dataKey="meta" name="AVO (meta)" fill={COR_AVO} radius={[4, 4, 0, 0]} barSize={16} />
          <Bar dataKey="avr" name="AVR (realizado)" radius={[4, 4, 0, 0]} barSize={16}>
            {linhas.map(l => (
              <Cell key={l.unidade} fill={l.delta !== null && l.delta >= 0 ? COR_BATEU_CORP : COR_PERDEU_CORP} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
