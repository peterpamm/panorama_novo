import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { IndicadorChart } from '@/components/farol/IndicadorChart'
import {
  avrPorPrefixo, calcularImpactoFinanceiro, calcularReceita, calcularSemaforo,
  normalizarParaCalculo, type Semaforo,
} from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { acumulados, somaRemunerado } from '@/pages/sdg/abertura-conta-shared'
import {
  COR_META, COR_META_DESTAQUE, COR_NEGATIVO, COR_POSITIVO, MES_ABREV, TickComparativoAcumulado, domainComparativo, getChartColors,
  type BarraComparativo,
} from '@/components/farol/chart-shared'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { PillToggle } from '@/components/ui/pill-toggle'
import { cn, formatCurrencyInteiro, formatInteiroPtBr, formatPercent } from '@/lib/utils'
import { PACOTES } from '@/lib/constants'
import type { DreCalculoRow, DreLongoRow, OrcamentoLinha } from '@/types'

const CODIGO = '023'
const INFO = PACOTES[CODIGO]
const MESES_12 = Array.from({ length: 12 }, (_, i) => i + 1)

interface Props {
  /** Todas as linhas da unidade selecionada, sem filtro de ano (precisa do ano anterior pro comparativo acumulado) — já filtradas pro negócio CONS. */
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
 * Slide "Custos com Freteiros" do SDG Gerentes — mesmo escopo do
 * `SlideDespesaAdministrativaGerentes.tsx`: 2 cards (% Mensal e % YTD,
 * realizado x meta + gap à esquerda, gap em R$ à direita), comparativo de
 * Gastos/Receita % acumulado (ano anterior × ano atual, até o mês
 * selecionado) e a tabela mensal Meta/Realizado/Gap em R$ com linha final
 * "Acumulado" — só sem a seção "Análise por conta" (não pedida aqui, a conta
 * 023 não tem abertura por conta filha no escopo deste slide). Diferença
 * própria: o gráfico de Acompanhamento Mensal mostra REALIZADO × META em R$
 * (não AVR%) — pedido explícito do usuário, formatado sem o símbolo "R$"
 * (`formatInteiroPtBr`, ex: "100.215"), já que os dois cards continuam em %.
 *
 * Comparativo (Remunerado × Orçado) — toggle único no topo do slide (ver
 * `comparativo`/`PillToggle`) que afeta TODOS os acompanhamentos (cards,
 * gráfico R$, comparativo YTD e tabela mensal), mesmo padrão de
 * `fonteMeta`/`metaPercentPorFonte` já usado em `BlocoPacote`
 * (abertura-conta-shared.tsx). Default 'remunerado' (pedido do usuário).
 * Orçado sem cadastro pra essa conta/período vira 0 (não null) — "não foi
 * orçado nada" é uma meta real de R$ 0, não "sem dado pra comparar": com
 * Realizado negativo (custo) e Orçado 0, o Gap fica negativo (estourou do
 * zero), igual já é tratado pras contas-filha de Abertura por Conta.
 */
export function SlideCustosFreteirosGerentes({ rowsUnidadeCons, orcamentoAno, unidade, negocio, ano, mes }: Props) {
  const { cursor } = getChartColors()
  const ctx = { unidade, negocio, ano, codigo: CODIGO }
  const [comparativo, setComparativo] = useState<'remunerado' | 'orcado'>('remunerado')

  const rowsAno = useMemo(() => rowsUnidadeCons.filter(r => r.ano === ano), [rowsUnidadeCons, ano])

  function metaPercentPorFonte(calc: DreCalculoRow[] | null, receitaMes: number | null, mesAlvo: number): number | null {
    if (comparativo === 'remunerado') {
      return calc && receitaMes ? (somaRemunerado(calc, INFO.prefixos) / receitaMes) * 100 : null
    }
    return buscarMetaOrcamento(orcamentoAno, { ...ctx, mes: mesAlvo }) ?? 0
  }

  // Card mensal (%) — AVR do mês selecionado (mesmo cálculo por trás da tabela/gráfico em R$).
  const calcMes = useMemo(
    () => normalizarParaCalculo(rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === mes)),
    [rowsAno, mes],
  )
  const mensalAvr = useMemo(() => avrPorPrefixo(calcMes, INFO.prefixos), [calcMes])
  const mensalMeta = metaPercentPorFonte(calcMes, calcularReceita(calcMes), mes)
  const mensalSemaforo = calcularSemaforo(mensalAvr, mensalMeta, INFO.natureza)

