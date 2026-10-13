import { useMemo } from 'react'
import { Bar, BarChart, Cell, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { calcularReceita, normalizarParaCalculo } from '@/lib/farol-calculations'
import {
  COR_AVR, COR_META_DESTAQUE, COR_META, COR_NEGATIVO, COR_POSITIVO, MES_ABREV, TickComparativoAcumulado, corPorSemaforo,
  domainComparativo, getChartColors, type BarraComparativo,
} from '@/components/farol/chart-shared'
import { formatCurrencyCompact, formatCurrencyInteiro, formatPercent, cn } from '@/lib/utils'
import { CONTA_RECEITA } from '@/lib/constants'
import type { DreLongoRow, OrcamentoLinha } from '@/types'

interface Props {
  /** Todas as linhas da unidade selecionada, sem filtro de ano (precisa do ano anterior pro comparativo) — já filtradas pro negócio CONS. */
  rowsUnidadeCons: DreLongoRow[]
  /** Orçamento da unidade selecionada, ano atual, negócio CONS. */
  orcamentoAno: OrcamentoLinha[]
  ano: number
  mes: number
}

const MESES_12 = Array.from({ length: 12 }, (_, i) => i + 1)

/** Mesmo formato de `formatCurrencyCompact`, sem o "R$" na frente — só pro texto dentro dos gráficos (rótulo/tooltip), que já deixam claro pelo contexto que é dinheiro; a tabela e os cards continuam com "R$" normal. */
function fmtChart(v: number, digits = 1): string {
  return formatCurrencyCompact(v, digits).replace(/^R\$\s*/, '')
}

function TooltipReceita({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number | null; color: string }[]; label?: number }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
      <p className="mb-1.5 font-semibold">{MES_ABREV[label ?? 0] ?? label}</p>
      {payload.map(p => (
        <p key={p.name} className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium text-popover-foreground">{p.value != null ? fmtChart(p.value, 3) : '—'}</span>
        </p>
      ))}
    </div>
  )
}

/**
 * Receita Líquida acumulada de um ano até um mês de corte — soma o realizado
 * mês a mês (Jan até o mês de corte). Tentei antes usar a linha
 * ACUMULADO_ANO já pronta do DRE, mas ela não vem confiável pra toda
 * unidade/mês, então preferi somar direto (mesma fonte que já alimenta o
 * gráfico mensal, garante bater com ele). null = nenhum mês com dado no
 * intervalo.
 */
function receitaAcumulada(rowsUnidadeCons: DreLongoRow[], ano: number, mesCorte: number): number | null {
  let soma = 0
  let temDado = false
  for (let m = 1; m <= mesCorte; m++) {
    const rowsMes = rowsUnidadeCons.filter(r => r.ano === ano && r.tipo_periodo === 'MENSAL' && r.mes === m)
    if (rowsMes.length === 0) continue
    soma += calcularReceita(normalizarParaCalculo(rowsMes))
    temDado = true
  }
  return temDado ? soma : null
}

/**
 * Slide "Receita Líquida" do SDG Gerentes: 2 cards do mês selecionado
 * (Receita Realizada + gap vs Orçado, % de Atingimento), evolução mensal
 * (barra + linha de orçado) do ano selecionado, um comparativo acumulado
 * (ano anterior × ano atual, ambos até o mês selecionado) ao lado, e a
 * tabela mensal Realizado/Orçado/Diferença embaixo — só até o mês
 * selecionado (meses futuros nem aparecem), com uma linha final "Acumulado"
 * somando Realizado/Orçado/Diferença de Jan até ali. Mesmo padrão de
 * dado/cálculo do `SlideReceita.tsx` do SDG Corporativo (`calcularReceita`),
 * só que pra uma unidade só (não o consolidado AMBEV) e com os cards +
 * comparativo YoY a mais.
 */
