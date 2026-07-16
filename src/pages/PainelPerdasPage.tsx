import { useMemo, useState } from 'react'
import {
  LineChart, Line,
  XAxis, YAxis, Tooltip as RechartsTooltip,
  Legend, LabelList, ResponsiveContainer,
} from 'recharts'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { usePainelPerdasAux } from '@/hooks/usePainelPerdasAux'
import { useMetasPerdas } from '@/hooks/useMetasPerdas'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import type { DreLongoRow, PainelPerdasAux as PainelPerdasAuxRow, Unidade } from '@/types'

const MESES_NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const CORES_ANOS = ['#2a78d6', '#1baf7a', '#eda100', '#008300']

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
  const { metasPerdas, loading: loadingMetas } = useMetasPerdas()
  const { unidades } = useUnidades()

  const loading = loadingDre || loadingAux || loadingMetas

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

  const matriz = useMemo(() => {
    if (rowsDre.length === 0) return null
    const mesesOrdenados = Array.from(mesesAtivos).sort((a, b) => a - b)
    return calcularMatrizPerdas(rowsDre, rowsAux, metasPerdas, anoAtivo, mesesOrdenados)
  }, [rowsDre, rowsAux, metasPerdas, anoAtivo, mesesAtivos])

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
                <FilterLabel>Meses</FilterLabel>
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

          {/* Gráfico de linhas */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold text-foreground mb-4">
              {indSel.label} — {selUnidadeLinhas === 'AMBEV' ? 'AMBEV Consolidado' : (nomesUnidades[selUnidadeLinhas] ?? selUnidadeLinhas)}
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 28, right: 24, left: 16, bottom: 8 }}>
                <XAxis dataKey="mesNome" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11 }} width={80} axisLine={false} tickLine={false} />
                <RechartsTooltip content={(props) => <TooltipEvolucao {...(props as Parameters<typeof TooltipEvolucao>[0])} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {anosEvoOrdenados.map((ano, i) => (
                  <Line
                    key={ano}
                    dataKey={`y${ano}`}
                    name={String(ano)}
                    stroke={CORES_ANOS[i % CORES_ANOS.length]}
                    strokeWidth={2}
                    dot={{ r: 5, strokeWidth: 1.5 }}
                    activeDot={{ r: 7 }}
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