  // Card YTD (%) — Custos com Freteiros acumulados / Receita acumulada, não a média ponderada do AVR mensal.
  const acumuladoAtual = useMemo(() => acumulados(rowsUnidadeCons, ano, mes, INFO.prefixos), [rowsUnidadeCons, ano, mes])
  const acumuladoAnterior = useMemo(() => acumulados(rowsUnidadeCons, ano - 1, mes, INFO.prefixos), [rowsUnidadeCons, ano, mes])
  const ytdAvrAtual = acumuladoAtual && acumuladoAtual.receita !== 0 ? (acumuladoAtual.gastos / acumuladoAtual.receita) * 100 : null
  const ytdAvrAnterior = acumuladoAnterior && acumuladoAnterior.receita !== 0 ? (acumuladoAnterior.gastos / acumuladoAnterior.receita) * 100 : null
  const ytdMeta = comparativo === 'remunerado'
    ? (acumuladoAtual && acumuladoAtual.receita !== 0 ? (acumuladoAtual.remunerado / acumuladoAtual.receita) * 100 : null)
    : (buscarMetaOrcamento(orcamentoAno, { ...ctx, mes: 0 }) ?? 0)
  const ytdSemaforo = ytdAvrAtual !== null ? calcularSemaforo(ytdAvrAtual, ytdMeta, INFO.natureza) : null

  // Comparativo acumulado (%) — Gastos/Receita YTD do ano anterior × ano atual
  // × Remunerado/Orçado (conforme o toggle). Custo: menor % é melhor, por
  // isso o "melhorou"/delta compara ao contrário do EBITDA. Ano atual fica
  // no MEIO (referência); ano anterior à esquerda e Remunerado/Orçado à
  // direita, cada um com seu delta (p.p.) embaixo da barra, via
  // `TickComparativoAcumulado` (ver chart-shared.tsx).
  const rotuloBarraMeta = comparativo === 'remunerado' ? 'Remunerado' : 'Orçado'
  const melhorou = ytdAvrAtual !== null && ytdAvrAnterior !== null && ytdAvrAtual <= ytdAvrAnterior
  const diferencaPP = ytdAvrAtual !== null && ytdAvrAnterior !== null ? ytdAvrAtual - ytdAvrAnterior : null
  const melhorouMeta = ytdAvrAtual !== null && ytdMeta !== null && ytdAvrAtual <= ytdMeta
  const diferencaPPMeta = ytdAvrAtual !== null && ytdMeta !== null ? ytdAvrAtual - ytdMeta : null
  const barrasComparativo: BarraComparativo[] = [
    {
      rotulo: `${ano - 1}`, valor: ytdAvrAnterior, cor: COR_META,
      delta: diferencaPP === null ? undefined : { linhas: [`${diferencaPP >= 0 ? '+' : ''}${diferencaPP.toFixed(1)} p.p.`], positivo: melhorou },
    },
    { rotulo: `${ano}`, valor: ytdAvrAtual, cor: ytdAvrAtual === null ? COR_META : melhorou ? COR_POSITIVO : COR_NEGATIVO },
    {
      rotulo: rotuloBarraMeta, valor: ytdMeta, cor: COR_META_DESTAQUE,
      delta: diferencaPPMeta === null ? undefined : { linhas: [`${diferencaPPMeta >= 0 ? '+' : ''}${diferencaPPMeta.toFixed(1)} p.p.`], positivo: melhorouMeta },
    },
  ]

  function TooltipComparativo({ active, payload }: { active?: boolean; payload?: { value: number | null }[] }) {
    if (!active || !payload?.length || payload[0].value == null) return null
    return (
      <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
        Custos com Freteiros / Receita: <span className="font-medium">{formatPercent(payload[0].value, 2)}</span>
      </div>
    )
  }

  // Tabela/gap em R$ — Meta x Realizado x Gap mês a mês, com acumulado
  // correndo pra linha final e pros cards. Meta em R$ vem do % de
  // `metaPercentPorFonte` (Remunerado ou Orçado, conforme o toggle)
  // multiplicado pela receita REALIZADA do próprio mês — nunca o `orcado`
  // bruto da planilha (esse reflete a receita ORÇADA, não a realizada).
  // Realizado em R$ vem do mesmo AVR% que o Farol de Metas usa
  // (`avrPorPrefixo`) multiplicado pela mesma receita, e o Gap usa
  // `calcularImpactoFinanceiro` (a MESMA função que o Farol de Metas chama
  // pro card de impacto financeiro) — garante bater com o Farol de Metas.
  const serieFreteirosRs = useMemo(() => {
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
      const metaPercent = metaPercentPorFonte(calc, receitaMes, m)
      const meta = metaPercent !== null && receitaMes !== null ? (metaPercent / 100) * receitaMes : null
      if (meta !== null) acumuladoMeta += meta
      // Gap acumulado soma o gap de CADA mês (já natureza-aware via
      // calcularImpactoFinanceiro), não `acumuladoRealizado - acumuladoMeta`
      // — pra custo essa subtração vem invertida (bom = meta > realizado),
      // e como a soma é linear, somar os gaps mensais dá o mesmo resultado
      // certo sem duplicar a lógica de sinal por natureza aqui.
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
  }, [rowsAno, orcamentoAno, unidade, ano, comparativo])

