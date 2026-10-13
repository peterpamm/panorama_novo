import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CurvaCapturaToggle } from '@/components/farol/CurvaCapturaToggle'
import { IndicadorChart } from '@/components/farol/IndicadorChart'
import {
  avrPorPrefixo, calcularImpactoFinanceiro, calcularReceita, calcularSemaforo, calcularSerieAnual, calcularSerieCaptura,
  normalizarParaCalculo, type Semaforo,
} from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import {
  COR_META, COR_META_DESTAQUE, COR_NEGATIVO, COR_POSITIVO, MES_ABREV, TickComparativoAcumulado, domainComparativo, getChartColors,
  type BarraComparativo,
} from '@/components/farol/chart-shared'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { cn, formatCurrencyInteiro, formatPercent } from '@/lib/utils'
import { PACOTES } from '@/lib/constants'
import type { DreLongoRow, OrcamentoLinha } from '@/types'

const CODIGO = '233'
const INFO = PACOTES[CODIGO]
const MESES_12 = Array.from({ length: 12 }, (_, i) => i + 1)

interface Props {
  /** Todas as linhas da unidade selecionada, sem filtro de ano (precisa do ano anterior pro comparativo acumulado) — já filtradas pro `negocio` selecionado (CONS por padrão, ou Rota/Armazém). */
  rowsUnidadeCons: DreLongoRow[]
  /** Orçamento da unidade selecionada, ano atual, mesmo `negocio` selecionado. */
  orcamentoAno: OrcamentoLinha[]
  /** Código da unidade (chave de busca do orçamento) — `buscarMetaOrcamento` filtra por ele, não pelo nome. */
  unidade: string
  /** CONS (padrão) | ROTA | ARM — filtro de negócio escolhido no cabeçalho da apresentação. */
  negocio: string
  ano: number
  mes: number
}

function corSemaforo(corClasse: Semaforo['corClasse']): string {
  return corClasse === 'positivo' ? 'text-emerald-600 dark:text-emerald-400'
    : corClasse === 'negativo' ? 'text-red-600 dark:text-red-400'
    : 'text-muted-foreground'
}

function corGapRs(gap: number | null): string {
  return gap === null ? 'text-muted-foreground' : gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
}

/**
 * EBITDA (R$, conta 233) e Receita Líquida (R$) acumulados de Jan até
 * `mesCorte` num ano — soma o realizado mês a mês, mesma técnica (e mesmo
 * motivo: a linha ACUMULADO_ANO do DRE não vem confiável pra toda unidade/
 * mês) já usada em `SlideReceitaGerentes.tsx`. Receita entra junto porque a
 * margem (%) = EBITDA acumulado / Receita acumulada — não dá pra usar a
 * média ponderada do AVR mensal aqui, ela distorce quando a receita varia de
 * mês pra mês. null = nenhum mês com dado no intervalo.
 *
 * EBITDA em R$ aqui vem do AVR% × receita (igual `serieEbitdaRs` mais
 * abaixo), NÃO de `somaReal` — `real`/`remun` em `DreCalculoRow` são sempre
 * magnitude (abs, ver `normalizarParaCalculo`), então um mês de EBITDA
 * negativo (ex: Cascavel teve março/julho/agosto negativos em 2025) somava
 * como positivo e inflava o acumulado (chegava a mostrar 7,86% em vez de
 * 4,23% real). O AVR% já vem com o sinal certo do GInfo, então multiplicar
 * pela receita preserva meses negativos corretamente.
 */
function acumulados(rowsUnidadeCons: DreLongoRow[], ano: number, mesCorte: number): { ebitda: number; receita: number } | null {
  let ebitda = 0
  let receita = 0
  let temDado = false
  for (let m = 1; m <= mesCorte; m++) {
    const rowsMes = rowsUnidadeCons.filter(r => r.ano === ano && r.tipo_periodo === 'MENSAL' && r.mes === m)
    if (rowsMes.length === 0) continue
    const calc = normalizarParaCalculo(rowsMes)
    const receitaMes = calcularReceita(calc)
    const avrMes = avrPorPrefixo(calc, INFO.prefixos)
    ebitda += (avrMes / 100) * receitaMes
    receita += receitaMes
    temDado = true
  }
  return temDado ? { ebitda, receita } : null
}

/**
 * Slide "EBITDA" do SDG Gerentes: 2 cards (% Mensal e % YTD, realizado x
 * meta + gap em p.p. à esquerda, gap em R$ à direita), o mesmo gráfico de
 * linhas suavizadas (Realizado x Meta) já usado no Farol de Metas/SDG
 * Financeiro (`IndicadorChart`), um comparativo de margem % acumulada (ano
 * anterior × ano atual, até o mês selecionado) ao lado, e embaixo a tabela
 * mensal Orçado/Realizado/Gap em R$ — só até o mês selecionado, com uma
 * linha final "Acumulado" (mesmo padrão da tabela do slide de Receita
 * Líquida).
 */
