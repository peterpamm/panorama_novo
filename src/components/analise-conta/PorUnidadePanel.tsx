import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PillToggle } from '@/components/ui/pill-toggle'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard, tableCardActionClass } from '@/components/ui/table-card'
import { COR_AVR, COR_META, MES_ABREV, getChartColors } from '@/components/farol/chart-shared'
import { calcularPorUnidadeConta, corClasseGap, type LinhaContaUnidade } from '@/lib/analise-conta-calculations'
import { cn, formatCurrencyCompact, formatCurrencyInteiro, formatPercent, formatPercentSigned } from '@/lib/utils'
import type { DreLongoRow, OrcamentoLinha } from '@/types'

const TEXTO = { positivo: 'text-farol-positivo', negativo: 'text-farol-negativo' } as const

/** Valor do seletor de período que significa "todos os meses do ano somados". */
const PERIODO_ANO = 'ano'

/** R$ = Remunerado × Realizado; AVR = meta orçada × AVR realizado + impacto em R$. */
type ModoTabela = 'reais' | 'avr'

/** Célula compacta — a tabela lista todas as unidades, então cada linha precisa caber sem rolagem. */
const CELULA = 'py-1.5 text-sm'

function numeroCsv(valor: number | null): string {
  return valor === null ? '' : valor.toFixed(2).replace('.', ',')
}

