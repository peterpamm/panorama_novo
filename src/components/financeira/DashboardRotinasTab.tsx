import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { calcularAderenciaPorUnidade, type AderenciaMensal } from '@/lib/rotinas-financeiras'
import { atribuirRank } from '@/lib/ranking-calculations'
import type { RankingLinhaAderencia } from '@/components/ranking/RankingTabelas'
import { RankingAderenciaGlass } from '@/components/ranking/RankingAderenciaGlass'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { cn, formatPercent } from '@/lib/utils'
import type { RotinaFinanceira, RotinaFinanceiraStatus } from '@/types'

const MESES_ABREV = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ANO_ATUAL = new Date().getFullYear()
const ANOS_OPCOES = [ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL + 1]

/**
 * Dashboard de Rotinas — % de aderência (OK/(OK+NOK)) por unidade×mês, tabela
 * acumulada (igual ao GOP Rotinas Acumulado da planilha antiga) + dois
 * rankings no mesmo modelo de pódio do Ranking: um do mês escolhido, outro
 * do acumulado do ano.
 */
export function DashboardRotinasTab() {
  const { unidades } = useUnidades()
  const unidadesFiltro = useMemo(() => unidades.filter(u => u.codigo !== 'AMBEV'), [unidades])
  const nomesUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const [ano, setAno] = useState(String(ANO_ATUAL))
  const [mes, setMes] = useState(String(new Date().getMonth() + 1))

  const [rotinas, setRotinas] = useState<RotinaFinanceira[]>([])
  const [statusAno, setStatusAno] = useState<RotinaFinanceiraStatus[]>([])
  const [meta, setMeta] = useState<number | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const [r, s, m] = await Promise.all([
        supabase.from('rotinas_financeiras').select('*').eq('ativo', true),
        supabase.from('rotinas_financeiras_status').select('*').eq('ano', Number(ano)),
        supabase.from('meta_rotinas_financeiras').select('*').maybeSingle(),
      ])
      setRotinas((r.data as RotinaFinanceira[]) ?? [])
      setStatusAno((s.data as RotinaFinanceiraStatus[]) ?? [])
      setMeta(m.data ? Number((m.data as { meta_pct: number }).meta_pct) : null)
      setCarregando(false)
    }
    carregar()
  }, [ano])

  const rotinasIds = useMemo(() => new Set(rotinas.map(r => r.id!)), [rotinas])

  const aderenciaPorUnidade = useMemo(() => {
    const mapa = new Map<string, AderenciaMensal>()
    for (const u of unidadesFiltro) mapa.set(u.codigo, calcularAderenciaPorUnidade(rotinasIds, statusAno, u.codigo))
    return mapa
  }, [unidadesFiltro, rotinasIds, statusAno])

  const linhasRankingMes = useMemo<RankingLinhaAderencia[]>(() => {
    const mesIdx = Number(mes) - 1
    const base = unidadesFiltro.map(u => ({
      unidade: u.codigo,
      percentual: aderenciaPorUnidade.get(u.codigo)?.porMes[mesIdx] ?? null,
      rank: null as number | null,
    }))
    return atribuirRank(base, l => l.percentual)
  }, [unidadesFiltro, aderenciaPorUnidade, mes])

  const linhasRankingAno = useMemo<RankingLinhaAderencia[]>(() => {
    const base = unidadesFiltro.map(u => ({
      unidade: u.codigo,
      percentual: aderenciaPorUnidade.get(u.codigo)?.acumulado ?? null,
      rank: null as number | null,
    }))
    return atribuirRank(base, l => l.percentual)
  }, [unidadesFiltro, aderenciaPorUnidade])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS_OPCOES.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TableCard
        titulo={`Rotinas Acumulado — ${ano}`}
        subtitulo={carregando
          ? 'Carregando...'
          : `% de aderência = OK / (OK + NOK) — rotinas N/A ou sem resposta não entram na conta${meta !== null ? ` · meta ${formatPercent(meta, 0)}` : ''}`}
      >
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : unidadesFiltro.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma unidade cadastrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                {unidadesFiltro.map(u => (
                  <TableHead key={u.codigo} className="text-center">{u.nome}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MESES_ABREV.map((label, i) => (
                <TableRow key={label} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="py-1.5 text-sm text-muted-foreground">{label}/{ano}</TableCell>
                  {unidadesFiltro.map(u => {
                    const valor = aderenciaPorUnidade.get(u.codigo)?.porMes[i] ?? null
                    return (
                      <TableCell
                        key={u.codigo}
                        className={cn(
                          'py-1.5 text-center text-sm tabular-nums',
                          valor !== null && meta !== null && (valor >= meta
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold'),
                        )}
                      >
                        {valor === null ? '—' : formatPercent(valor, 2)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
              <TableRow className="border-gray-200/30 dark:border-gray-700/30 bg-muted/40 font-semibold hover:bg-muted/40">
                <TableCell className="py-1.5 text-sm">Acumulado</TableCell>
                {unidadesFiltro.map(u => {
                  const valor = aderenciaPorUnidade.get(u.codigo)?.acumulado ?? null
                  return (
                    <TableCell
                      key={u.codigo}
                      className={cn(
                        'py-1.5 text-center text-sm tabular-nums',
                        valor !== null && meta !== null && (valor >= meta
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'),
                      )}
                    >
                      {valor === null ? '—' : formatPercent(valor, 2)}
                    </TableCell>
                  )
                })}
              </TableRow>
            </TableBody>
          </Table>
        )}
      </TableCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Mês do ranking</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className={cn('w-40', selectGlamour)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <RankingAderenciaGlass
            linhas={linhasRankingMes}
            nomesUnidade={nomesUnidade}
            titulo={`Ranking do Mês — ${MESES_NOMES[Number(mes) - 1]}/${ano}`}
            subtitulo={`% de aderência do mês — quanto maior melhor${meta !== null ? ` · meta ${formatPercent(meta, 0)}` : ''}`}
            meta={meta}
          />
        </div>

        <div className="space-y-3 lg:pt-[34px]">
          <RankingAderenciaGlass
            linhas={linhasRankingAno}
            nomesUnidade={nomesUnidade}
            titulo={`Ranking Acumulado — ${ano}`}
            subtitulo={`% de aderência do ano inteiro — quanto maior melhor${meta !== null ? ` · meta ${formatPercent(meta, 0)}` : ''}`}
            meta={meta}
          />
        </div>
      </div>
    </div>
  )
}