  // Gráfico de Acompanhamento Mensal — Realizado × Meta em R$ (não AVR%,
  // diferente do resto do deck), formatado sem o símbolo "R$"
  // (`formatInteiroPtBr`). Só os meses já realizados (mesmo recorte de
  // `calcularSerieAnual`) — `realizado` nunca é null nesse subconjunto (ver
  // `serieFreteirosRs` acima: só fica null quando não há linha MENSAL pro
  // mês, exatamente o filtro abaixo).
  const serieGraficoRs = useMemo(
    () => serieFreteirosRs
      .filter(p => p.realizado !== null)
      .map(p => ({ mes: p.mes, avr: p.realizado as number, meta: p.meta })),
    [serieFreteirosRs],
  )

  const linhaMesSel = serieFreteirosRs[mes - 1]
  const mensalGapRs = linhaMesSel.gap
  const acumuladoRealizadoMes = linhaMesSel.acumuladoRealizado
  const acumuladoMetaMes = linhaMesSel.acumuladoMeta
  const ytdGapRs = linhaMesSel.acumuladoGap

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        {/* Toggle Remunerado/Orçado — afeta cards, gráfico, comparativo YTD e tabela abaixo */}
        <div className="flex items-center justify-end gap-2">
          <PillToggle
            opcoes={[{ value: 'remunerado', label: 'Remunerado' }, { value: 'orcado', label: 'Orçado' }] as const}
            value={comparativo}
            onChange={setComparativo}
          />
        </div>

        {/* Cards do mês selecionado — % à esquerda, gap em R$ à direita */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
                Custos com Freteiros % — Mensal — {MES_ABREV[mes]}/{ano}
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{formatPercent(mensalAvr, 2)}</p>
              <p className={cn('mt-1 text-sm font-semibold', corSemaforo(mensalSemaforo.corClasse))}>
                {rotuloBarraMeta}: {mensalMeta === null ? '—' : formatPercent(mensalMeta, 2)}
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
                Custos com Freteiros % — Acumulado até {MES_ABREV[mes]}/{ano}
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{formatPercent(ytdAvrAtual, 2)}</p>
              <p className={cn('mt-1 text-sm font-semibold', corSemaforo(ytdSemaforo?.corClasse ?? 'semCor'))}>
                {rotuloBarraMeta}: {ytdMeta === null ? '—' : formatPercent(ytdMeta, 2)}
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
          {/* Gráfico principal — Realizado × Meta em R$ (sem símbolo "R$", ex: "100.215") */}
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5 lg:col-span-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Custos com Freteiros R$ — Acompanhamento Mensal — {ano}
            </p>
            <IndicadorChart
              serie={serieGraficoRs}
              gradientId="sdg-gerentes-custos-freteiros"
              natureza={INFO.natureza}
              nomeSerie="Realizado"
              formatter={formatInteiroPtBr}
            />
          </div>

          {/* Comparativo Gastos/Receita (%) — ano anterior × ano atual, até o mês selecionado */}
          <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Gastos/Receita Acumulado até {MES_ABREV[mes]}
            </p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barrasComparativo} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="rotulo" tickLine={false} axisLine={false} height={44} tick={<TickComparativoAcumulado barras={barrasComparativo} />} />
                  <YAxis hide domain={domainComparativo(barrasComparativo.map(b => b.valor))} />
                  <Tooltip content={<TooltipComparativo />} cursor={{ fill: cursor }} />
                  <Bar dataKey="valor" name="Gastos/Receita" radius={[4, 4, 0, 0]} barSize={36}>
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

        <TableCard
          titulo="Custos com Freteiros por mês"
          subtitulo={`${rotuloBarraMeta} (% × receita realizada) vs Realizado — gap em R$ · linha final acumula Jan a ${MES_ABREV[mes]}`}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-center">{rotuloBarraMeta}</TableHead>
                <TableHead className="text-center">Realizado</TableHead>
                <TableHead className="text-center">Gap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serieFreteirosRs.slice(0, mes).map(p => (
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