function exportarCsv(linhas: LinhaContaUnidade[], nomesUnidade: Map<string, string>, nomeConta: string, periodo: string) {
  const csv = [
    ['Unidade', 'Remunerado (R$)', 'Realizado (R$)', 'Gap (R$)', 'Gap (%)', 'Meta orçada (%)', 'AVR (%)', 'Delta (p.p.)', 'Impacto (R$)'],
    ...linhas.map(l => [
      nomesUnidade.get(l.unidade) ?? l.unidade,
      numeroCsv(l.remunerado),
      numeroCsv(l.realizado),
      numeroCsv(l.gap),
      numeroCsv(l.gapPercent),
      numeroCsv(l.meta),
      numeroCsv(l.avr),
      numeroCsv(l.deltaPp),
      numeroCsv(l.impacto),
    ]),
  ].map(linha => linha.join(';')).join('\n')

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `conta_por_unidade_${nomeConta.slice(0, 30).replace(/\s+/g, '_')}_${periodo}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function TooltipPorUnidade({ active, payload, label, modo }: {
  active?: boolean
  payload?: { value: number | null; dataKey: string }[]
  label?: string
  modo: ModoTabela
}) {
  if (!active || !payload || payload.length === 0) return null
  const fmt = (v: number) => modo === 'reais' ? formatCurrencyCompact(v) : formatPercent(v, 2)
  const primeira = payload.find(p => p.dataKey === (modo === 'reais' ? 'remunerado' : 'meta'))?.value
  const segunda = payload.find(p => p.dataKey === (modo === 'reais' ? 'realizado' : 'avr'))?.value
  return (
    <div className="rounded-lg border border-gray-200/50 bg-white/90 px-3 py-2.5 text-xs shadow-xl backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-800/90">
      <p className="mb-1.5 font-semibold text-gray-900 dark:text-white">{label}</p>
      {primeira != null && (
        <p className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <span className="h-2 w-2 rounded-full" style={{ background: COR_META }} />
          {modo === 'reais' ? 'Remunerado' : 'Meta (orçado)'}:{' '}
          <span className="font-medium text-gray-900 dark:text-white">{fmt(primeira)}</span>
        </p>
      )}
      {segunda != null && (
        <p className="mt-1 flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <span className="h-2 w-2 rounded-full" style={{ background: COR_AVR }} />
          {modo === 'reais' ? 'Realizado' : 'AVR (realizado)'}:{' '}
          <span className="font-medium text-gray-900 dark:text-white">{fmt(segunda)}</span>
        </p>
      )}
    </div>
  )
}

interface PorUnidadePanelProps {
  /**
   * Linhas de TODAS as unidades e TODAS as contas, já filtradas por
   * negócio/ano e tipo_periodo=MENSAL — as outras contas entram porque a
   * receita de cada unidade é a base do impacto em R$.
   */
  rowsNegocioAno: DreLongoRow[]
  /** Orçamento importado (todas as unidades) — fonte única da meta, ver `calcularPorUnidadeConta`. */
  orcamentos: OrcamentoLinha[]
  conta: string
  negocio: string
  nomesUnidade: Map<string, string>
  nomeConta: string
  ano: number
}

/**
 * Aba "Por Unidade" da Análise por Conta: a mesma conta comparada entre
 * todas as unidades, em tabela (primeiro, porque é o que se lê de fato) e
 * gráfico, no ano todo ou num mês específico. Dois modos, no botão do
 * cabeçalho da tabela: R$ (Remunerado × Realizado × Gap) e AVR (meta do
 * orçamento importado × AVR realizado, Δ em p.p. e o impacto em R$ do
 * desvio). Visão de quem enxerga várias unidades — o usuário de unidade só
 * veria as próprias linhas, porque a RLS já restringe o dado que chega no
 * cache.
 *
 * A meta sai SÓ do orçamento importado, que só cobre as contas mapeadas em
 * `PACOTE_CONTA_ORCAMENTO` — nas demais contas o modo AVR mostra o
 * realizado com meta "—" (o modo R$ continua completo pra qualquer conta).
 *
 * A AMBEV é uma "unidade" na view (o consolidado de todas), então sai da
 * lista e vira a linha de Total — somar ela junto das demais contaria tudo
 * em dobro. Sem AMBEV no período, o Total é a soma das unidades listadas.
 */
export function PorUnidadePanel({ rowsNegocioAno, orcamentos, conta, negocio, nomesUnidade, nomeConta, ano }: PorUnidadePanelProps) {
  const { axis, legend, cursor } = getChartColors()
  const [periodo, setPeriodo] = useState<string>(PERIODO_ANO)
  const [modo, setModo] = useState<ModoTabela>('reais')

  const mesesDisponiveis = useMemo(
    () => Array.from(new Set(rowsNegocioAno.filter(r => r.conta_codigo === conta).map(r => r.mes))).sort((a, b) => a - b),
    [rowsNegocioAno, conta],
  )

  const rowsPeriodo = useMemo(
    () => periodo === PERIODO_ANO ? rowsNegocioAno : rowsNegocioAno.filter(r => r.mes === Number(periodo)),
    [rowsNegocioAno, periodo],
  )

  // Ano todo lê o bloco anual do orçamento (mes=0); mês específico lê o
  // bloco do próprio mês — mesma régua do Farol/Ranking.
  const todasLinhas = useMemo(
    () => calcularPorUnidadeConta(rowsPeriodo, conta, orcamentos, {
      negocio, ano, mesOrcamento: periodo === PERIODO_ANO ? 0 : Number(periodo),
    }),
    [rowsPeriodo, conta, orcamentos, negocio, ano, periodo],
  )
  const linhas = useMemo(() => todasLinhas.filter(l => l.unidade !== 'AMBEV'), [todasLinhas])
  const linhaAmbev = useMemo(() => todasLinhas.find(l => l.unidade === 'AMBEV'), [todasLinhas])

  const total = useMemo<LinhaContaUnidade>(() => {
    if (linhaAmbev) return linhaAmbev
    const remunerado = linhas.reduce((acc, l) => acc + l.remunerado, 0)
    const realizado = linhas.reduce((acc, l) => acc + l.realizado, 0)
    const gap = linhas.reduce((acc, l) => acc + l.gap, 0)
    // Sem AMBEV no período não dá pra somar meta/AVR (são % de receitas
    // diferentes) — só o impacto, que já está em R$, soma direto.
    return {
      unidade: 'TOTAL',
      remunerado,
      realizado,
      gap,
      gapPercent: remunerado !== 0 ? (gap / remunerado) * 100 : 0,
      meta: null,
      avr: 0,
      deltaPp: null,
      impacto: linhas.reduce((acc, l) => acc + l.impacto, 0),
    }
  }, [linhas, linhaAmbev])

  const dadosGrafico = useMemo(
    () => linhas.map(l => ({ ...l, nome: nomesUnidade.get(l.unidade) ?? l.unidade })),
    [linhas, nomesUnidade],
  )

  const rotuloPeriodo = periodo === PERIODO_ANO ? `Ano todo · ${ano}` : `${MES_ABREV[Number(periodo)]}/${ano}`

  return (
    <div className="space-y-6">
      <div className="max-w-xs space-y-1.5">
        <Label className="text-gray-700 dark:text-gray-300">Período</Label>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={PERIODO_ANO}>Ano todo (acumulado)</SelectItem>
            {mesesDisponiveis.map(m => (
              <SelectItem key={m} value={String(m)}>{MES_ABREV[m] ?? m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {modo === 'avr' && linhas.length > 0 && linhas.every(l => l.meta === null) && (
        <p className="text-sm text-amber-600 dark:text-amber-500">
          Essa conta não tem meta no orçamento importado — o orçamento cobre só as contas que viram pacote do Farol
          (Gastos Totais, EBITDA, Custo com Pessoal, Frota etc.). O modo R$ continua completo.
        </p>
      )}

      {linhas.length === 0 ? (
        <div className="rounded-xl border border-gray-200/30 bg-white/50 p-8 text-center dark:border-gray-700/30 dark:bg-gray-800/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma unidade com dado importado para essa conta nesse período.</p>
        </div>
      ) : (
        <>
          <TableCard
            titulo={modo === 'reais' ? 'Remunerado × Realizado por unidade' : 'Meta orçada × AVR por unidade'}
            subtitulo={`${nomeConta} · ${rotuloPeriodo} · pior gap primeiro`}
            acoes={
              <>
                <PillToggle<ModoTabela>
                  opcoes={[{ value: 'reais', label: 'R$' }, { value: 'avr', label: 'AVR' }]}
                  value={modo}
                  onChange={setModo}
                  variant="navy"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className={cn('gap-2', tableCardActionClass)}
                  onClick={() => exportarCsv(linhas, nomesUnidade, nomeConta, periodo === PERIODO_ANO ? String(ano) : `${periodo}_${ano}`)}
                >
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </Button>
              </>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  {modo === 'reais' ? (
                    <>
                      <TableHead className="text-center">Remunerado</TableHead>
                      <TableHead className="text-center">Realizado</TableHead>
                      <TableHead className="text-center">Gap</TableHead>
                      <TableHead className="text-center">Gap %</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="text-center">Meta (orçado)</TableHead>
                      <TableHead className="text-center">AVR (realizado)</TableHead>
                      <TableHead className="text-center">Δ p.p.</TableHead>
                      <TableHead className="text-center">Impacto</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map(l => {
                  const cor = corClasseGap(modo === 'reais' ? l.gap : l.deltaPp ?? 0)
                  const semAvo = l.deltaPp === null
                  return (
                    <TableRow key={l.unidade} className="border-gray-200/30 hover:bg-gray-50/50 dark:border-gray-700/30 dark:hover:bg-gray-700/30">
                      <TableCell className={cn(CELULA, 'font-medium')}>{nomesUnidade.get(l.unidade) ?? l.unidade}</TableCell>
                      {modo === 'reais' ? (
                        <>
                          <TableCell className={cn(CELULA, 'text-center')}>{formatCurrencyCompact(l.remunerado)}</TableCell>
                          <TableCell className={cn(CELULA, 'text-center')}>{formatCurrencyCompact(l.realizado)}</TableCell>
                          <TableCell className={cn(CELULA, 'text-center font-medium', TEXTO[cor])}>{formatCurrencyCompact(l.gap)}</TableCell>
                          <TableCell className={cn(CELULA, 'text-center font-medium', TEXTO[cor])}>{formatPercentSigned(l.gapPercent, 1)}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className={cn(CELULA, 'text-center')}>{l.meta === null ? '—' : formatPercent(l.meta, 2)}</TableCell>
                          <TableCell className={cn(CELULA, 'text-center')}>{formatPercent(l.avr, 2)}</TableCell>
                          <TableCell className={cn(CELULA, 'text-center font-medium', !semAvo && TEXTO[cor])}>
                            {semAvo ? '—' : formatPercentSigned(l.deltaPp ?? 0, 2)}
                          </TableCell>
                          <TableCell className={cn(CELULA, 'text-center font-medium', !semAvo && TEXTO[cor])}>
                            {semAvo ? '—' : formatCurrencyInteiro(l.impacto)}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  )
                })}
                <TableRow className="border-t-2 border-border bg-muted/40 font-semibold">
                  <TableCell className={CELULA}>{linhaAmbev ? 'Total (AMBEV)' : 'Total'}</TableCell>
                  {modo === 'reais' ? (
                    <>
                      <TableCell className={cn(CELULA, 'text-center')}>{formatCurrencyCompact(total.remunerado)}</TableCell>
                      <TableCell className={cn(CELULA, 'text-center')}>{formatCurrencyCompact(total.realizado)}</TableCell>
                      <TableCell className={cn(CELULA, 'text-center', TEXTO[corClasseGap(total.gap)])}>{formatCurrencyCompact(total.gap)}</TableCell>
                      <TableCell className={cn(CELULA, 'text-center', TEXTO[corClasseGap(total.gap)])}>{formatPercentSigned(total.gapPercent, 1)}</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className={cn(CELULA, 'text-center')}>{total.meta === null ? '—' : formatPercent(total.meta, 2)}</TableCell>
                      <TableCell className={cn(CELULA, 'text-center')}>{linhaAmbev ? formatPercent(total.avr, 2) : '—'}</TableCell>
                      <TableCell className={cn(CELULA, 'text-center', total.deltaPp !== null && TEXTO[corClasseGap(total.deltaPp)])}>
                        {total.deltaPp === null ? '—' : formatPercentSigned(total.deltaPp, 2)}
                      </TableCell>
                      <TableCell className={cn(CELULA, 'text-center', TEXTO[corClasseGap(total.impacto)])}>
                        {formatCurrencyInteiro(total.impacto)}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              </TableBody>
            </Table>
          </TableCard>

          <div className="rounded-xl border border-gray-200/30 bg-white/50 p-4 dark:border-gray-700/30 dark:bg-gray-800/50">
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGrafico} margin={{ top: 16, right: 16, bottom: 64, left: 0 }}>
                  <XAxis
                    dataKey="nome"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={70}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: axis, fontSize: 11, fontWeight: 500 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => modo === 'reais' ? formatCurrencyCompact(v) : `${v}%`}
                    width={56}
                    tick={{ fill: axis, fontSize: 11, fontWeight: 500 }}
                  />
                  <Tooltip content={<TooltipPorUnidade modo={modo} />} cursor={{ fill: cursor }} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, color: legend, fontWeight: 500, paddingBottom: 8 }}
                  />
                  {modo === 'reais' ? (
                    <>
                      <Bar dataKey="remunerado" name="Remunerado" fill={COR_META} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="realizado" name="Realizado" fill={COR_AVR} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </>
                  ) : (
                    <>
                      <Bar dataKey="meta" name="Meta (orçado)" fill={COR_META} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="avr" name="AVR (realizado)" fill={COR_AVR} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
