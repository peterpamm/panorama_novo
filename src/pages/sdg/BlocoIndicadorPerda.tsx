import { useMemo, useState } from 'react'
import {
  LabelList, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { PresentationCardValor } from '@/pages/sdg/PresentationCardValor'
import { usePerdaTodasUnidades } from '@/hooks/usePerdaTodasUnidades'
import { mesesAtivosNoAno } from '@/lib/farol-calculations'
import { COR_AVR, COR_META, MES_ABREV, getChartColors } from '@/components/farol/chart-shared'
import { cn, formatCurrencyCompact, formatCurrencyInteiro } from '@/lib/utils'
import type { DreLongoRow, Unidade } from '@/types'

/** Amarelo pro Orçado (Metas de Perdas) na evolução mensal — distinto do cinza do ano anterior e do roxo/azul do realizado. */
const COR_ORCAMENTO = '#eab308'

interface BlocoIndicadorPerdaProps {
  titulo: string
  /** Prefixos de conta do indicador (ex: Vales combinado = ['052','053'], só Vales Financeiros = ['052']). */
  contas: readonly string[]
  /** Linhas da unidade em todos os anos (negócio CONS, sem filtro de ano). */
  rowsTodosAnos: DreLongoRow[]
  unidadeSel: string
  unidades: Unidade[]
  ano: number
  mes: number
  /** Meta anual (Metas de Perdas) pra comparar — omitir quando esse recorte não tem orçamento próprio (ex: conta filha isolada). */
  metaAnualIndicador?: number | null
}

/** Soma da diferença (REAL−REMUN) das contas do indicador num ano/mês; null = sem dados no período. */
function valorMes(rows: DreLongoRow[], contas: readonly string[], ano: number, mes: number): number | null {
  const rowsMes = rows.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === ano && r.mes === mes)
  if (rowsMes.length === 0) return null
  return rowsMes
    .filter(r => contas.some(c => r.conta_codigo.startsWith(c)))
    .reduce((acc, r) => acc + (r.diferenca ?? 0), 0)
}

function somaYtd(rows: DreLongoRow[], contas: readonly string[], ano: number, ateMes: number): number | null {
  let soma = 0
  let temDado = false
  for (let m = 1; m <= ateMes; m++) {
    const v = valorMes(rows, contas, ano, m)
    if (v !== null) { soma += v; temDado = true }
  }
  return temDado ? soma : null
}

function TooltipPerda({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number | null; color: string }[]; label?: number | string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
      <p className="mb-1.5 font-semibold">{typeof label === 'number' ? (MES_ABREV[label] ?? label) : label}</p>
      {payload.map(p => (
        <p key={p.name} className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium text-popover-foreground">{p.value != null ? formatCurrencyInteiro(p.value) : '—'}</span>
        </p>
      ))}
    </div>
  )
}

const MESES_12 = Array.from({ length: 12 }, (_, i) => i + 1)

/**
 * Bloco reaproveitável de um indicador de perda em R$: cards mensal/YTD
 * (com Orçado quando `metaAnualIndicador` é passado), evolução vs ano
 * anterior (+ Orçado mensal em amarelo), ranking entre unidades e detalhe
 * mensal (+ linha Orçamento). Usado tanto pro indicador combinado
 * (Vales = 052+053, Multas) quanto pras contas filhas isoladas de Vales
 * (052 Vales Financeiros, 053 Vales Físicos — essas sem orçamento próprio).
 */
