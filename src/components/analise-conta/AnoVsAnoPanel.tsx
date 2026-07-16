import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Bar, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart as RechartsBarChart } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PillToggle } from '@/components/ui/pill-toggle'
import { selectGlamour } from '@/components/ui/field-styles'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard, tableCardActionClass } from '@/components/ui/table-card'
import { Button } from '@/components/ui/button'
import { cn, formatCurrencyCompact } from '@/lib/utils'
import { calcularComparativoAnual, corClasseGap, corClasseGapReal, type PontoComparativoAnual } from '@/lib/analise-conta-calculations'
import { COR_AVR, COR_META, GapPill, MES_ABREV, getChartColors } from '@/components/farol/chart-shared'
import type { DreLongoRow } from '@/types'

const TEXTO = { positivo: 'text-farol-positivo', negativo: 'text-farol-negativo' } as const

function unicos<T>(valores: T[]): T[] {
  return Array.from(new Set(valores))
}

function numeroCsv(valor: number): string {
  return valor.toFixed(2).replace('.', ',')
}

function exportarCsv(serie: PontoComparativoAnual[], total: PontoComparativoAnual, nomeConta: string, anoAntigo: number, anoRecente: number) {
  const linhaParaCsv = (p: PontoComparativoAnual, mesLabel: string) => [
    mesLabel,
    numeroCsv(p.realA), numeroCsv(p.realB), numeroCsv(p.gapReal),
    numeroCsv(p.remunA), numeroCsv(p.remunB), numeroCsv(p.gapRemun),
  ]
  const linhas = [
    ['Mês', `REAL ${anoAntigo}`, `REAL ${anoRecente}`, 'GAP REAL', `REMUN ${anoAntigo}`, `REMUN ${anoRecente}`, 'GAP REMUN'],
    ...serie.map(p => linhaParaCsv(p, MES_ABREV[p.mes] ?? String(p.mes))),
    linhaParaCsv(total, 'TOTAL'),
  ]
  const csv = linhas.map(linha => linha.join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `comparativo_${nomeConta.slice(0, 30).replace(/\s+/g, '_')}_${anoAntigo}_vs_${anoRecente}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface AnoVsAnoPanelProps {
  rowsContaTodosAnos: DreLongoRow[]
  nomeConta: string
}

/** Aba "Ano vs Ano": réplica das regras de 05_Analise_Ano_vs_Ano.py do painel antigo, pra mesma conta já selecionada na aba "Visão da conta". */
export function AnoVsAnoPanel({ rowsContaTodosAnos, nomeConta }: AnoVsAnoPanelProps) {
  const anosDisponiveis = useMemo(() => unicos(rowsContaTodosAnos.map(r => r.ano)).sort((a, b) => a - b), [rowsContaTodosAnos])

  const [selAno1, setSelAno1] = useState<number | null>(null)
  const [selAno2, setSelAno2] = useState<number | null>(null)
  useEffect(() => {
    if (anosDisponiveis.length === 0) return
    setSelAno1(prev => (prev && anosDisponiveis.includes(prev)) ? prev : anosDisponiveis[anosDisponiveis.length - 2] ?? anosDisponiveis[0])
    setSelAno2(prev => (prev && anosDisponiveis.includes(prev)) ? prev : anosDisponiveis[anosDisponiveis.length - 1])
  }, [anosDisponiveis])

  const [metrica, setMetrica] = useState<'Remunerado' | 'Realizado'>('Remunerado')

  const [anoAntigo, anoRecente] = useMemo(() => {
    if (selAno1 === null || selAno2 === null) return [null, null] as const
    return selAno1 <= selAno2 ? [selAno1, selAno2] : [selAno2, selAno1]
  }, [selAno1, selAno2])

  const serie = useMemo(() => {
    if (anoAntigo === null || anoRecente === null) return []
    const rowsA = rowsContaTodosAnos.filter(r => r.ano === anoAntigo)
    const rowsB = rowsContaTodosAnos.filter(r => r.ano === anoRecente)
    return calcularComparativoAnual(rowsA, rowsB)
  }, [rowsContaTodosAnos, anoAntigo, anoRecente])

  const total = useMemo<PontoComparativoAnual>(() => serie.reduce((acc, p) => ({
    mes: 0,
    remunA: acc.remunA + p.remunA,
    remunB: acc.remunB + p.remunB,
    gapRemun: acc.gapRemun + p.gapRemun,
    realA: acc.realA + p.realA,
    realB: acc.realB + p.realB,
    gapReal: acc.gapReal + p.gapReal,
  }), { mes: 0, remunA: 0, remunB: 0, gapRemun: 0, realA: 0, realB: 0, gapReal: 0 }), [serie])

  const dadosGrafico = useMemo(
    () => serie.map(p => ({
      mes: p.mes,
      anoAntigo: metrica === 'Remunerado' ? p.remunA : p.realA,
      anoRecente: metrica === 'Remunerado' ? p.remunB : p.realB,
    })),
    [serie, metrica],
  )

  const { axis, legend, cursor } = getChartColors()

  /**
   * Pílula com a diferença do mês (anoRecente − anoAntigo) acima do par de barras.
   * Cor segue a métrica exibida: Remunerado usa corClasseGap, Realizado usa
   * corClasseGapReal (invertido — gastar menos que o ano anterior é verde).
   */
  function DiffLabel({ x, y, width, index }: { x?: number | string; y?: number | string; width?: number | string; index?: number }) {
    if (x === undefined || y === undefined || width === undefined || index === undefined) return null
    const p = serie[index]
    if (!p) return null
    const valor = metrica === 'Remunerado' ? p.gapRemun : p.gapReal
    const positivo = (metrica === 'Remunerado' ? corClasseGap(p.gapRemun) : corClasseGapReal(p.gapReal)) === 'positivo'
    // Centro do grupo: a barra do ano recente é a 2ª do par (barGap padrão = 4px).
    const cx = Number(x) - 2
    return <GapPill x={cx} y={Number(y) - 14} value={valor} positivo={positivo} />
  }

  if (anosDisponiveis.length < 2 || anoAntigo === null || anoRecente === null) {
    return <p className="text-sm text-muted-foreground">Essa conta tem menos de 2 anos com dado importado — sem como comparar.</p>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Select value={String(selAno1 ?? '')} onValueChange={v => setSelAno1(Number(v))}>
            <SelectTrigger className={selectGlamour}><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Select value={String(selAno2 ?? '')} onValueChange={v => setSelAno2(Number(v))}>
            <SelectTrigger className={selectGlamour}><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Métrica do gráfico</Label>
          <div>
            <PillToggle
              opcoes={[
                { value: 'Remunerado', label: 'Remunerado' },
                { value: 'Realizado',  label: 'Realizado'  },
              ] as const}
              value={metrica}
              onChange={setMetrica}
            />
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={dadosGrafico} margin={{ top: 36, right: 16, bottom: 0, left: 0 }}>
                <XAxis dataKey="mes" tickFormatter={m => MES_ABREV[m] ?? m} tickLine={false} axisLine={false} fontSize={12} stroke={axis} />
                <YAxis hide />
                <Tooltip formatter={(value: number) => formatCurrencyCompact(value)} labelFormatter={m => MES_ABREV[m as number] ?? m} cursor={{ fill: cursor }} />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, color: legend }} />
                <Bar dataKey="anoAntigo" name={String(anoAntigo)} fill={COR_META} radius={[3, 3, 0, 0]} barSize={20} />
                <Bar dataKey="anoRecente" name={String(anoRecente)} fill={COR_AVR} radius={[3, 3, 0, 0]} barSize={20} label={<DiffLabel />} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <TableCard
        titulo={`Comparativo ${anoAntigo} vs ${anoRecente}`}
        subtitulo={nomeConta}
        acoes={
          <Button
            variant="outline"
            size="sm"
            className={cn('gap-2', tableCardActionClass)}
            onClick={() => exportarCsv(serie, total, nomeConta, anoAntigo, anoRecente)}
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-center">REAL {anoAntigo}</TableHead>
              <TableHead className="text-center">REAL {anoRecente}</TableHead>
              <TableHead className="text-center">GAP REAL</TableHead>
              <TableHead className="text-center">REMUN {anoAntigo}</TableHead>
              <TableHead className="text-center">REMUN {anoRecente}</TableHead>
              <TableHead className="text-center">GAP REMUN</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {serie.map(p => (
              <TableRow key={p.mes} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                <TableCell className="text-xs font-medium">{MES_ABREV[p.mes] ?? p.mes}</TableCell>
                <TableCell className="text-center text-xs">{formatCurrencyCompact(p.realA)}</TableCell>
                <TableCell className="text-center text-xs">{formatCurrencyCompact(p.realB)}</TableCell>
                <TableCell className={cn('text-center text-xs font-medium', TEXTO[corClasseGapReal(p.gapReal)])}>
                  {formatCurrencyCompact(p.gapReal)}
                </TableCell>
                <TableCell className="text-center text-xs">{formatCurrencyCompact(p.remunA)}</TableCell>
                <TableCell className="text-center text-xs">{formatCurrencyCompact(p.remunB)}</TableCell>
                <TableCell className={cn('text-center text-xs font-medium', TEXTO[corClasseGap(p.gapRemun)])}>
                  {formatCurrencyCompact(p.gapRemun)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell className="text-xs">TOTAL</TableCell>
              <TableCell className="text-center text-xs">{formatCurrencyCompact(total.realA)}</TableCell>
              <TableCell className="text-center text-xs">{formatCurrencyCompact(total.realB)}</TableCell>
              <TableCell className={cn('text-center text-xs', TEXTO[corClasseGapReal(total.gapReal)])}>
                {formatCurrencyCompact(total.gapReal)}
              </TableCell>
              <TableCell className="text-center text-xs">{formatCurrencyCompact(total.remunA)}</TableCell>
              <TableCell className="text-center text-xs">{formatCurrencyCompact(total.remunB)}</TableCell>
              <TableCell className={cn('text-center text-xs', TEXTO[corClasseGap(total.gapRemun)])}>
                {formatCurrencyCompact(total.gapRemun)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableCard>
    </div>
  )
}
