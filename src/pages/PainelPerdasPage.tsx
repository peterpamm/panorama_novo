import { useMemo, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import type { DreLongoRow, PainelPerdasAux as PainelPerdasAuxRow, Unidade } from '@/types'

const MESES_NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_NOMES_COMPLETOS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const CORES_ANOS = ['#2a78d6', '#1baf7a', '#eda100', '#008300']

// ─── Formatação e cores (tab Consolidado) ────────────────────────────────────

function classeCelula(linha: LinhaPerdas, unidade: string, matriz: ReturnType<typeof calcularMatrizPerdas>): string {
  const val = linha.valores[unidade]
  if (val === null) return 'text-muted-foreground'

  if (linha.tipo === 'faturamento' || linha.tipo === 'meta_pct') return 'text-blue-700 font-semibold'

  if (linha.tipo === 'indicador' || linha.tipo === 'total') {
    return val >= 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'
  }

  if (linha.tipo === 'perdas_pct') {
    const meta = matriz.linhas.find(l => l.tipo === 'meta_pct')?.valores[unidade] ?? null
    if (meta === null) return 'text-muted-foreground font-semibold'
    return val >= meta ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'
  }

  if (linha.tipo === 'meta_rs') {
    const total = matriz.linhas.find(l => l.tipo === 'total')?.valores[unidade] ?? null
    if (total === null || val === null) return 'text-blue-700 font-semibold'
    return total >= val ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'
  }

  return ''
}

function formatarCelula(linha: LinhaPerdas, unidade: string): string {
  const val = linha.valores[unidade]
  if (val === null) return '—'
  if (linha.tipo === 'faturamento' || linha.tipo === 'meta_rs') return formatCurrencyInteiro(val)
  if (linha.tipo === 'indicador' || linha.tipo === 'total') return formatCurrencyInteiro(val)
  if (linha.tipo === 'perdas_pct' || linha.tipo === 'meta_pct') return `${(val * 100).toFixed(2)}%`
  return String(val)
}

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

// ─── Cor de barra do ranking (sinal + distinção de ano por luminosidade) ─────

const COR_POS = ['#4ade80', '#16a34a'] // verde claro (ano mais antigo) / verde escuro (mais recente)
const COR_NEG = ['#f87171', '#dc2626'] // vermelho claro / vermelho escuro

function corBarraRanking(val: number | null, yearIdx: number): string {
  if (val === null) return '#d1d5db'
  const palette = val >= 0 ? COR_POS : COR_NEG
  return palette[yearIdx % palette.length]
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
    <div>
      <h3 className="text-sm font-semibold mb-2 text-foreground">{ano}</h3>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted px-4 py-2.5 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground min-w-[180px]">
                Unidade
              </th>
              {meses.map(m => (
                <th key={m} className="px-3 py-2.5 text-center font-semibold text-xs uppercase tracking-wide text-muted-foreground min-w-[90px]">
                  {MESES_NOMES[m - 1]}
                </th>
              ))}
              <th className="px-3 py-2.5 text-center font-semibold text-xs uppercase tracking-wide text-muted-foreground min-w-[100px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {linhasUnidades.map(({ unidade, valores, total }) => (
              <tr
                key={unidade}
                className={cn(
                  'group border-b transition-colors hover:bg-muted/30',
                  unidade === 'AMBEV' && 'border-t-2 border-border bg-muted/40',
                )}
              >
                <td className={cn(
                  'sticky left-0 z-10 px-4 py-2 font-medium transition-colors',
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
                      'px-3 py-2 text-right font-mono',
                      v === null ? 'text-muted-foreground' : v >= 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold',
                    )}
                  >
                    {v === null ? '—' : formatCurrencyInteiro(v)}
                  </td>
                ))}
                <td className={cn(
                  'px-3 py-2 text-right font-mono font-semibold',
                  total === null ? 'text-muted-foreground' : total >= 0 ? 'text-emerald-700' : 'text-red-700',
                )}>
                  {total === null ? '—' : formatCurrencyInteiro(total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

  const [selPeriodoRanking, setSelPeriodoRanking] = useState<'acumulado' | number>('acumulado')

  // Meses disponíveis por ano — base para dropdown (união) e Acumulado (interseção)
  const mesesPorAno = useMemo(() => {
    const anos = Array.from(anosEvoAtivos)
    return new Map(anos.map(ano => {
      const s = new Set<number>()
      if (indSel.fonte === 'DRE') {
        rowsDre
          .filter(r => r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === ano)
          .forEach(r => s.add(r.mes))
      } else {
        rowsAux
          .filter(r => r.ano === ano && r.indicador === (indSel.key as PainelPerdasAuxRow['indicador']))
          .forEach(r => s.add(r.mes))
      }
      return [ano, s] as [number, Set<number>]
    }))
  }, [rowsDre, rowsAux, indSel, anosEvoAtivos])

  // Dropdown: união de todos os meses disponíveis
  const mesesRanking = useMemo(() => {
    const s = new Set<number>()
    for (const set of mesesPorAno.values()) set.forEach(m => s.add(m))
    return Array.from(s).sort((a, b) => a - b)
  }, [mesesPorAno])

  // Acumulado: interseção — só meses que existem em TODOS os anos selecionados
  const mesesAcumulado = useMemo(() => {
    const sets = Array.from(mesesPorAno.values())
    if (sets.length === 0) return []
    const intersect = sets.reduce((acc, s) => new Set([...acc].filter(m => s.has(m))), sets[0])
    return Array.from(intersect).sort((a, b) => a - b)
  }, [mesesPorAno])

  const rankingData = useMemo(() => {
    const computeVal = (unidade: string, ano: number): number | null => {
      if (selPeriodoRanking === 'acumulado') {
        const vals = mesesAcumulado.map(mes => valorIndicadorUnidadeMes(rowsDre, rowsAux, indSel, unidade, ano, mes))
        return vals.some(v => v !== null) ? vals.reduce<number>((acc, v) => acc + (v ?? 0), 0) : null
      }
      return valorIndicadorUnidadeMes(rowsDre, rowsAux, indSel, unidade, ano, selPeriodoRanking)
    }

    const unitsSet = new Set<string>()
    for (const ano of anosEvoAtivos) {
      rowsDre
        .filter(r => r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === ano && r.unidade !== 'AMBEV')
        .forEach(r => unitsSet.add(r.unidade))
    }

    const items = Array.from(unitsSet).sort().map(u => {
      const row: Record<string, string | number | null> = { unidade: u, unidadeNome: nomesUnidades[u] ?? u }
      for (const ano of anosEvoAtivos) {
        const v = computeVal(u, ano)
        row[`y${ano}`] = v
        row[`y${ano}_bar`] = v !== null ? Math.abs(v) : null
      }
      return row
    })

    const anoRef = anosEvoOrdenados.at(-1)!
    items.sort((a, b) => {
      const av = Math.abs((a[`y${anoRef}`] as number | null) ?? 0)
      const bv = Math.abs((b[`y${anoRef}`] as number | null) ?? 0)
      return bv - av // maior valor absoluto primeiro
    })

    const ambevRow: Record<string, string | number | null> = { unidade: 'AMBEV', unidadeNome: nomesUnidades['AMBEV'] ?? 'AMBEV' }
    for (const ano of anosEvoAtivos) {
      const v = computeVal('AMBEV', ano)
      ambevRow[`y${ano}`] = v
      ambevRow[`y${ano}_bar`] = v !== null ? Math.abs(v) : null
    }
    items.push(ambevRow)

    return items
  }, [rowsDre, rowsAux, indSel, anosEvoAtivos, anosEvoOrdenados, selPeriodoRanking, mesesAcumulado, nomesUnidades])

  const rankingHeight = Math.max(280, rankingData.length * (anosEvoOrdenados.length * 22 + 14) + 60)

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
      <h1 className="text-2xl font-semibold">Painel de Perdas</h1>

      <Tabs defaultValue="consolidado">
        <TabsList>
          <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>

        {/* ── Consolidado ── */}
        <TabsContent value="consolidado" className="space-y-6 mt-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Ano</span>
              <Select
                value={String(anoAtivo)}
                onValueChange={v => { setSelAno(Number(v)); setSelMeses(new Set()) }}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map(a => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Meses</span>
              {mesesDisponiveis.map(m => (
                <div key={m} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`mes-${m}`}
                    checked={mesesAtivos.has(m)}
                    onCheckedChange={() => toggleMes(m)}
                  />
                  <Label htmlFor={`mes-${m}`} className="text-sm cursor-pointer">
                    {MESES_NOMES[m - 1]}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {!matriz || matriz.unidades.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado disponível para o período selecionado.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="sticky left-0 z-10 bg-muted px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground min-w-[200px]">
                      Indicador
                    </th>
                    {matriz.unidades.map(u => (
                      <th key={u} className={cn(
                        'px-3 py-3 text-center font-semibold text-xs uppercase tracking-wide min-w-[110px]',
                        u === 'AMBEV' ? 'bg-muted text-foreground' : 'text-muted-foreground',
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
                          'group border-b transition-colors hover:bg-muted/30',
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
                            'px-3 py-2.5 text-right font-mono text-xs',
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
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span><span className="font-semibold text-emerald-700">Verde</span> = bom (acima da meta / perda menor)</span>
            <span><span className="font-semibold text-red-700">Vermelho</span> = ruim (abaixo da meta / perda maior)</span>
            <span><span className="font-semibold text-blue-700">Azul</span> = valor de referência (Faturamento / Meta)</span>
            <span><span className="text-muted-foreground">—</span> = sem dado</span>
          </div>

          {mesesAtivos.size > 0 && (
            <p className="text-xs text-muted-foreground">
              Período: {Array.from(mesesAtivos).sort((a,b)=>a-b).map(m => MESES_NOMES_COMPLETOS[m-1]).join(', ')} de {anoAtivo}
            </p>
          )}
        </TabsContent>

        {/* ── Evolução ── */}
        <TabsContent value="evolucao" className="space-y-6 mt-6">
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Indicador</span>
              <Select value={selIndicador} onValueChange={v => setSelIndicador(v as IndicadorKey)}>
                <SelectTrigger className="w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDICADORES_PERDAS.map(ind => (
                    <SelectItem key={ind.key} value={ind.key}>{ind.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Unidade</span>
              <Select value={selUnidadeLinhas} onValueChange={setSelUnidadeLinhas}>
                <SelectTrigger className="w-48">
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

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Anos</span>
              {anosDisponiveis.map(ano => {
                const colorIdx = anosEvoOrdenados.indexOf(ano)
                const color = anosEvoAtivos.has(ano) && colorIdx >= 0
                  ? CORES_ANOS[colorIdx % CORES_ANOS.length]
                  : undefined
                return (
                  <div key={ano} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`evo-ano-${ano}`}
                      checked={anosEvoAtivos.has(ano)}
                      onCheckedChange={() => toggleAnoEvo(ano)}
                    />
                    <Label
                      htmlFor={`evo-ano-${ano}`}
                      className="text-sm cursor-pointer font-medium"
                      style={{ color }}
                    >
                      {ano}
                    </Label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Gráfico de linhas */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold text-foreground mb-4">
              {indSel.label} — {selUnidadeLinhas === 'AMBEV' ? 'AMBEV Consolidado' : (nomesUnidades[selUnidadeLinhas] ?? selUnidadeLinhas)}
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 28, right: 24, left: 16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
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

          {/* Ranking por unidade */}
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">
                Ranking por unidade — <span className="text-muted-foreground font-normal">{indSel.label}</span>
              </p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Período</span>
                  <Select
                    value={String(selPeriodoRanking)}
                    onValueChange={v => setSelPeriodoRanking(v === 'acumulado' ? 'acumulado' : Number(v))}
                  >
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acumulado">Acumulado</SelectItem>
                      {mesesRanking.map(m => (
                        <SelectItem key={m} value={String(m)}>{MESES_NOMES_COMPLETOS[m - 1]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selPeriodoRanking === 'acumulado' && mesesAcumulado.length > 0 && (
                  <p className="text-xs text-muted-foreground pl-[52px]">
                    {mesesAcumulado.map(m => MESES_NOMES[m - 1]).join(', ')} (período comum)
                  </p>
                )}
                {selPeriodoRanking === 'acumulado' && mesesAcumulado.length === 0 && (
                  <p className="text-xs text-amber-600 pl-[52px]">Sem meses em comum entre os anos selecionados</p>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={rankingHeight}>
              <BarChart
                layout="vertical"
                data={rankingData}
                margin={{ top: 4, right: 90, left: 8, bottom: 4 }}
                barCategoryGap="25%"
                barGap={3}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={v => fmtAxis(v)}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 'auto']}
                />
                <YAxis
                  type="category"
                  dataKey="unidadeNome"
                  width={110}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const item = rankingData.find(d => d.unidadeNome === label)
                    return (
                      <div className="rounded border bg-popover px-3 py-2 shadow-md text-sm min-w-[180px]">
                        <p className="font-semibold mb-1 text-popover-foreground">{label}</p>
                        {anosEvoOrdenados.map((ano, i) => {
                          const val = item?.[`y${ano}`]
                          const cor = corBarraRanking(typeof val === 'number' ? val : null, i)
                          return (
                            <p key={ano} style={{ color: cor }}>
                              {ano}: {typeof val === 'number' ? formatCurrencyInteiro(val) : '—'}
                            </p>
                          )
                        })}
                      </div>
                    )
                  }}
                />
                {anosEvoOrdenados.map((ano, i) => (
                  <Bar
                    key={ano}
                    dataKey={`y${ano}_bar`}
                    name={String(ano)}
                    fill="#d1d5db"
                    barSize={16}
                    radius={[0, 3, 3, 0]}
                  >
                    {rankingData.map((entry, idx) => {
                      const val = entry[`y${ano}`]
                      return (
                        <Cell
                          key={idx}
                          fill={corBarraRanking(typeof val === 'number' ? val : null, i)}
                          fillOpacity={entry.unidade === 'AMBEV' ? 0.55 : 1}
                        />
                      )
                    })}
                    <LabelList
                      dataKey={`y${ano}`}
                      position="right"
                      formatter={(v: unknown) => typeof v === 'number' ? formatCurrencyInteiro(v) : ''}
                      style={{ fontSize: 9, fill: '#52514e' }}
                    />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
            {/* Legenda manual */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-[#16a34a]" />
                Positivo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-[#dc2626]" />
                Negativo
              </span>
              {anosEvoOrdenados.length > 1 && (
                <span>
                  · Tom claro = {anosEvoOrdenados[0]} · Tom escuro = {anosEvoOrdenados[anosEvoOrdenados.length - 1]}
                </span>
              )}
              <span>· AMBEV em transparência (consolidado)</span>
            </div>
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
