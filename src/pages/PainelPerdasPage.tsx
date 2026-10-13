import { useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line,
  BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip as RechartsTooltip,
  Legend, LabelList, ResponsiveContainer, Customized,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { mesesAtivosNoAno } from '@/lib/farol-calculations'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { usePainelPerdasAux } from '@/hooks/usePainelPerdasAux'
import { useUnidades } from '@/hooks/useUnidades'
import {
  calcularMatrizPerdas,
  INDICADORES_PERDAS,
  type LinhaPerdas,
  type IndicadorKey,
} from '@/lib/painel-perdas-calculations'
import { formatCurrencyInteiro } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableCard } from '@/components/ui/table-card'
import { FilterLabel, filterTriggerClass } from '@/components/farol/FarolFilters'
import { getChartColors } from '@/components/farol/chart-shared'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { cn } from '@/lib/utils'
import type { DreLongoRow, MetaPerdaIndicador, PainelPerdasAux as PainelPerdasAuxRow, Unidade } from '@/types'

const MESES_NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const CORES_ANOS = ['#2a78d6', '#1baf7a', '#eda100', '#008300']
const COR_META_PERDAS = '#94a3b8'
const COR_NECESSARIO = '#f59e0b'

// ─── Formatação e cores (tab Consolidado) ────────────────────────────────────

// Tons padrão do painel (mesmos dos cards), com variante dark.
const POSITIVO = 'text-emerald-600 dark:text-emerald-400 font-semibold'
const NEGATIVO = 'text-red-600 dark:text-red-400 font-semibold'
const REFERENCIA = 'text-blue-700 dark:text-blue-400 font-semibold'

/** Valor inteiro pt-BR sem "R$" — padrão de dados das tabelas do painel. */
function fmtValor(v: number): string {
  return Math.round(v).toLocaleString('pt-BR')
}

function classeCelula(linha: LinhaPerdas, unidade: string, matriz: ReturnType<typeof calcularMatrizPerdas>): string {
  const val = linha.valores[unidade]
  if (val === null) return 'text-muted-foreground'

  if (linha.tipo === 'faturamento' || linha.tipo === 'meta_pct') return REFERENCIA

  if (linha.tipo === 'indicador' || linha.tipo === 'total') {
    return val >= 0 ? POSITIVO : NEGATIVO
  }

  if (linha.tipo === 'perdas_pct') {
    const meta = matriz.linhas.find(l => l.tipo === 'meta_pct')?.valores[unidade] ?? null
    if (meta === null) return 'text-muted-foreground font-semibold'
    return val >= meta ? POSITIVO : NEGATIVO
  }

  if (linha.tipo === 'meta_rs') {
    const total = matriz.linhas.find(l => l.tipo === 'total')?.valores[unidade] ?? null
    if (total === null || val === null) return REFERENCIA
    return total >= val ? POSITIVO : NEGATIVO
  }

  return ''
}

function formatarCelula(linha: LinhaPerdas, unidade: string): string {
  const val = linha.valores[unidade]
  if (val === null) return '—'
  if (linha.tipo === 'faturamento' || linha.tipo === 'meta_rs') return fmtValor(val)
  if (linha.tipo === 'indicador' || linha.tipo === 'total') return fmtValor(val)
  if (linha.tipo === 'perdas_pct' || linha.tipo === 'meta_pct') return `${(val * 100).toFixed(2)}%`
  return String(val)
}

// Cabeçalho de tabela crua no padrão do design system (mesmo gradiente do ui/table).
const theadNavy = 'bg-gradient-to-r from-[hsl(222,45%,20%)] to-[hsl(222,35%,30%)] dark:from-[hsl(224,28%,14%)] dark:to-[hsl(224,22%,20%)]'
// Versão sólida pros th sticky (precisam de fundo próprio ao rolar horizontalmente).
const thStickyNavy = 'bg-[hsl(222,45%,20%)] dark:bg-[hsl(224,28%,14%)]'

function isSummaryRow(tipo: LinhaPerdas['tipo']): boolean {
  return tipo !== 'indicador'
}

// ─── Cálculo de valor por unidade/indicador/mês (tab Evolução) ───────────────

function valorIndicadorUnidadeMes(
  rowsDre: DreLongoRow[],
  rowsAux: PainelPerdasAuxRow[],
  ind: (typeof INDICADORES_PERDAS)[number],
  unidade: string,
  ano: number,
  mes: number,
): number | null {
  if (ind.fonte === 'AUX') {
    const indKey = ind.key as PainelPerdasAuxRow['indicador']
    if (unidade === 'AMBEV') {
      const hasData = rowsAux.some(r => r.ano === ano && r.mes === mes && r.indicador === indKey)
      if (!hasData) return null
      return rowsAux
        .filter(r => r.ano === ano && r.mes === mes && r.indicador === indKey)
        .reduce((acc, r) => acc + r.valor, 0)
    }
    const rows = rowsAux.filter(r => r.unidade === unidade && r.ano === ano && r.mes === mes && r.indicador === indKey)
    return rows.length > 0 ? rows.reduce((acc, r) => acc + r.valor, 0) : null
  }

  const rowsU = rowsDre.filter(
    r => r.unidade === unidade && r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === ano && r.mes === mes,
  )
  if (rowsU.length === 0) return null
  return rowsU
    .filter(r => ind.contas.some(c => r.conta_codigo.startsWith(c)))
    .reduce((acc, r) => acc + (r.diferenca ?? 0), 0)
}