export function BlocoIndicadorPerda({ titulo, contas, rowsTodosAnos, unidadeSel, unidades, ano, mes, metaAnualIndicador }: BlocoIndicadorPerdaProps) {
  const anoAnterior = ano - 1
  const { axis, legend } = getChartColors()
  const { rows: rowsRanking, loading: loadingRanking } = usePerdaTodasUnidades(contas, ano)

  const temOrcamento = metaAnualIndicador !== undefined
  // Divide pelos meses em que `unidadeSel` esteve ativa no `ano` (data_entrada,
  // Administração > Unidades), não sempre por 12 — ver mesesAtivosNoAno.
  const dataEntradaSel = unidades.find(u => u.codigo === unidadeSel)?.data_entrada ?? null
  const mesesAtivos = mesesAtivosNoAno(dataEntradaSel, ano)
  const metaMensal = metaAnualIndicador != null ? metaAnualIndicador / mesesAtivos : null
  const metaYtd = metaAnualIndicador != null ? (metaAnualIndicador / mesesAtivos) * mes : null

  const valorMensal    = useMemo(() => valorMes(rowsTodosAnos, contas, ano, mes),          [rowsTodosAnos, contas, ano, mes])
  const valorMensalAnt = useMemo(() => valorMes(rowsTodosAnos, contas, anoAnterior, mes),  [rowsTodosAnos, contas, anoAnterior, mes])
  const valorYtd       = useMemo(() => somaYtd(rowsTodosAnos, contas, ano, mes),           [rowsTodosAnos, contas, ano, mes])
  const valorYtdAnt    = useMemo(() => somaYtd(rowsTodosAnos, contas, anoAnterior, mes),   [rowsTodosAnos, contas, anoAnterior, mes])

  const serieEvolucao = useMemo(
    () => MESES_12.map(m => ({
      mes: m,
      atual: valorMes(rowsTodosAnos, contas, ano, m),
      anterior: valorMes(rowsTodosAnos, contas, anoAnterior, m),
      orcado: metaMensal,
    })),
    [rowsTodosAnos, contas, ano, anoAnterior, metaMensal],
  )

  // ── Ranking entre unidades (acumulado Jan..mes, exclui AMBEV) ─────────────
  const [ordemRanking, setOrdemRanking] = useState<'piorPrimeiro' | 'melhorPrimeiro'>('piorPrimeiro')
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])
  const ranking = useMemo(() => {
    const porUnidade = new Map<string, number>()
    for (const r of rowsRanking) {
      if (r.unidade === 'AMBEV' || r.mes > mes) continue
      if (!contas.some(c => r.conta_codigo.startsWith(c))) continue
      porUnidade.set(r.unidade, (porUnidade.get(r.unidade) ?? 0) + (r.diferenca ?? 0))
    }
    // Posição fixa: 1º = melhor resultado (menor perda); a ordem de exibição é só visual.
    const doMelhorAoPior = Array.from(porUnidade.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([codigo, valor], i) => ({
        codigo,
        valor,
        posicao: i + 1,
        nome: nomesUnidades.get(codigo) ?? codigo,
        selecionada: codigo === unidadeSel,
      }))
    return ordemRanking === 'piorPrimeiro' ? [...doMelhorAoPior].reverse() : doMelhorAoPior
  }, [rowsRanking, contas, mes, nomesUnidades, unidadeSel, ordemRanking])

  // ── Tabela detalhe mensal (ano anterior + ano atual) ──────────────────────
  const linhasTabela = useMemo(
    () => [anoAnterior, ano].map(a => ({
      ano: a,
      valores: MESES_12.map(m => valorMes(rowsTodosAnos, contas, a, m)),
      total: somaYtd(rowsTodosAnos, contas, a, 12),
    })),
    [rowsTodosAnos, contas, ano, anoAnterior],
  )

  return (
    <>
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <PresentationCardValor
          nome={titulo}
          periodo={`Mensal — M${mes}`}
          valor={valorMensal}
          valorAnoAnterior={valorMensalAnt}
          anoAnterior={anoAnterior}
          orcado={temOrcamento ? metaMensal : undefined}
        />
        <PresentationCardValor
          nome={titulo}
          periodo={`Acumulado — Jan a M${mes}`}
          valor={valorYtd}
          valorAnoAnterior={valorYtdAnt}
          anoAnterior={anoAnterior}
          orcado={temOrcamento ? metaYtd : undefined}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Evolução Mensal — {ano} vs {anoAnterior}
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={serieEvolucao} margin={{ top: 28, right: 16, bottom: 0, left: 0 }}>
              <XAxis dataKey="mes" tickFormatter={m => MES_ABREV[m] ?? m} tickLine={false} axisLine={false} fontSize={12} stroke={axis} />
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip content={<TooltipPerda />} />
              <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, color: legend }} />
              <Line
                type="monotone"
                dataKey="anterior"
                name={String(anoAnterior)}
                stroke={COR_META}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              {temOrcamento && (
                <Line
                  type="monotone"
                  dataKey="orcado"
                  name="Orçado"
                  stroke={COR_ORCAMENTO}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
              <Line
                type="monotone"
                dataKey="atual"
                name={String(ano)}
                stroke={COR_AVR}
                strokeWidth={2.5}
                dot={{ r: 3, fill: COR_AVR, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: COR_AVR, strokeWidth: 0 }}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="atual"
                  position="top"
                  offset={12}
                  formatter={(v: unknown) => typeof v === 'number' ? formatCurrencyCompact(v) : ''}
                  style={{ fontSize: 10, fontWeight: 600 }}
                  className="fill-gray-600 dark:fill-slate-300"
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Ranking entre Unidades — Acumulado Jan a M{mes}
            </p>
            <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-slate-700">
              {([
                { id: 'piorPrimeiro',   label: 'Pior → Melhor' },
                { id: 'melhorPrimeiro', label: 'Melhor → Pior' },
              ] as const).map(o => (
                <button
                  key={o.id}
                  onClick={() => setOrdemRanking(o.id)}
                  className={cn(
                    'rounded-md px-2.5 py-0.5 text-xs font-medium transition whitespace-nowrap',
                    ordemRanking === o.id
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-900 dark:text-white'
                      : 'text-gray-500 dark:text-slate-400',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {loadingRanking ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-gray-400 dark:text-slate-500">
              Carregando ranking...
            </div>
          ) : ranking.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-gray-400 dark:text-slate-500">
              Sem dados de outras unidades.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-400 dark:border-slate-700 dark:text-slate-500">
                  <th className="w-12 py-2 pr-2 text-left font-medium">#</th>
                  <th className="py-2 pr-2 text-left font-medium">Unidade</th>
                  <th className="py-2 text-right font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map(r => (
                  <tr
                    key={r.codigo}
                    className={cn(
                      'border-b border-gray-100 last:border-0 dark:border-slate-700/50',
                      r.selecionada
                        ? 'bg-blue-50 shadow-[inset_3px_0_0_0] shadow-blue-500 dark:bg-blue-500/15'
                        : '',
                    )}
                  >
                    <td className={cn(
                      'py-1.5 pl-2 pr-2 tabular-nums',
                      r.selecionada ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500',
                    )}>
                      {r.posicao}º
                    </td>
                    <td className={cn(
                      'py-1.5 pr-2',
                      r.selecionada ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-slate-300',
                    )}>
                      {r.nome}
                      {r.selecionada && (
                        <span className="ml-2 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Sua unidade
                        </span>
                      )}
                    </td>
                    <td className={cn(
                      'py-1.5 pr-2 text-right tabular-nums',
                      r.selecionada ? 'font-bold' : 'font-medium',
                      r.valor >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                    )}>
                      {formatCurrencyInteiro(r.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detalhe mensal */}
      <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
          Detalhe Mensal — {nomesUnidades.get(unidadeSel) ?? unidadeSel}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-400 dark:border-slate-700 dark:text-slate-500">
                <th className="py-2 pr-3 text-left font-medium">Ano</th>
                {MESES_12.map(m => (
                  <th key={m} className="px-2 py-2 text-right font-medium">{MES_ABREV[m]}</th>
                ))}
                <th className="py-2 pl-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {linhasTabela.map(l => (
                <tr key={l.ano} className="border-b border-gray-100 last:border-0 dark:border-slate-700/50">
                  <td className={cn(
                    'py-2 pr-3 font-semibold',
                    l.ano === ano ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400',
                  )}>
                    {l.ano}
                  </td>
                  {l.valores.map((v, i) => (
                    <td key={i} className={cn(
                      'px-2 py-2 text-right tabular-nums',
                      v === null ? 'text-gray-300 dark:text-slate-600'
                        : v >= 0 ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400',
                    )}>
                      {v === null ? '—' : formatCurrencyInteiro(v)}
                    </td>
                  ))}
                  <td className={cn(
                    'py-2 pl-3 text-right font-semibold tabular-nums',
                    l.total === null ? 'text-gray-300 dark:text-slate-600'
                      : l.total >= 0 ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400',
                  )}>
                    {l.total === null ? '—' : formatCurrencyInteiro(l.total)}
                  </td>
                </tr>
              ))}
              {temOrcamento && (
                <tr className="border-b border-gray-100 bg-amber-50/50 last:border-0 dark:border-slate-700/50 dark:bg-amber-500/10">
                  <td className="py-2 pr-3 font-semibold text-amber-700 dark:text-amber-400">Orçamento</td>
                  {MESES_12.map(m => (
                    <td key={m} className="px-2 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">
                      {metaMensal === null ? '—' : formatCurrencyInteiro(metaMensal)}
                    </td>
                  ))}
                  <td className="py-2 pl-3 text-right font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                    {metaAnualIndicador == null ? '—' : formatCurrencyInteiro(metaAnualIndicador)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