export function SlideReceitaGerentes({ rowsUnidadeCons, orcamentoAno, ano, mes }: Props) {
  const { axis, legend, cursor } = getChartColors()

  const rowsAno = useMemo(() => rowsUnidadeCons.filter(r => r.ano === ano), [rowsUnidadeCons, ano])
  const orcamentoReceita = useMemo(() => orcamentoAno.filter(o => o.conta_codigo === CONTA_RECEITA), [orcamentoAno])

  const serieReceita = useMemo(() => {
    let acumuladoRealizado = 0
    let acumuladoOrcado = 0
    return MESES_12.map(m => {
      const rowsMes = rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === m)
      const realizado = rowsMes.length > 0 ? calcularReceita(normalizarParaCalculo(rowsMes)) : null
      if (realizado !== null) acumuladoRealizado += realizado
      const orcadoMes = orcamentoReceita.filter(o => o.mes === m)
      const orcado = orcadoMes.length > 0 ? orcadoMes.reduce((acc, o) => acc + o.orcado, 0) : null
      if (orcado !== null) acumuladoOrcado += orcado
      return {
        mes: m, realizado, orcado,
        acumuladoRealizado: realizado !== null ? acumuladoRealizado : null,
        acumuladoOrcado: orcado !== null ? acumuladoOrcado : null,
      }
    })
  }, [rowsAno, orcamentoReceita])

  // Cards do mês selecionado — Receita Realizada + gap vs Orçado, e % de Atingimento.
  const linhaMesSel = serieReceita[mes - 1]
  const gapMes = linhaMesSel.realizado !== null && linhaMesSel.orcado !== null ? linhaMesSel.realizado - linhaMesSel.orcado : null
  const atingimentoMes = linhaMesSel.realizado !== null && linhaMesSel.orcado ? (linhaMesSel.realizado / linhaMesSel.orcado) * 100 : null

  // Linha "Acumulado" da tabela — soma Realizado/Orçado só até o mês selecionado (não o ano inteiro, senão o Orçado dos meses futuros — que já vem preenchido — distorceria a comparação).
  const acumuladoRealizadoMes = linhaMesSel.acumuladoRealizado
  const acumuladoOrcadoMes = linhaMesSel.acumuladoOrcado
  const acumuladoDiferencaMes = acumuladoRealizadoMes !== null && acumuladoOrcadoMes !== null ? acumuladoRealizadoMes - acumuladoOrcadoMes : null

  // Comparativo YoY (gráfico ao lado) — reaproveita o mesmo acumulado do ano
  // atual já calculado acima (`acumuladoRealizadoMes`, garante bater com a
  // tabela); o ano anterior não está em `serieReceita` (que é só do ano
  // selecionado), por isso recalcula separado.
  const acumuladoAtual = acumuladoRealizadoMes
  const acumuladoAnterior = useMemo(() => receitaAcumulada(rowsUnidadeCons, ano - 1, mes), [rowsUnidadeCons, ano, mes])
  const cresceu = acumuladoAtual !== null && acumuladoAnterior !== null && acumuladoAtual >= acumuladoAnterior
  const diferencaYoY = acumuladoAtual !== null && acumuladoAnterior !== null ? acumuladoAtual - acumuladoAnterior : null
  const crescimentoPct = acumuladoAtual !== null && acumuladoAnterior !== null && acumuladoAnterior !== 0
    ? ((acumuladoAtual - acumuladoAnterior) / Math.abs(acumuladoAnterior)) * 100
    : null

  // Comparativo vs Orçado (3ª barra) — mesmo acumulado já calculado acima
  // (`acumuladoOrcadoMes`, bate com a tabela), mesma técnica de delta % + R$
  // já usada vs ano anterior.
  const cresceuVsOrcado = acumuladoAtual !== null && acumuladoOrcadoMes !== null && acumuladoAtual >= acumuladoOrcadoMes
  const diferencaOrcado = acumuladoAtual !== null && acumuladoOrcadoMes !== null ? acumuladoAtual - acumuladoOrcadoMes : null
  const crescimentoPctOrcado = acumuladoAtual !== null && acumuladoOrcadoMes !== null && acumuladoOrcadoMes !== 0
    ? ((acumuladoAtual - acumuladoOrcadoMes) / Math.abs(acumuladoOrcadoMes)) * 100
    : null

  // Ano atual fica no MEIO (referência); ano anterior à esquerda e Orçado à
  // direita, cada um com seu delta (% + R$) embaixo da barra, via
  // `TickComparativoAcumulado` (ver chart-shared.tsx).
  const barrasComparativo: BarraComparativo[] = [
    {
      rotulo: `${ano - 1}`, valor: acumuladoAnterior, cor: COR_META,
      delta: crescimentoPct === null ? undefined : {
        linhas: [`${crescimentoPct >= 0 ? '+' : ''}${crescimentoPct.toFixed(1)}%`, diferencaYoY === null ? '' : formatCurrencyInteiro(diferencaYoY)],
        positivo: cresceu,
      },
    },
    { rotulo: `${ano}`, valor: acumuladoAtual, cor: acumuladoAtual === null ? COR_META : cresceu ? COR_POSITIVO : COR_NEGATIVO },
    {
      rotulo: 'Orçado', valor: acumuladoOrcadoMes, cor: COR_META_DESTAQUE,
      delta: crescimentoPctOrcado === null ? undefined : {
        linhas: [`${crescimentoPctOrcado >= 0 ? '+' : ''}${crescimentoPctOrcado.toFixed(1)}%`, diferencaOrcado === null ? '' : formatCurrencyInteiro(diferencaOrcado)],
        positivo: cresceuVsOrcado,
      },
    },
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        {/* Cards do mês selecionado */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Receita Realizada — {MES_ABREV[mes]}/{ano}
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
              {linhaMesSel.realizado === null ? '—' : formatCurrencyInteiro(linhaMesSel.realizado)}
            </p>
            <p className={cn(
              'mt-1 text-sm font-semibold',
              gapMes === null ? 'text-muted-foreground' : gapMes >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
            )}>
              Gap do mês: {gapMes === null ? '—' : formatCurrencyInteiro(gapMes)}
            </p>
          </div>
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              % de Atingimento — {MES_ABREV[mes]}/{ano}
            </p>
            <p className={cn(
              'mt-2 text-3xl font-bold',
              atingimentoMes === null ? 'text-gray-900 dark:text-white' : atingimentoMes >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
            )}>
              {atingimentoMes === null ? '—' : formatPercent(atingimentoMes, 1)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Realizado sobre Orçado do mês</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
          {/* Gráfico principal — mensal, realizado x orçado */}
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5 lg:col-span-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Receita Líquida Operacional — {ano}
            </p>
            {/* Altura fixa em vez de flex-1/min-h-0 — dentro de um grid item o
                ResponsiveContainer pode medir 0 de altura na primeira
                renderização (grid não dá altura intrínseca pro card), o que
                deixava as barras praticamente invisíveis. Mesma solução já
                usada no SlideReceita.tsx do SDG Corporativo. */}
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={serieReceita} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
                  <XAxis dataKey="mes" tickFormatter={m => MES_ABREV[m] ?? m} tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 12, fontWeight: 500 }} />
                  <YAxis hide />
                  <Tooltip content={<TooltipReceita />} cursor={{ fill: cursor }} />
                  <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, color: legend }} />
                  <Bar dataKey="realizado" name="Realizado" radius={[4, 4, 0, 0]} barSize={28}>
                    {serieReceita.map(p => (
                      <Cell key={p.mes} fill={p.realizado === null ? COR_AVR : corPorSemaforo(p.realizado, p.orcado, 'performance')} />
                    ))}
                    <LabelList
                      dataKey="realizado"
                      position="top"
                      offset={16}
                      formatter={(v: unknown) => typeof v === 'number' ? fmtChart(v, 3) : ''}
                      style={{ fontSize: 13, fontWeight: 700 }}
                      className="fill-gray-600 dark:fill-slate-300"
                    />
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="orcado"
                    name="Orçado"
                    stroke={COR_META_DESTAQUE}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3, fill: COR_META_DESTAQUE, strokeWidth: 0 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparativo acumulado — ano anterior × ano atual, até o mês selecionado */}
          <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Acumulado até {MES_ABREV[mes]}
            </p>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barrasComparativo} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="rotulo" tickLine={false} axisLine={false} height={56} tick={<TickComparativoAcumulado barras={barrasComparativo} />} />
                  <YAxis hide domain={domainComparativo(barrasComparativo.map(b => b.valor))} />
                  <Tooltip content={<TooltipReceita />} cursor={{ fill: cursor }} />
                  <Bar dataKey="valor" name="Acumulado" radius={[4, 4, 0, 0]} barSize={36}>
                    {barrasComparativo.map(b => (
                      <Cell key={b.rotulo} fill={b.valor === null ? COR_META : b.cor} />
                    ))}
                    <LabelList
                      dataKey="valor"
                      position="top"
                      formatter={(v: unknown) => typeof v === 'number' ? fmtChart(v, 3) : '—'}
                      style={{ fontSize: 13, fontWeight: 700 }}
                      className="fill-gray-600 dark:fill-slate-300"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <TableCard titulo="Receita Líquida por mês" subtitulo={`Realizado vs Orçado — diferença em R$ · linha final acumula Jan a ${MES_ABREV[mes]}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-center">Realizado</TableHead>
                <TableHead className="text-center">Orçado</TableHead>
                <TableHead className="text-center">Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serieReceita.slice(0, mes).map(p => {
                const diferenca = p.realizado !== null && p.orcado !== null ? p.realizado - p.orcado : null
                return (
                  <TableRow key={p.mes} className="border-gray-200/30 dark:border-gray-700/30">
                    <TableCell className="text-sm">{MES_ABREV[p.mes]}</TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{p.realizado === null ? '—' : formatCurrencyInteiro(p.realizado)}</TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{p.orcado === null ? '—' : formatCurrencyInteiro(p.orcado)}</TableCell>
                    <TableCell className={cn(
                      'text-center text-sm font-semibold tabular-nums',
                      diferenca === null ? 'text-muted-foreground' : diferenca >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                    )}>
                      {diferenca === null ? '—' : formatCurrencyInteiro(diferenca)}
                    </TableCell>
                  </TableRow>
                )
              })}
              <TableRow className="border-gray-200/30 bg-muted/40 font-semibold dark:border-gray-700/30">
                <TableCell className="text-sm">Acumulado</TableCell>
                <TableCell className="text-center text-sm tabular-nums">{acumuladoRealizadoMes === null ? '—' : formatCurrencyInteiro(acumuladoRealizadoMes)}</TableCell>
                <TableCell className="text-center text-sm tabular-nums">{acumuladoOrcadoMes === null ? '—' : formatCurrencyInteiro(acumuladoOrcadoMes)}</TableCell>
                <TableCell className={cn(
                  'text-center text-sm tabular-nums',
                  acumuladoDiferencaMes === null ? 'text-muted-foreground' : acumuladoDiferencaMes >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                )}>
                  {acumuladoDiferencaMes === null ? '—' : formatCurrencyInteiro(acumuladoDiferencaMes)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </div>
  )
}