export function SlideEbitdaGerentes({ rowsUnidadeCons, orcamentoAno, unidade, negocio, ano, mes }: Props) {
  const { cursor } = getChartColors()
  const ctx = { unidade, negocio, ano, codigo: CODIGO }

  const rowsAno = useMemo(() => rowsUnidadeCons.filter(r => r.ano === ano), [rowsUnidadeCons, ano])

  // Card mensal (%) — AVR do mês selecionado (mesmo cálculo por trás de cada ponto do gráfico de linhas).
  const calcMes = useMemo(
    () => normalizarParaCalculo(rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === mes)),
    [rowsAno, mes],
  )
  const mensalAvr = useMemo(() => avrPorPrefixo(calcMes, INFO.prefixos), [calcMes])
  const mensalMeta = buscarMetaOrcamento(orcamentoAno, { ...ctx, mes })
  const mensalSemaforo = calcularSemaforo(mensalAvr, mensalMeta, INFO.natureza)

  // Card YTD (%) — margem real (EBITDA acumulado / Receita acumulada), não a média ponderada do AVR mensal.
  const acumuladoAtual = useMemo(() => acumulados(rowsUnidadeCons, ano, mes), [rowsUnidadeCons, ano, mes])
  const acumuladoAnterior = useMemo(() => acumulados(rowsUnidadeCons, ano - 1, mes), [rowsUnidadeCons, ano, mes])
  const ytdAvrAtual = acumuladoAtual && acumuladoAtual.receita !== 0 ? (acumuladoAtual.ebitda / acumuladoAtual.receita) * 100 : null
  const ytdAvrAnterior = acumuladoAnterior && acumuladoAnterior.receita !== 0 ? (acumuladoAnterior.ebitda / acumuladoAnterior.receita) * 100 : null
  const ytdMeta = buscarMetaOrcamento(orcamentoAno, { ...ctx, mes: 0 })
  const ytdSemaforo = ytdAvrAtual !== null ? calcularSemaforo(ytdAvrAtual, ytdMeta, INFO.natureza) : null

  // Gráfico de linhas — série mensal do ano, meta sempre vinda do Orçamento (nunca da tabela metas/AVO do DRE).
  const serieAnual = useMemo(() => {
    const base = calcularSerieAnual(rowsAno, [], { ...ctx, prefixos: INFO.prefixos })
    return base.map(ponto => ({ ...ponto, meta: buscarMetaOrcamento(orcamentoAno, { ...ctx, mes: ponto.mes }) }))
  }, [rowsAno, orcamentoAno, unidade, ano])

  // Curva de Captura (ritmo necessário) — linha amarela tracejada extra, ligada pelo radio "Meta"/"Curva de Captura".
  const [mostrarCurva, setMostrarCurva] = useState(false)
  const serieCaptura = useMemo(
    () => calcularSerieCaptura(rowsAno, [], orcamentoAno, { ...ctx, prefixos: INFO.prefixos, natureza: INFO.natureza }, ytdMeta),
    [rowsAno, orcamentoAno, unidade, ano, ytdMeta],
  )

  // Comparativo acumulado (%) — margem YTD do ano anterior × ano atual ×
  // Orçado, todos até o mês selecionado. Ano atual fica no MEIO (referência);
  // ano anterior à esquerda e Orçado à direita, cada um com seu próprio delta
  // (p.p.) embaixo da barra, via `TickComparativoAcumulado` (ver chart-shared.tsx).
  const cresceuMargem = ytdAvrAtual !== null && ytdAvrAnterior !== null && ytdAvrAtual >= ytdAvrAnterior
  const cresceuMargemVsOrcado = ytdAvrAtual !== null && ytdMeta !== null && ytdAvrAtual >= ytdMeta
  const diferencaPP = ytdAvrAtual !== null && ytdAvrAnterior !== null ? ytdAvrAtual - ytdAvrAnterior : null
  const diferencaPPOrcado = ytdAvrAtual !== null && ytdMeta !== null ? ytdAvrAtual - ytdMeta : null
  const barrasComparativo: BarraComparativo[] = [
    {
      rotulo: `${ano - 1}`, valor: ytdAvrAnterior, cor: COR_META,
      delta: diferencaPP === null ? undefined : { linhas: [`${diferencaPP >= 0 ? '+' : ''}${diferencaPP.toFixed(1)} p.p.`], positivo: cresceuMargem },
    },
    { rotulo: `${ano}`, valor: ytdAvrAtual, cor: ytdAvrAtual === null ? COR_META : cresceuMargem ? COR_POSITIVO : COR_NEGATIVO },
    {
      rotulo: 'Orçado', valor: ytdMeta, cor: COR_META_DESTAQUE,
      delta: diferencaPPOrcado === null ? undefined : { linhas: [`${diferencaPPOrcado >= 0 ? '+' : ''}${diferencaPPOrcado.toFixed(1)} p.p.`], positivo: cresceuMargemVsOrcado },
    },
  ]

  function TooltipComparativo({ active, payload }: { active?: boolean; payload?: { value: number | null }[] }) {
    if (!active || !payload?.length || payload[0].value == null) return null
    return (
      <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
        Margem EBITDA: <span className="font-medium">{formatPercent(payload[0].value, 2)}</span>
      </div>
    )
  }

  // Tabela/gap em R$ — Meta x Realizado x Gap mês a mês, com acumulado
  // correndo pra linha final e pros cards. Meta em R$ NÃO é o `orcado` bruto
  // da planilha (esse reflete a receita ORÇADA, não a realizada) — é o %
  // orçado (`buscarMetaOrcamento`) multiplicado pela receita REALIZADA do
  // próprio mês. Realizado em R$ também não é o `real` bruto da conta 233 —
  // é o AVR% (mesmo `avrPorPrefixo` que o Farol de Metas usa) multiplicado
  // pela mesma receita, e o Gap usa `calcularImpactoFinanceiro` (a MESMA
  // função que o Farol de Metas chama pro card de impacto financeiro) — sem
  // isso o gap em R$ daqui batia quase certo com o Farol de Metas mas não
  // exatamente (AVR% importado do GInfo já vem arredondado, então
  // recalcular o realizado a partir do `real` bruto reintroduz um resíduo de
  // arredondamento que o Farol de Metas não tem).
  const serieEbitdaRs = useMemo(() => {
    let acumuladoRealizado = 0
    let acumuladoMeta = 0
    let acumuladoGap = 0
    return MESES_12.map(m => {
      const rowsMes = rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === m)
      const calc = rowsMes.length > 0 ? normalizarParaCalculo(rowsMes) : null
      const receitaMes = calc ? calcularReceita(calc) : null
      const avr = calc ? avrPorPrefixo(calc, INFO.prefixos) : null
      const realizado = avr !== null && receitaMes !== null ? (avr / 100) * receitaMes : null
      if (realizado !== null) acumuladoRealizado += realizado
      const metaPercent = buscarMetaOrcamento(orcamentoAno, { ...ctx, mes: m })
      const meta = metaPercent !== null && receitaMes !== null ? (metaPercent / 100) * receitaMes : null
      if (meta !== null) acumuladoMeta += meta
      // Gap acumulado soma o gap de CADA mês (já natureza-aware via
      // calcularImpactoFinanceiro), não `acumuladoRealizado - acumuladoMeta`
      // — essa subtração só dá certo pra natureza 'performance' (EBITDA);
      // pra custo ela vem invertida. Como a soma é linear, somar os gaps
      // mensais dá o mesmo resultado certo sem duplicar a lógica de sinal
      // por natureza aqui (ver SlideGastosTotaisGerentes.tsx).
      const gap = avr !== null && metaPercent !== null && receitaMes !== null
        ? calcularImpactoFinanceiro(avr, metaPercent, receitaMes, INFO.natureza)
        : null
      if (gap !== null) acumuladoGap += gap
      return {
        mes: m, realizado, meta, gap,
        acumuladoRealizado: realizado !== null ? acumuladoRealizado : null,
        acumuladoMeta: meta !== null ? acumuladoMeta : null,
        acumuladoGap: gap !== null ? acumuladoGap : null,
      }
    })
  }, [rowsAno, orcamentoAno, unidade, ano])

  const linhaMesSel = serieEbitdaRs[mes - 1]
  const mensalGapRs = linhaMesSel.gap
  const acumuladoRealizadoMes = linhaMesSel.acumuladoRealizado
  const acumuladoMetaMes = linhaMesSel.acumuladoMeta
  const ytdGapRs = linhaMesSel.acumuladoGap

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        {/* Cards do mês selecionado — % à esquerda, gap em R$ à direita */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
                EBITDA % — Mensal — {MES_ABREV[mes]}/{ano}
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{formatPercent(mensalAvr, 2)}</p>
              <p className={cn('mt-1 text-sm font-semibold', corSemaforo(mensalSemaforo.corClasse))}>
                Meta: {mensalMeta === null ? '—' : formatPercent(mensalMeta, 2)}
                {' · '}
                Gap: {mensalSemaforo.delta === null ? '—' : formatPercent(mensalSemaforo.delta, 2)}
              </p>
            </div>
            <div className="shrink-0 border-l border-gray-200 pl-4 text-right dark:border-slate-700">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">Gap R$</p>
              <p className={cn('text-xl font-bold', corGapRs(mensalGapRs))}>
                {mensalGapRs === null ? '—' : formatCurrencyInteiro(mensalGapRs)}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
                EBITDA % — Acumulado até {MES_ABREV[mes]}/{ano}
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{formatPercent(ytdAvrAtual, 2)}</p>
              <p className={cn('mt-1 text-sm font-semibold', corSemaforo(ytdSemaforo?.corClasse ?? 'semCor'))}>
                Meta: {ytdMeta === null ? '—' : formatPercent(ytdMeta, 2)}
                {' · '}
                Gap: {ytdSemaforo?.delta == null ? '—' : formatPercent(ytdSemaforo.delta, 2)}
              </p>
            </div>
            <div className="shrink-0 border-l border-gray-200 pl-4 text-right dark:border-slate-700">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">Gap R$</p>
              <p className={cn('text-xl font-bold', corGapRs(ytdGapRs))}>
                {ytdGapRs === null ? '—' : formatCurrencyInteiro(ytdGapRs)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
          {/* Gráfico principal — linhas suavizadas, AVR mensal x Meta */}
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5 lg:col-span-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
                EBITDA % — Acompanhamento Mensal — {ano}
              </p>
              <CurvaCapturaToggle mostrar={mostrarCurva} onChange={setMostrarCurva} idPrefix="sdg-gerentes-ebitda" />
            </div>
            <IndicadorChart
              serie={serieAnual}
              gradientId="sdg-gerentes-ebitda"
              natureza={INFO.natureza}
              nomeSerie="Realizado"
              serieCaptura={serieCaptura}
              mostrarCurvaCaptura={mostrarCurva}
            />
          </div>

          {/* Comparativo de margem (%) — ano anterior × ano atual, até o mês selecionado */}
          <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Margem Acumulada até {MES_ABREV[mes]}
            </p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barrasComparativo} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="rotulo" tickLine={false} axisLine={false} height={44} tick={<TickComparativoAcumulado barras={barrasComparativo} />} />
                  <YAxis hide domain={domainComparativo(barrasComparativo.map(b => b.valor))} />
                  <Tooltip content={<TooltipComparativo />} cursor={{ fill: cursor }} />
                  <Bar dataKey="valor" name="Margem" radius={[4, 4, 0, 0]} barSize={36}>
                    {barrasComparativo.map(b => (
                      <Cell key={b.rotulo} fill={b.valor === null ? COR_META : b.cor} />
                    ))}
                    <LabelList
                      dataKey="valor"
                      position="top"
                      formatter={(v: unknown) => typeof v === 'number' ? formatPercent(v, 2) : '—'}
                      style={{ fontSize: 13, fontWeight: 700 }}
                      className="fill-gray-600 dark:fill-slate-300"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <TableCard titulo="EBITDA por mês" subtitulo={`Meta (% orçado × receita realizada) vs Realizado — gap em R$ · linha final acumula Jan a ${MES_ABREV[mes]}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-center">Meta</TableHead>
                <TableHead className="text-center">Realizado</TableHead>
                <TableHead className="text-center">Gap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serieEbitdaRs.slice(0, mes).map(p => (
                <TableRow key={p.mes} className="border-gray-200/30 dark:border-gray-700/30">
                  <TableCell className="text-sm">{MES_ABREV[p.mes]}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{p.meta === null ? '—' : formatCurrencyInteiro(p.meta)}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{p.realizado === null ? '—' : formatCurrencyInteiro(p.realizado)}</TableCell>
                  <TableCell className={cn('text-center text-sm font-semibold tabular-nums', corGapRs(p.gap))}>
                    {p.gap === null ? '—' : formatCurrencyInteiro(p.gap)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-gray-200/30 bg-muted/40 font-semibold dark:border-gray-700/30">
                <TableCell className="text-sm">Acumulado</TableCell>
                <TableCell className="text-center text-sm tabular-nums">{acumuladoMetaMes === null ? '—' : formatCurrencyInteiro(acumuladoMetaMes)}</TableCell>
                <TableCell className="text-center text-sm tabular-nums">{acumuladoRealizadoMes === null ? '—' : formatCurrencyInteiro(acumuladoRealizadoMes)}</TableCell>
                <TableCell className={cn('text-center text-sm tabular-nums', corGapRs(ytdGapRs))}>
                  {ytdGapRs === null ? '—' : formatCurrencyInteiro(ytdGapRs)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </div>
  )
}
