import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { RV_GENTE_DRE } from '@/lib/constants'
import { menorMelhor } from '@/lib/rv-gente'
import { IndicadoresDreCard } from '@/components/rv/IndicadoresDreCard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { MetaGente, ResultadoGente } from '@/types'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Acompanhamento mensal dos indicadores de gente: resultado × meta por operação — verde bateu, vermelho perdeu. */
export function RvGenteTab() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [metas, setMetas] = useState<MetaGente[]>([])
  const [resultados, setResultados] = useState<ResultadoGente[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const [m, r] = await Promise.all([
        supabase.from('metas_gente').select('*'),
        supabase.from('resultados_gente').select('*'),
      ])
      if (m.error) toast({ title: 'Erro ao carregar metas de gente', description: m.error.message, variant: 'destructive' })
      if (r.error) toast({ title: 'Erro ao carregar resultados de gente', description: r.error.message, variant: 'destructive' })
      setMetas((m.data as MetaGente[]) ?? [])
      setResultados((r.data as ResultadoGente[]) ?? [])
      setCarregando(false)
    }
    carregar()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const indicadoresDisponiveis = useMemo(
    () => Array.from(new Set([...metas.map(m => m.indicador), ...resultados.map(r => r.indicador)])).sort(),
    [metas, resultados],
  )
  const anosDisponiveis = useMemo(
    () => Array.from(new Set([...metas.map(m => m.ano), ...resultados.map(r => r.ano)])).sort((a, b) => b - a),
    [metas, resultados],
  )

  const [verIndicador, setVerIndicador] = useState('')
  const [verAno, setVerAno] = useState('')

  useEffect(() => {
    if (indicadoresDisponiveis.length > 0 && !indicadoresDisponiveis.includes(verIndicador)) {
      setVerIndicador(indicadoresDisponiveis[0])
    }
  }, [indicadoresDisponiveis, verIndicador])
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(verAno))) {
      setVerAno(String(anosDisponiveis[0]))
    }
  }, [anosDisponiveis, verAno])

  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  // ── Matriz operação × mês (resultado colorido vs meta) ──────────────────────
  interface CelulaMes {
    resultado: number | null
    meta: number | null
  }

  const matriz = useMemo(() => {
    const ano = Number(verAno)
    const metasFiltro = metas.filter(m => m.indicador === verIndicador && m.ano === ano)
    const resultadosFiltro = resultados.filter(r => r.indicador === verIndicador && r.ano === ano)

    const porOperacao = new Map<string, { unidade: string; negocio: string; meses: CelulaMes[] }>()
    const garantir = (operacao: string, unidade: string) => {
      const atual = porOperacao.get(operacao)
      if (atual) return atual
      const novo = { unidade, negocio: '', meses: Array.from({ length: 12 }, () => ({ resultado: null, meta: null })) as CelulaMes[] }
      porOperacao.set(operacao, novo)
      return novo
    }

    for (const m of metasFiltro) {
      const op = garantir(m.operacao_bi, m.unidade)
      op.meses[m.mes - 1].meta = m.valor
      if (m.negocio) op.negocio = m.negocio
    }
    for (const r of resultadosFiltro) {
      const op = garantir(r.operacao_bi, r.unidade)
      op.meses[r.mes - 1].resultado = r.valor
    }

    return Array.from(porOperacao.entries())
      .map(([operacao, { unidade, negocio, meses }]) => ({
        operacao,
        negocio,
        unidadeNome: nomesUnidades.get(unidade) ?? unidade,
        meses,
      }))
      .sort((a, b) => a.unidadeNome.localeCompare(b.unidadeNome) || a.operacao.localeCompare(b.operacao))
  }, [metas, resultados, verIndicador, verAno, nomesUnidades])

  return (
    <div className="space-y-6">
      {(indicadoresDisponiveis.length > 0 || carregando) && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Indicador</Label>
            <Select value={verIndicador} onValueChange={setVerIndicador}>
              <SelectTrigger className={cn('w-64', selectGlamour)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {indicadoresDisponiveis.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Select value={verAno} onValueChange={setVerAno}>
              <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <TableCard
        titulo={`Acompanhamento — ${verIndicador || 'RV de Gente'}`}
        subtitulo={carregando
          ? 'Carregando...'
          : matriz.length === 0
            ? 'Sem dados'
            : `${verAno} · ${menorMelhor(verIndicador) ? 'quanto menor melhor' : 'quanto maior melhor'} · verde = meta batida, vermelho = meta perdida`}
      >
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando acompanhamento...
          </div>
        ) : matriz.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhum dado ainda — importe as metas (página Metas) e os resultados (página Importação, aba Gente).
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Operação (BI)</TableHead>
                <TableHead>Negócio</TableHead>
                {MESES_ABREV.map(m => (
                  <TableHead key={m} className="text-center">{m}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matriz.map(l => (
                <TableRow key={l.operacao} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="text-sm font-medium">{l.unidadeNome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.operacao}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.negocio || '—'}</TableCell>
                  {l.meses.map((c, i) => {
                    const bateu = c.resultado !== null && c.meta !== null
                      ? (menorMelhor(verIndicador) ? c.resultado <= c.meta : c.resultado >= c.meta)
                      : null
                    return (
                      <TableCell
                        key={i}
                        title={c.meta !== null ? `Meta: ${fmtPct(c.meta)}` : 'Sem meta cadastrada'}
                        className={cn(
                          'text-center text-xs font-medium tabular-nums',
                          c.resultado === null
                            ? 'text-muted-foreground'
                            : bateu === null
                              ? 'text-foreground'
                              : bateu
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                        )}
                      >
                        {c.resultado === null ? '—' : fmtPct(c.resultado)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      {/* ── Indicadores com origem no DRE (Pacote de Gente do Farol) ── */}
      <div className="border-t pt-6">
        <IndicadoresDreCard indicadores={RV_GENTE_DRE} />
      </div>
    </div>
  )
}
