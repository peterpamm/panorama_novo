import { useMemo } from 'react'
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { IndicadorChart } from '@/components/farol/IndicadorChart'
import {
  COR_META, COR_META_DESTAQUE, COR_NEGATIVO, COR_POSITIVO, MES_ABREV, TickComparativoAcumulado, domainComparativo, getChartColors,
  type BarraComparativo,
} from '@/components/farol/chart-shared'
import {
  faturamentoMes, INDICADORES_PERDAS, metaPerdasMensalTotalUnidade, valorIndicadorUnidadeMes,
} from '@/lib/painel-perdas-calculations'
import { unidadeSplitNegocio } from '@/lib/rv-gente'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { cn, formatInteiroPtBr, formatPercent } from '@/lib/utils'
import type { DreLongoRow, MetaPerdaIndicador, PainelPerdasAux } from '@/types'
import { corGapRs, MESES_12 } from './abertura-conta-shared'

interface Props {
  /** TODOS os negócios da unidade (sem filtro) — filtrado aqui dentro pelo `negocio` selecionado (ver `valorIndicadorUnidadeMes`/`faturamentoMes`). */
  rowsTodosNegocios: DreLongoRow[]
  /** Registros de `painel_perdas_aux` da unidade selecionada (indicadores Indisponibilidade/Devolução, fonte AUX). */
  rowsAux: PainelPerdasAux[]
  unidade: string
  /** Nome da unidade (o de verdade, não o rótulo CDL/CDR da apresentação) — só usado pra identificar Camaçari/Ponta Grossa em `unidadeSplitNegocio` (ver `metaZeradaArmazem`). */
  nomeUnidade: string
  /** Negócio selecionado no cabeçalho (CONS/ROTA/ARM/EMP) — filtra os 8 indicadores E o Faturamento (denominador do %). Unidade com 2 gerentes reais (Camaçari/Ponta Grossa) só vê o Realizado do próprio negócio com ROTA/ARM/EMP selecionado; CONS mostra a unidade inteira, igual sempre foi. A Meta de Perdas (`metasPerdasAno`) continua sempre da unidade inteira — não tem meta separada por negócio ainda — EXCETO no Armazém de Camaçari/Ponta Grossa, que usa 0% de propósito (ver `metaZeradaArmazem`). */
  negocio: string
  ano: number
  mes: number
  metasPerdasAno: MetaPerdaIndicador[]
  dataEntradaUnidade: string | null
}

/** Soma "null-safe" ao estilo `calcularMatrizPerdas`: null só quando TODOS os valores são null; senão trata null como 0. */
function somaNullSafe(valores: (number | null)[]): number | null {
  return valores.some(v => v !== null) ? valores.reduce<number>((acc, v) => acc + (v ?? 0), 0) : null
}

/**
 * Slide "Pacote de Perdas" do SDG Gerentes — visão consolidada dos 8
 * indicadores do Painel de Perdas (Vales, Multas, Processos Trabalhistas,
 * Desconto CIVIF, Sinistro de Frota, BNS, Indisponibilidade, Devolução).
 * Todos os 8 (+ Faturamento, denominador do %) seguem o `negocio` selecionado
 * no cabeçalho — unidade com 2 gerentes reais (Camaçari — CDL=Rota,
 * CDR=Armazém; Ponta Grossa — Empurrada/Armazém) só mostra o Realizado do
 * próprio negócio quando ROTA/ARM/EMP tá selecionado (os 6 de fonte DRE
 * batem no DRE daquele negócio direto; os 2 de fonte AUX batem na linha
 * própria daquele negócio em `painel_perdas_aux`, ver migration_131); CONS
 * mostra a unidade inteira, igual sempre foi. A Meta de Perdas continua
 * sempre da unidade inteira (ainda não existe meta por negócio) — por isso o
 * % Realizado×Meta não é 100% comparável com um negócio específico
 * selecionado (aviso disso aparece no próprio slide). Mesmo espírito da
 * seção Vales do Pacote de Gente: o que importa
 * é a dispersão/"perda" em R$ (positivo é bom, negativo = estourou), não um
 * % de custo com meta orçada. 2 cards (Total de Perdas em R$ + Meta%/
 * Realizado% do faturamento — Mês e Ano), gráfico de linha (Total × Meta,
 * mesmo padrão da seção Vales), comparativo acumulado ano anterior × atual,
 * e a tabela com um indicador por linha (+ Total e Meta no final), mês a mês
 * + Acumulado.
 */