/**
 * Meta de Perdas (Metas > Metas de Perdas) do indicador, distribuída
 * linearmente pelo ano — a tabela metas_perdas_indicadores só guarda o total
 * anual (meta_anual, R$ negativo), então o valor "mensal" é sempre
 * meta_anual dividido pelos meses em que a unidade esteve ativa (ver
 * `mesesAtivosNoAno` — 12 pras que já operavam desde janeiro). Existe pra
 * todos os indicadores (DRE e AUX), diferente do orçamento (que só cobre
 * conta do DRE). AMBEV soma a taxa mensal já calculada de cada unidade
 * individual (não dá pra somar os meta_anual primeiro e dividir uma vez só,
 * já que cada unidade pode ter um divisor diferente — a planilha de metas de
 * perdas também não importa uma linha AMBEV própria).
 */
function metaPerdasMensal(
  metasPerdasIndicadores: MetaPerdaIndicador[],
  ind: (typeof INDICADORES_PERDAS)[number],
  unidade: string,
  ano: number,
  dataEntradaPorUnidade: Map<string, string | null>,
): number | null {
  function mensalDaUnidade(u: string): number | null {
    const rows = metasPerdasIndicadores.filter(m => m.unidade === u && m.ano === ano && m.indicador === ind.key)
    if (rows.length === 0) return null
    const metaAnual = rows.reduce((acc, m) => acc + m.meta_anual, 0)
    return metaAnual / mesesAtivosNoAno(dataEntradaPorUnidade.get(u) ?? null, ano)
  }
  if (unidade !== 'AMBEV') return mensalDaUnidade(unidade)

  const unidadesComDado = Array.from(new Set(metasPerdasIndicadores.filter(m => m.unidade !== 'AMBEV' && m.ano === ano && m.indicador === ind.key).map(m => m.unidade)))
  const mensalPorUnidade = unidadesComDado.map(mensalDaUnidade).filter((v): v is number => v !== null)
  return mensalPorUnidade.length > 0 ? mensalPorUnidade.reduce((acc, v) => acc + v, 0) : null
}

/** Total anual "cru" (sem dividir pelos meses ativos) — só pra reconstruir quanto ainda falta da meta na curva de captura (`serieCapturaPerdas`), não pra exibir como "meta mensal". */
function metaPerdasAnualTotal(
  metasPerdasIndicadores: MetaPerdaIndicador[],
  ind: (typeof INDICADORES_PERDAS)[number],
  unidade: string,
  ano: number,
): number | null {
  const rows = unidade === 'AMBEV'
    ? metasPerdasIndicadores.filter(m => m.unidade !== 'AMBEV' && m.ano === ano && m.indicador === ind.key)
    : metasPerdasIndicadores.filter(m => m.unidade === unidade && m.ano === ano && m.indicador === ind.key)
  if (rows.length === 0) return null
  return rows.reduce((acc, m) => acc + m.meta_anual, 0)
}

// ─── Tooltip do gráfico ──────────────────────────────────────────────────────

interface TooltipPayloadItem { name: string; value: number | null; color: string }

function TooltipEvolucao({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border bg-popover px-3 py-2 shadow-md text-sm min-w-[180px]">
      <p className="font-semibold mb-1 text-popover-foreground">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value != null ? formatCurrencyInteiro(p.value) : '—'}
        </p>
      ))}
    </div>
  )
}

interface AcumuladoPillDado {
  nome: string
  diffPct: number | null
  diffValor: number | null
}

/**
 * Balõezinhos com o % e o valor de diferença vs. o ano atual (verde = perda
 * menor / melhor, vermelho = perda maior / pior), pras barras de comparação
 * (ano anterior, Meta de Perdas) — a barra do ano atual não leva balão.
 *
 * Renderizado via `Customized` (não LabelList) numa altura FIXA dentro da
 * margem superior do gráfico (acima de onde qualquer barra chega),
 * independente do tamanho de cada barra — o `y` de uma barra negativa é a
 * ponta de baixo dela, não o topo, então um balão "grudado" na barra ficaria
 * no meio do gráfico em vez de no vão em branco acima das barras.
 * `xAxisMap`/`offset` vêm do próprio recharts (repassados a qualquer
 * componente usado dentro de `<Customized component={...}>`).
 */
function AcumuladoPillsOverlay({
  dados, xAxisMap, offset,
}: {
  dados?: AcumuladoPillDado[]
  xAxisMap?: Record<string, { scale?: (v: string) => number | undefined }>
  offset?: { top?: number }
}) {
  if (!dados || !xAxisMap || !offset?.top) return null
  const axis = Object.values(xAxisMap)[0]
  const scale = axis?.scale
  if (!scale) return null
  const bandwidth = (scale as unknown as { bandwidth?: () => number }).bandwidth?.() ?? 0
  const altura = 32
  // Centralizado no vão em branco da margem superior do gráfico (acima de
  // `offset.top`, onde nenhuma barra chega) — nunca dentro da área de plotagem.
  const topo = Math.max(4, (offset.top - altura) / 2)
  const isDark = document.documentElement.classList.contains('dark')

  return (
    <g>
      {dados.map(d => {
        if (d.diffPct == null || d.diffValor == null) return null
        const xBase = scale(d.nome)
        if (xBase == null) return null
        const cx = xBase + bandwidth / 2
        const positivo = d.diffValor >= 0
        const bg = positivo ? 'rgba(16,185,129,0.16)' : 'rgba(239,68,68,0.16)'
        const fg = positivo ? (isDark ? '#34d399' : '#047857') : (isDark ? '#f87171' : '#b91c1c')
        const textoPct = `${positivo ? '+' : ''}${Math.round(d.diffPct)}%`
        const textoValor = `${positivo ? '+' : ''}${Math.round(d.diffValor).toLocaleString('pt-BR')}`
        const largura = Math.max(textoPct.length, textoValor.length) * 6.6 + 16
        return (
          <g key={d.nome}>
            <rect x={cx - largura / 2} y={topo} width={largura} height={altura} rx={altura / 2} fill={bg} />
            <text x={cx} y={topo + 13} textAnchor="middle" fontSize={11} fontWeight={700} fill={fg}>{textoPct}</text>
            <text x={cx} y={topo + 25} textAnchor="middle" fontSize={9.5} fontWeight={500} fill={fg}>{textoValor}</text>
          </g>
        )
      })}
    </g>
  )
}