export function SlidePacoteDePerdasGerentes({ rowsTodosNegocios, rowsAux, unidade, nomeUnidade, negocio, ano, mes, metasPerdasAno, dataEntradaUnidade }: Props) {
  const { cursor } = getChartColors()

  function construirPorMes(anoAlvo: number) {
    return INDICADORES_PERDAS.map(ind => ({
      ind,
      porMes: MESES_12.map(m => valorIndicadorUnidadeMes(rowsTodosNegocios, rowsAux, ind, unidade, anoAlvo, m, negocio)),
    }))
  }
  const matrizAtual = useMemo(() => construirPorMes(ano), [rowsTodosNegocios, rowsAux, unidade, ano, negocio])
  const matrizAnterior = useMemo(() => construirPorMes(ano - 1), [rowsTodosNegocios, rowsAux, unidade, ano, negocio])

  const totalPorMes = useMemo(() => MESES_12.map(m => somaNullSafe(matrizAtual.map(l => l.porMes[m - 1]))), [matrizAtual])
  const totalPorMesAnterior = useMemo(() => MESES_12.map(m => somaNullSafe(matrizAnterior.map(l => l.porMes[m - 1]))), [matrizAnterior])

  function acumuladoAte(porMes: (number | null)[], corte: number): number | null {
    return somaNullSafe(porMes.slice(0, corte))
  }

  /** Contorna a coluna do mês selecionado na apresentação com uma borda tracejada — cinza bem escuro no light mode, cinza claro no dark mode. `top`/`bottom` fecham o contorno na primeira/última linha da tabela. */
  function corColunaAtual(m: number, borda?: 'top' | 'bottom'): string {
    if (m !== mes) return ''
    return cn(
      'border-x-4 border-dashed border-gray-700 dark:border-gray-300',
      borda === 'top' && 'border-t-4',
      borda === 'bottom' && 'border-b-4',
    )
  }
  const totalMesAtual = totalPorMes[mes - 1]
  const totalAcumulado = acumuladoAte(totalPorMes, mes)
  const totalAcumuladoAnterior = acumuladoAte(totalPorMesAnterior, mes)

  const fatPorMes = useMemo(() => MESES_12.map(m => faturamentoMes(rowsTodosNegocios, unidade, ano, m, negocio)), [rowsTodosNegocios, unidade, ano, negocio])
  const fatMesAtual = fatPorMes[mes - 1]
  const fatAcumulado = acumuladoAte(fatPorMes, mes)

  // Orçamento de Perdas só é feito pro consolidado da unidade — unidade com
  // 2 gerentes reais (Camaçari/Ponta Grossa) não tem meta separada por
  // negócio. No lado Armazém especificamente, o volume de perdas é baixo o
  // bastante (pedido do usuário) pra considerar a meta 0% em vez de herdar a
  // meta da unidade inteira (que inflaria o "bateu meta" do Armazém sem uma
  // meta de verdade pra ele). Rota/Empurrada continuam com a meta da unidade
  // inteira, sem mudança — é onde o orçamento consolidado de fato se aplica.
  const metaZeradaArmazem = negocio === 'ARM' && unidadeSplitNegocio(unidade, nomeUnidade)
  const metaMensalTotal = useMemo(
    () => metaZeradaArmazem ? 0 : metaPerdasMensalTotalUnidade(metasPerdasAno, unidade, ano, dataEntradaUnidade),
    [metaZeradaArmazem, metasPerdasAno, unidade, ano, dataEntradaUnidade],
  )
  const metaAcumulada = metaMensalTotal !== null ? metaMensalTotal * mes : null

  const perdasPctMes = totalMesAtual !== null && fatMesAtual ? (totalMesAtual / fatMesAtual) * 100 : null
  const metaPctMes = metaMensalTotal !== null && fatMesAtual ? (metaMensalTotal / fatMesAtual) * 100 : null
  const perdasPctAno = totalAcumulado !== null && fatAcumulado ? (totalAcumulado / fatAcumulado) * 100 : null
  const metaPctAno = metaAcumulada !== null && fatAcumulado ? (metaAcumulada / fatAcumulado) * 100 : null

  const melhorou = totalAcumulado !== null && totalAcumuladoAnterior !== null && totalAcumulado >= totalAcumuladoAnterior
  const diferencaRs = totalAcumulado !== null && totalAcumuladoAnterior !== null ? totalAcumulado - totalAcumuladoAnterior : null
  const melhorouVsMeta = totalAcumulado !== null && metaAcumulada !== null && totalAcumulado >= metaAcumulada
  const diferencaMeta = totalAcumulado !== null && metaAcumulada !== null ? totalAcumulado - metaAcumulada : null

  // Ano atual fica no MEIO (referência); ano anterior à esquerda e Orçado
  // (Meta de Perdas acumulada) à direita, cada um com seu delta em R$ embaixo
  // da barra, via `TickComparativoAcumulado` (ver chart-shared.tsx).
  const barrasComparativo: BarraComparativo[] = [
    {
      rotulo: `${ano - 1}`, valor: totalAcumuladoAnterior, cor: COR_META,
      delta: diferencaRs === null ? undefined : { linhas: [`${diferencaRs >= 0 ? '+' : ''}${formatInteiroPtBr(diferencaRs)}`], positivo: melhorou },
    },
    { rotulo: `${ano}`, valor: totalAcumulado, cor: totalAcumulado === null ? COR_META : melhorou ? COR_POSITIVO : COR_NEGATIVO },
    {
      rotulo: 'Orçado', valor: metaAcumulada, cor: COR_META_DESTAQUE,
      delta: diferencaMeta === null ? undefined : { linhas: [`${diferencaMeta >= 0 ? '+' : ''}${formatInteiroPtBr(diferencaMeta)}`], positivo: melhorouVsMeta },
    },
  ]

  function TooltipComparativo({ active, payload }: { active?: boolean; payload?: { value: number | null }[] }) {
    if (!active || !payload?.length || payload[0].value == null) return null
    return (
      <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
        Total de Perdas: <span className="font-medium">{formatInteiroPtBr(payload[0].value)}</span>
      </div>
    )
  }

  const serieMensal = useMemo(() => {
    const mesesComDado = MESES_12.filter(m => totalPorMes[m - 1] !== null)
    return mesesComDado.map(m => ({ mes: m, avr: totalPorMes[m - 1] as number, meta: metaMensalTotal }))
  }, [totalPorMes, metaMensalTotal])

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        {negocio !== 'CONS' && (
          <p className="text-center text-xs italic text-gray-400 dark:text-slate-500">
            {metaZeradaArmazem
              ? 'Realizado é só do Armazém — Meta considerada 0% nesse negócio (o orçamento de Perdas é feito só pro consolidado da unidade).'
              : 'Realizado é só do negócio selecionado — a Meta de Perdas é da unidade inteira (ainda não tem meta separada por negócio).'}
          </p>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Total de Perdas — Mês — {MES_ABREV[mes]}/{ano}
            </p>
            <p className={cn('mt-2 text-3xl font-bold', corGapRs(totalMesAtual))}>
              {totalMesAtual === null ? '—' : formatInteiroPtBr(totalMesAtual)}
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-400 dark:text-slate-500">
              Meta: {metaPctMes === null ? '—' : formatPercent(metaPctMes, 2)}
              {' · '}
              Realizado: {perdasPctMes === null ? '—' : formatPercent(perdasPctMes, 2)}
            </p>
          </div>
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Total de Perdas — Ano
            </p>
            <p className={cn('mt-2 text-3xl font-bold', corGapRs(totalAcumulado))}>
              {totalAcumulado === null ? '—' : formatInteiroPtBr(totalAcumulado)}
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-400 dark:text-slate-500">
              Meta: {metaPctAno === null ? '—' : formatPercent(metaPctAno, 2)}
              {' · '}
              Realizado: {perdasPctAno === null ? '—' : formatPercent(perdasPctAno, 2)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5 lg:col-span-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Total de Perdas — Acompanhamento Mensal — {ano}
            </p>
            <IndicadorChart
              serie={serieMensal}
              gradientId="sdg-gerentes-pacote-de-perdas"
              natureza="performance"
              nomeSerie="Total de Perdas"
              nomeMeta="Orçado"
              formatter={formatInteiroPtBr}
            />
          </div>

          <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Acumulado até {MES_ABREV[mes]}
            </p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barrasComparativo} margin={{ top: 24, right: 8, bottom: 8, left: 0 }}>
                  <XAxis dataKey="rotulo" tickLine={false} axisLine={false} height={44} tick={<TickComparativoAcumulado barras={barrasComparativo} />} />
                  {/* Domínio com folga proporcional ao INTERVALO — ver
                      `domainComparativo` em chart-shared.tsx. Sem isso, uma
                      barra pertinho de zero (comum quando um ano é levemente
                      negativo e o outro bem positivo) cola o rótulo no eixo X. */}
                  <YAxis hide domain={domainComparativo(barrasComparativo.map(b => b.valor))} />
                  <Tooltip content={<TooltipComparativo />} cursor={{ fill: cursor }} />
                  <Bar dataKey="valor" name="Total de Perdas" radius={[4, 4, 0, 0]} barSize={36}>
                    {barrasComparativo.map(b => (
                      <Cell key={b.rotulo} fill={b.valor === null ? COR_META : b.cor} />
                    ))}
                    <LabelList
                      dataKey="valor"
                      position="top"
                      formatter={(v: unknown) => typeof v === 'number' ? formatInteiroPtBr(v) : '—'}
                      style={{ fontSize: 13, fontWeight: 700 }}
                      className="fill-gray-600 dark:fill-slate-300"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <TableCard titulo="Pacote de Perdas por mês" subtitulo="Total de Perdas por indicador — vermelho = estourou · Acumulado soma Jan até o mês selecionado">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                {MESES_12.map(m => (
                  <TableHead key={m} className={cn('text-center', corColunaAtual(m, 'top'))}>{MES_ABREV[m]}</TableHead>
                ))}
                <TableHead className="text-center">Acumulado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrizAtual.map(l => {
                const acumuladoIndicador = acumuladoAte(l.porMes, mes)
                return (
                  <TableRow key={l.ind.key} className="border-gray-200/30 bg-white dark:border-gray-700/30 dark:bg-transparent">
                    <TableCell className="text-sm">{l.ind.label}</TableCell>
                    {l.porMes.map((v, i) => (
                      <TableCell key={i} className={cn('text-center text-sm tabular-nums', i + 1 > mes ? 'text-muted-foreground' : corGapRs(v), corColunaAtual(i + 1))}>
                        {i + 1 > mes || v === null ? '—' : formatInteiroPtBr(v)}
                      </TableCell>
                    ))}
                    <TableCell className={cn('text-center text-sm font-semibold tabular-nums', corGapRs(acumuladoIndicador))}>
                      {acumuladoIndicador === null ? '—' : formatInteiroPtBr(acumuladoIndicador)}
                    </TableCell>
                  </TableRow>
                )
              })}
              <TableRow className="border-y-2 border-gray-300/80 bg-gray-100/80 font-semibold dark:border-gray-600/80 dark:bg-slate-700/40 [&>td]:py-3">
                <TableCell className="text-sm font-bold text-gray-900 dark:text-slate-50">Total</TableCell>
                {totalPorMes.map((v, i) => (
                  <TableCell key={i} className={cn('text-center text-sm font-semibold tabular-nums', i + 1 > mes ? 'text-muted-foreground' : corGapRs(v), corColunaAtual(i + 1))}>
                    {i + 1 > mes || v === null ? '—' : formatInteiroPtBr(v)}
                  </TableCell>
                ))}
                <TableCell className={cn('text-center text-sm font-bold tabular-nums', corGapRs(totalAcumulado))}>
                  {totalAcumulado === null ? '—' : formatInteiroPtBr(totalAcumulado)}
                </TableCell>
              </TableRow>
              <TableRow className="border-b-2 border-gray-300/80 bg-gray-100/50 italic dark:border-gray-600/80 dark:bg-slate-800/40 [&>td]:py-2.5">
                <TableCell className="text-sm italic text-muted-foreground">Meta</TableCell>
                {MESES_12.map(m => (
                  <TableCell key={m} className={cn('text-center text-sm italic tabular-nums text-muted-foreground', corColunaAtual(m, 'bottom'))}>
                    {m > mes || metaMensalTotal === null ? '—' : formatInteiroPtBr(metaMensalTotal)}
                  </TableCell>
                ))}
                <TableCell className="text-center text-sm italic font-semibold tabular-nums text-muted-foreground">
                  {metaAcumulada === null ? '—' : formatInteiroPtBr(metaAcumulada)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </div>
  )
}