// ─── Tabela de evolução mensal por ano ───────────────────────────────────────

function TabelaEvolucaoAno({
  ano,
  ind,
  rowsDre,
  rowsAux,
  unidades,
  nomesUnidades,
}: {
  ano: number
  ind: (typeof INDICADORES_PERDAS)[number]
  rowsDre: DreLongoRow[]
  rowsAux: PainelPerdasAuxRow[]
  unidades: Unidade[]
  nomesUnidades: Record<string, string>
}) {
  const meses = useMemo(() => {
    const s = new Set<number>()
    if (ind.fonte === 'DRE') {
      rowsDre
        .filter(r => r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === ano)
        .forEach(r => s.add(r.mes))
    } else {
      rowsAux
        .filter(r => r.ano === ano && r.indicador === (ind.key as PainelPerdasAuxRow['indicador']))
        .forEach(r => s.add(r.mes))
    }
    return Array.from(s).sort((a, b) => a - b)
  }, [rowsDre, rowsAux, ind, ano])

  const linhasUnidades = useMemo(() => {
    const individual = new Set(
      rowsDre
        .filter(r => r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === ano && r.unidade !== 'AMBEV')
        .map(r => r.unidade),
    )
    return [...Array.from(individual).sort(), 'AMBEV'].map(u => {
      const valores = meses.map(mes => valorIndicadorUnidadeMes(rowsDre, rowsAux, ind, u, ano, mes))
      const total = valores.some(v => v !== null)
        ? valores.reduce<number>((acc, v) => acc + (v ?? 0), 0)
        : null
      return { unidade: u, valores, total }
    })
  }, [rowsDre, rowsAux, ind, ano, meses])

  if (meses.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados para {ano}.</p>
  }

  return (
    <TableCard titulo={String(ano)} subtitulo={ind.label}>
      <table className="w-full text-sm">
        <thead className={theadNavy}>
          <tr className="border-b border-white/10">
            <th className={cn('sticky left-0 z-10 px-4 py-2.5 text-left text-xs font-semibold text-white/80 min-w-[180px]', thStickyNavy)}>
              Unidade
            </th>
            {meses.map(m => (
              <th key={m} className="px-3 py-2.5 text-center text-xs font-semibold text-white/80 min-w-[90px]">
                {MESES_NOMES[m - 1]}
              </th>
            ))}
            <th className="px-3 py-2.5 text-center text-xs font-semibold text-white min-w-[100px]">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {linhasUnidades.map(({ unidade, valores, total }) => (
            <tr
              key={unidade}
              className={cn(
                'group border-b border-gray-200/30 dark:border-gray-700/30 transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-700/30',
                unidade === 'AMBEV' && 'border-t-2 border-border bg-muted/40',
              )}
            >
              <td className={cn(
                'sticky left-0 z-10 px-4 py-2 text-sm font-medium transition-colors',
                unidade === 'AMBEV'
                  ? 'bg-muted group-hover:bg-muted/80 text-foreground font-semibold'
                  : 'bg-card group-hover:bg-muted/30 text-foreground',
              )}>
                {nomesUnidades[unidade] ?? unidade}
              </td>
              {valores.map((v, i) => (
                <td
                  key={meses[i]}
                  className={cn(
                    'px-3 py-2 text-center text-sm tabular-nums',
                    v === null ? 'text-muted-foreground' : v >= 0 ? POSITIVO : NEGATIVO,
                  )}
                >
                  {v === null ? '—' : fmtValor(v)}
                </td>
              ))}
              <td className={cn(
                'px-3 py-2 text-center text-sm font-semibold tabular-nums',
                total === null ? 'text-muted-foreground' : total >= 0 ? POSITIVO : NEGATIVO,
              )}>
                {total === null ? '—' : fmtValor(total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

export function PainelPerdasPage() {
  const { rows: rowsDre, loading: loadingDre } = useDreLongoTodasUnidades()
  const { rows: rowsAux, loading: loadingAux } = usePainelPerdasAux()
  const { unidades } = useUnidades()
  const dataEntradaPorUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.data_entrada])), [unidades])

  const loading = loadingDre || loadingAux

  const anosDisponiveis = useMemo(() => {
    const s = new Set(rowsDre.filter(r => r.negocio === 'CONS').map(r => r.ano))
    return Array.from(s).sort((a, b) => b - a)
  }, [rowsDre])

  // ── Tab Consolidado ───────────────────────────────────────────────────────

  const [selAno, setSelAno] = useState<number | null>(null)
  const anoAtivo = selAno ?? anosDisponiveis[0] ?? new Date().getFullYear()

  const mesesDisponiveis = useMemo(() => {
    const s = new Set(
      rowsDre
        .filter(r => r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === anoAtivo)
        .map(r => r.mes),
    )
    return Array.from(s).sort((a, b) => a - b)
  }, [rowsDre, anoAtivo])

  const [selMeses, setSelMeses] = useState<Set<number>>(new Set())
  const mesesAtivos = useMemo(() => {
    if (selMeses.size > 0) return selMeses
    return new Set(mesesDisponiveis)
  }, [selMeses, mesesDisponiveis])

  function toggleMes(mes: number) {
    setSelMeses(prev => {
      const base = prev.size === 0 ? new Set(mesesDisponiveis) : new Set(prev)
      if (base.has(mes)) base.delete(mes)
      else base.add(mes)
      return base
    })
  }

  // Atalhos do filtro de meses — evita ter que marcar/desmarcar um por um.
  // "Mês atual" pega o mês com dado mais recente (não o mês do calendário —
  // se ainda não fechou agosto, por exemplo, o último mês com resultado
  // importado pode ser julho). "1º/2º Semestre" só considera os meses que já
  // têm dado importado (`mesesDisponiveis`) — se o 2º semestre ainda não
  // começou, o botão fica desabilitado em vez de selecionar um conjunto vazio.
  const mesMaisRecente = mesesDisponiveis[mesesDisponiveis.length - 1] ?? null
  const soMesAtualAtivo = mesMaisRecente !== null && mesesAtivos.size === 1 && mesesAtivos.has(mesMaisRecente)
  const todosAtivos = mesesAtivos.size === mesesDisponiveis.length
  const mesesSemestre1 = useMemo(() => mesesDisponiveis.filter(m => m <= 6), [mesesDisponiveis])
  const mesesSemestre2 = useMemo(() => mesesDisponiveis.filter(m => m > 6), [mesesDisponiveis])
  const semestre1Ativo = mesesSemestre1.length > 0 && mesesAtivos.size === mesesSemestre1.length && mesesSemestre1.every(m => mesesAtivos.has(m))
  const semestre2Ativo = mesesSemestre2.length > 0 && mesesAtivos.size === mesesSemestre2.length && mesesSemestre2.every(m => mesesAtivos.has(m))

  // Metas de Perdas (Metas > Metas de Perdas, por indicador) pro ano do
  // Consolidado — todas as unidades (a tabela mostra todas como coluna).
  const [metasPerdasIndicadoresConsolidado, setMetasPerdasIndicadoresConsolidado] = useState<MetaPerdaIndicador[]>([])
  useEffect(() => {
    let cancelado = false
    supabase.from('metas_perdas_indicadores').select('*').eq('ano', anoAtivo)
      .then(({ data }) => { if (!cancelado) setMetasPerdasIndicadoresConsolidado((data as MetaPerdaIndicador[]) ?? []) })
    return () => { cancelado = true }
  }, [anoAtivo])

  const matriz = useMemo(() => {
    if (rowsDre.length === 0) return null
    const mesesOrdenados = Array.from(mesesAtivos).sort((a, b) => a - b)
    return calcularMatrizPerdas(rowsDre, rowsAux, metasPerdasIndicadoresConsolidado, anoAtivo, mesesOrdenados, dataEntradaPorUnidade)
  }, [rowsDre, rowsAux, metasPerdasIndicadoresConsolidado, anoAtivo, mesesAtivos, dataEntradaPorUnidade])

  // ── Tab Evolução ──────────────────────────────────────────────────────────

  const [selIndicador, setSelIndicador] = useState<IndicadorKey>('indisponibilidade')
  const [selAnosEvo, setSelAnosEvo] = useState<Set<number>>(new Set())

  const anosEvoAtivos = useMemo(() => {
    if (selAnosEvo.size > 0) return selAnosEvo
    return new Set(anosDisponiveis.slice(0, 2))
  }, [selAnosEvo, anosDisponiveis])

  function toggleAnoEvo(ano: number) {
    setSelAnosEvo(prev => {
      const base = prev.size === 0 ? new Set(anosDisponiveis.slice(0, 2)) : new Set(prev)
      if (base.has(ano)) base.delete(ano)
      else base.add(ano)
      return base
    })
  }

  const indSel = INDICADORES_PERDAS.find(i => i.key === selIndicador) ?? INDICADORES_PERDAS[0]
  const anosEvoOrdenados = Array.from(anosEvoAtivos).sort((a, b) => a - b)

  const [selUnidadeLinhas, setSelUnidadeLinhas] = useState<string>('AMBEV')

  const nomesUnidades = useMemo(() => {
    const m: Record<string, string> = {}
    for (const u of unidades) m[u.codigo] = u.nome
    return m
  }, [unidades])

  const unidadesDisponiveisEvo = useMemo(() => {
    const s = new Set<string>()
    for (const ano of anosEvoAtivos) {
      rowsDre
        .filter(r => r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === ano && r.unidade !== 'AMBEV')
        .forEach(r => s.add(r.unidade))
    }
    return ['AMBEV', ...Array.from(s).sort()]
  }, [rowsDre, anosEvoAtivos])

  const chartData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      const ponto: Record<string, number | null | string> = { mes, mesNome: MESES_NOMES[i] }
      for (const ano of anosEvoAtivos) {
        ponto[`y${ano}`] = valorIndicadorUnidadeMes(rowsDre, rowsAux, indSel, selUnidadeLinhas, ano, mes)
      }
      return ponto
    })
  }, [rowsDre, rowsAux, indSel, anosEvoAtivos, selUnidadeLinhas])

  // ── Orçado acumulado (Administração > Orçamento) + Curva de Captura ────────
  const anosChave = anosEvoOrdenados.join(',')
  const [metasPerdasIndicadores, setMetasPerdasIndicadores] = useState<MetaPerdaIndicador[]>([])
  const [loadingMetasPerdasIndicadores, setLoadingMetasPerdasIndicadores] = useState(false)

  useEffect(() => {
    if (anosEvoOrdenados.length === 0) return
    let cancelado = false
    async function carregar() {
      setLoadingMetasPerdasIndicadores(true)
      try {
        let q = supabase.from('metas_perdas_indicadores').select('*').in('ano', anosEvoOrdenados)
        if (selUnidadeLinhas !== 'AMBEV') q = q.eq('unidade', selUnidadeLinhas)
        const { data, error } = await q
        if (error) throw new Error(error.message)
        if (!cancelado) setMetasPerdasIndicadores((data as MetaPerdaIndicador[]) ?? [])
      } finally {
        if (!cancelado) setLoadingMetasPerdasIndicadores(false)
      }
    }
    carregar()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anosChave, selUnidadeLinhas])

  const [modoGraficoEvo, setModoGraficoEvo] = useState<'mensal' | 'captura'>('mensal')

  /**
   * Acumulado do "mesmo período" pros dois anos mais recentes selecionados —
   * o corte é sempre o último mês com resultado do ano mais recente (ex: se só
   * tem dado até julho, o ano anterior também acumula só até julho, pra
   * comparação justa). A Meta de Perdas (Metas > Metas de Perdas) é anual, sem
   * quebra por mês — o acumulado dela é só meta_anual/12 × mesCorte.
   */
  const acumulado = useMemo(() => {
    if (anosEvoOrdenados.length === 0) return null
    const anoAtual = anosEvoOrdenados[anosEvoOrdenados.length - 1]
    const anoAnterior = anosEvoOrdenados.length >= 2 ? anosEvoOrdenados[anosEvoOrdenados.length - 2] : null

    const mesesComDado = Array.from({ length: 12 }, (_, i) => i + 1)
      .filter(mes => valorIndicadorUnidadeMes(rowsDre, rowsAux, indSel, selUnidadeLinhas, anoAtual, mes) !== null)
    const mesCorte = mesesComDado.length > 0 ? Math.max(...mesesComDado) : 0
    if (mesCorte === 0) return null

    function somaAcumulada(fn: (mes: number) => number | null): number | null {
      const valores = Array.from({ length: mesCorte }, (_, i) => fn(i + 1))
      if (!valores.some(v => v !== null)) return null
      return valores.reduce<number>((acc, v) => acc + (v ?? 0), 0)
    }

    const realizadoAtual = somaAcumulada(mes => valorIndicadorUnidadeMes(rowsDre, rowsAux, indSel, selUnidadeLinhas, anoAtual, mes))
    const realizadoAnterior = anoAnterior !== null
      ? somaAcumulada(mes => valorIndicadorUnidadeMes(rowsDre, rowsAux, indSel, selUnidadeLinhas, anoAnterior, mes))
      : null
    const metaMensal = metaPerdasMensal(metasPerdasIndicadores, indSel, selUnidadeLinhas, anoAtual, dataEntradaPorUnidade)
    const metaAcumulada = metaMensal !== null ? metaMensal * mesCorte : null
    const metaAnualTotal = metaPerdasAnualTotal(metasPerdasIndicadores, indSel, selUnidadeLinhas, anoAtual)

    return { anoAtual, anoAnterior, mesCorte, realizadoAtual, realizadoAnterior, metaMensal, metaAcumulada, metaAnualTotal }
  }, [anosEvoOrdenados, rowsDre, rowsAux, metasPerdasIndicadores, indSel, selUnidadeLinhas, dataEntradaPorUnidade])

  /**
   * A meta mensal entra como um dataKey de verdade (não um ReferenceLine) pra
   * aparecer no Tooltip compartilhado ao passar o mouse em qualquer ponto do
   * gráfico — um ReferenceLine não participa do payload do Tooltip.
   */
  const chartDataComMeta = useMemo(() => {
    if (acumulado?.metaMensal == null) return chartData
    const metaMensal = acumulado.metaMensal
    return chartData.map(p => ({ ...p, metaMensal }))
  }, [chartData, acumulado])

  /**
   * Diferença do ano atual em relação a uma barra de comparação (ano
   * anterior / Meta de Perdas) — o sinal sempre descreve o desempenho do ano
   * ATUAL: positivo (verde) = ano atual teve perda MENOR (valor menos
   * negativo, ou seja melhor) que a barra comparada; negativo (vermelho) =
   * ano atual perdeu mais que ela (pior).
   */
  function diffVsAtual(valorComparado: number | null, valorAtual: number | null): { diffPct: number | null; diffValor: number | null } {
    if (valorComparado === null || valorAtual === null || valorAtual === 0) return { diffPct: null, diffValor: null }
    const diffValor = valorAtual - valorComparado
    const diffPct = (diffValor / Math.abs(valorAtual)) * 100
    return { diffPct, diffValor }
  }

  const dadosBarrasAcumulado = useMemo(() => {
    if (!acumulado) return []
    const arr: { nome: string; valor: number | null; cor: string; diffPct: number | null; diffValor: number | null }[] = []
    const idxAtual = anosEvoOrdenados.indexOf(acumulado.anoAtual)
    arr.push({ nome: `${acumulado.anoAtual}`, valor: acumulado.realizadoAtual, cor: CORES_ANOS[idxAtual % CORES_ANOS.length], diffPct: null, diffValor: null })
    if (acumulado.anoAnterior !== null) {
      const idxAnterior = anosEvoOrdenados.indexOf(acumulado.anoAnterior)
      arr.push({
        nome: `${acumulado.anoAnterior}`,
        valor: acumulado.realizadoAnterior,
        cor: CORES_ANOS[idxAnterior % CORES_ANOS.length],
        ...diffVsAtual(acumulado.realizadoAnterior, acumulado.realizadoAtual),
      })
    }
    arr.push({
      nome: 'Meta de Perdas',
      valor: acumulado.metaAcumulada,
      cor: COR_META_PERDAS,
      ...diffVsAtual(acumulado.metaAcumulada, acumulado.realizadoAtual),
    })
    return arr
  }, [acumulado, anosEvoOrdenados])

  /**
   * Curva de captura: realizado MENSAL (não acumulado) × Meta mensal de Perdas
   * (linha reta, meta_anual/12) × Necessário — a partir do mês de corte, pega o
   * que ainda resta da meta anual (meta_anual − o que já foi realizado até
   * agora) e distribui igual pelos meses restantes: um ritmo mensal fixo, não
   * uma curva crescente (mesma lógica de `calcularSerieCaptura` do Farol de
   * Metas). O necessário conecta com o realizado no mês de corte (mesmo valor,
   * pra não dar salto visual) e some quando o corte é o último mês do ano.
   */
  const serieCapturaPerdas = useMemo(() => {
    if (!acumulado) return []
    const { mesCorte, anoAtual, metaMensal, realizadoAtual, metaAnualTotal } = acumulado
    const mesesRestantes = 12 - mesCorte
    const necessarioPorMes = (metaAnualTotal !== null && realizadoAtual !== null && mesesRestantes > 0)
      ? (metaAnualTotal - realizadoAtual) / mesesRestantes
      : null

    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      const realizadoMensal = valorIndicadorUnidadeMes(rowsDre, rowsAux, indSel, selUnidadeLinhas, anoAtual, mes)

      let necessarioMensal: number | null = null
      if (necessarioPorMes !== null) {
        if (mes === mesCorte) necessarioMensal = realizadoMensal
        else if (mes > mesCorte) necessarioMensal = necessarioPorMes
      }

      return {
        mes,
        mesNome: MESES_NOMES[i],
        realizadoMensal,
        metaMensalLinha: metaMensal,
        necessarioMensal,
      }
    })
  }, [acumulado, rowsDre, rowsAux, indSel, selUnidadeLinhas])

  const fmtAxis = (v: number) => {
    if (v === 0) return 'R$ 0'
    const abs = Math.abs(v)
    const sign = v < 0 ? '-' : ''
    if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(0)}k`
    return `${sign}R$ ${abs.toFixed(0)}`
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="consolidado">
        <TabsList className="bg-gray-200/70 dark:bg-gray-700/70 p-1 rounded-xl inline-flex w-full md:w-auto">
          <TabsTrigger
            value="consolidado"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex-1 md:flex-none"
          >
            Consolidado
          </TabsTrigger>
          <TabsTrigger
            value="evolucao"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex-1 md:flex-none"
          >
            Ano vs Ano
          </TabsTrigger>
        </TabsList>

        {/* ── Consolidado ── */}
        <TabsContent value="consolidado" className="space-y-6 mt-6">
          {/* Filtros no padrão navy gradiente */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[hsl(222,45%,20%)] to-[hsl(222,35%,30%)] dark:from-[hsl(224,28%,14%)] dark:to-[hsl(224,22%,20%)] shadow-xl shadow-blue-900/20 overflow-hidden">
            <div className="flex flex-wrap items-end gap-6 p-4 md:p-6">
              <div className="space-y-1.5">
                <FilterLabel>Ano</FilterLabel>
                <Select
                  value={String(anoAtivo)}
                  onValueChange={v => { setSelAno(Number(v)); setSelMeses(new Set()) }}
                >
                  <SelectTrigger className={cn('w-28', filterTriggerClass)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anosDisponiveis.map(a => (
                      <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <FilterLabel>Meses</FilterLabel>
                  <div className="flex items-center gap-0.5 rounded-lg bg-white/10 p-0.5">
                    <button
                      type="button"
                      onClick={() => setSelMeses(mesMaisRecente !== null ? new Set([mesMaisRecente]) : new Set())}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium transition whitespace-nowrap',
                        soMesAtualAtivo ? 'bg-white text-gray-900' : 'text-white/60 hover:text-white',
                      )}
                    >
                      Mês atual
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelMeses(new Set())}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium transition whitespace-nowrap',
                        todosAtivos ? 'bg-white text-gray-900' : 'text-white/60 hover:text-white',
                      )}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      disabled={mesesSemestre1.length === 0}
                      onClick={() => setSelMeses(new Set(mesesSemestre1))}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium transition whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40',
                        semestre1Ativo ? 'bg-white text-gray-900' : 'text-white/60 hover:text-white',
                      )}
                    >
                      1º Semestre
                    </button>
                    <button
                      type="button"
                      disabled={mesesSemestre2.length === 0}
                      onClick={() => setSelMeses(new Set(mesesSemestre2))}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium transition whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40',
                        semestre2Ativo ? 'bg-white text-gray-900' : 'text-white/60 hover:text-white',
                      )}
                    >
                      2º Semestre
                    </button>
                  </div>
                </div>
                <div className="flex min-h-10 flex-wrap items-center gap-3">
                  {mesesDisponiveis.map(m => (
                    <div key={m} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`mes-${m}`}
                        checked={mesesAtivos.has(m)}
                        onCheckedChange={() => toggleMes(m)}
                        className="border-white/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-gray-900"
                      />
                      <Label htmlFor={`mes-${m}`} className="text-sm cursor-pointer text-white/80">
                        {MESES_NOMES[m - 1]}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {!matriz || matriz.unidades.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado disponível para o período selecionado.</p>
          ) : (
            <TableCard
              titulo="Consolidado de Perdas"
              subtitulo={`${Array.from(mesesAtivos).sort((a, b) => a - b).map(m => MESES_NOMES[m - 1]).join(', ')} de ${anoAtivo}`}
            >
              <table className="w-full text-sm">
                <thead className={theadNavy}>
                  <tr className="border-b border-white/10">
                    <th className={cn('sticky left-0 z-10 px-4 py-3 text-left text-xs font-semibold text-white/80 min-w-[200px]', thStickyNavy)}>
                      Indicador
                    </th>
                    {matriz.unidades.map(u => (
                      <th key={u} className={cn(
                        'px-3 py-3 text-center text-xs font-semibold min-w-[110px]',
                        u === 'AMBEV' ? 'text-white' : 'text-white/80',
                      )}>
                        {nomesUnidades[u] ?? u}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matriz.linhas.map((linha, idx) => {
                    const summary = isSummaryRow(linha.tipo)
                    return (
                      <tr
                        key={linha.key}
                        className={cn(
                          'group border-b border-gray-200/30 dark:border-gray-700/30 transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-700/30',
                          summary && 'bg-muted/40',
                          summary && idx > 0 && 'border-t-2 border-border',
                        )}
                      >
                        <td className={cn(
                          'sticky left-0 z-10 px-4 py-2.5 font-medium transition-colors',
                          summary
                            ? 'bg-muted group-hover:bg-muted/80 text-muted-foreground font-semibold text-xs uppercase tracking-wide'
                            : 'bg-card group-hover:bg-muted/30 text-foreground',
                        )}>
                          {linha.label}
                        </td>
                        {matriz.unidades.map(u => (
                          <td key={u} className={cn(
                            'px-3 py-2.5 text-center text-sm tabular-nums',
                            classeCelula(linha, u, matriz),
                            u === 'AMBEV' && 'bg-muted/20',
                          )}>
                            {formatarCelula(linha, u)}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableCard>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span><span className="font-semibold text-emerald-600 dark:text-emerald-400">Verde</span> = bom (acima da meta / perda menor)</span>
            <span><span className="font-semibold text-red-600 dark:text-red-400">Vermelho</span> = ruim (abaixo da meta / perda maior)</span>
            <span><span className="font-semibold text-blue-700 dark:text-blue-400">Azul</span> = valor de referência (Faturamento / Meta)</span>
            <span><span className="text-muted-foreground">—</span> = sem dado</span>
          </div>
        </TabsContent>

        {/* ── Evolução ── */}
        <TabsContent value="evolucao" className="space-y-6 mt-6">
          {/* Filtros no padrão navy gradiente */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[hsl(222,45%,20%)] to-[hsl(222,35%,30%)] dark:from-[hsl(224,28%,14%)] dark:to-[hsl(224,22%,20%)] shadow-xl shadow-blue-900/20 overflow-hidden">
            <div className="flex flex-wrap items-end gap-6 p-4 md:p-6">
              <div className="space-y-1.5">
                <FilterLabel>Indicador</FilterLabel>
                <Select value={selIndicador} onValueChange={v => setSelIndicador(v as IndicadorKey)}>
                  <SelectTrigger className={cn('w-72', filterTriggerClass)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDICADORES_PERDAS.map(ind => (
                      <SelectItem key={ind.key} value={ind.key}>{ind.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <FilterLabel>Unidade</FilterLabel>
                <Select value={selUnidadeLinhas} onValueChange={setSelUnidadeLinhas}>
                  <SelectTrigger className={cn('w-52', filterTriggerClass)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unidadesDisponiveisEvo.map(u => (
                      <SelectItem key={u} value={u}>
                        {u === 'AMBEV' ? 'AMBEV (consolidado)' : (nomesUnidades[u] ?? u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <FilterLabel>Anos</FilterLabel>
                <div className="flex min-h-10 flex-wrap items-center gap-3">
                  {anosDisponiveis.map(ano => {
                    const colorIdx = anosEvoOrdenados.indexOf(ano)
                    const ativo = anosEvoAtivos.has(ano) && colorIdx >= 0
                    return (
                      <div key={ano} className="flex items-center gap-1.5">
                        <Checkbox
                          id={`evo-ano-${ano}`}
                          checked={anosEvoAtivos.has(ano)}
                          onCheckedChange={() => toggleAnoEvo(ano)}
                          className="border-white/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-gray-900"
                        />
                        <Label
                          htmlFor={`evo-ano-${ano}`}
                          className={cn('text-sm cursor-pointer font-medium', ativo ? 'text-white' : 'text-white/60')}
                        >
                          {ano}
                        </Label>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              {indSel.label} — {selUnidadeLinhas === 'AMBEV' ? 'AMBEV Consolidado' : (nomesUnidades[selUnidadeLinhas] ?? selUnidadeLinhas)}
            </p>
            <PillToggle
              opcoes={[
                { value: 'mensal', label: 'Evolução Mensal' },
                { value: 'captura', label: 'Curva de Captura' },
              ] as const}
              value={modoGraficoEvo}
              onChange={setModoGraficoEvo}
            />
          </div>

          {modoGraficoEvo === 'mensal' ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-lg border bg-card p-4 lg:col-span-2">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartDataComMeta} margin={{ top: 28, right: 24, left: 16, bottom: 8 }}>
                    <XAxis dataKey="mesNome" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11 }} width={80} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={(props) => <TooltipEvolucao {...(props as Parameters<typeof TooltipEvolucao>[0])} />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {acumulado?.metaMensal != null && (
                      <Line
                        type="monotone"
                        dataKey="metaMensal"
                        name="Meta mensal"
                        stroke={COR_META_PERDAS}
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={false}
                        activeDot={{ r: 5, fill: COR_META_PERDAS, strokeWidth: 0 }}
                      />
                    )}
                    {anosEvoOrdenados.map((ano, i) => (
                      <Line
                        key={ano}
                        type="monotone"
                        dataKey={`y${ano}`}
                        name={String(ano)}
                        stroke={CORES_ANOS[i % CORES_ANOS.length]}
                        strokeWidth={2}
                        dot={{ r: 3, fill: CORES_ANOS[i % CORES_ANOS.length], strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: CORES_ANOS[i % CORES_ANOS.length], strokeWidth: 0 }}
                        connectNulls={false}
                      >
                        <LabelList
                          dataKey={`y${ano}`}
                          position={i % 2 === 0 ? 'top' : 'bottom'}
                          formatter={(v: unknown) => typeof v === 'number' ? formatCurrencyInteiro(v) : ''}
                          style={{ fontSize: 9, fill: CORES_ANOS[i % CORES_ANOS.length] }}
                        />
                      </Line>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  Acumulado {acumulado ? `até ${MESES_NOMES[acumulado.mesCorte - 1]}` : ''}
                </p>
                {loadingMetasPerdasIndicadores && (
                  <p className="mb-2 text-[11px] text-muted-foreground">Carregando Meta de Perdas...</p>
                )}
                {!acumulado || dadosBarrasAcumulado.length === 0 ? (
                  <p className="flex h-[280px] items-center justify-center text-center text-sm text-muted-foreground">
                    Sem resultado no ano pra acumular.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={dadosBarrasAcumulado} margin={{ top: 56, right: 8, left: 8, bottom: 8 }}>
                      <XAxis dataKey="nome" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <RechartsTooltip
                        formatter={(v: unknown) => typeof v === 'number' ? formatCurrencyInteiro(v) : '—'}
                        cursor={{ fill: getChartColors().cursor }}
                      />
                      <Bar dataKey="valor" radius={[4, 4, 0, 0]} barSize={48}>
                        <LabelList
                          dataKey="valor"
                          position="top"
                          formatter={(v: unknown) => typeof v === 'number' ? formatCurrencyInteiro(v) : '—'}
                          style={{ fontSize: 10 }}
                        />
                        {dadosBarrasAcumulado.map((d, i) => (
                          <Cell key={i} fill={d.cor} />
                        ))}
                      </Bar>
                      <Customized dados={dadosBarrasAcumulado} component={AcumuladoPillsOverlay} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-4">
              {!acumulado ? (
                <p className="flex h-[320px] items-center justify-center text-center text-sm text-muted-foreground">
                  Sem resultado no ano pra acumular.
                </p>
              ) : (
                <>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Realizado mensal × Meta mensal de Perdas × Necessário nos meses restantes — {acumulado.anoAtual}
                  </p>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={serieCapturaPerdas} margin={{ top: 28, right: 24, left: 16, bottom: 8 }}>
                      <XAxis dataKey="mesNome" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11 }} width={80} axisLine={false} tickLine={false} />
                      <RechartsTooltip formatter={(v: unknown) => typeof v === 'number' ? formatCurrencyInteiro(v) : '—'} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line
                        type="monotone"
                        dataKey="realizadoMensal"
                        name="Realizado mensal"
                        stroke={CORES_ANOS[anosEvoOrdenados.indexOf(acumulado.anoAtual) % CORES_ANOS.length]}
                        strokeWidth={2}
                        dot={{ r: 3, fill: CORES_ANOS[anosEvoOrdenados.indexOf(acumulado.anoAtual) % CORES_ANOS.length], strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: CORES_ANOS[anosEvoOrdenados.indexOf(acumulado.anoAtual) % CORES_ANOS.length], strokeWidth: 0 }}
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="metaMensalLinha"
                        name="Meta mensal"
                        stroke={COR_META_PERDAS}
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={false}
                        activeDot={{ r: 5, fill: COR_META_PERDAS, strokeWidth: 0 }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="necessarioMensal"
                        name="Necessário nos meses restantes"
                        stroke={COR_NECESSARIO}
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        dot={{ r: 3, fill: COR_NECESSARIO, strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: COR_NECESSARIO, strokeWidth: 0 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          )}

          {/* Tabelas mensais por ano */}
          <div className="space-y-6">
            {anosEvoOrdenados.map(ano => (
              <TabelaEvolucaoAno
                key={ano}
                ano={ano}
                ind={indSel}
                rowsDre={rowsDre}
                rowsAux={rowsAux}
                unidades={unidades}
                nomesUnidades={nomesUnidades}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  )
}
