import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useIndicadorDreMatriz } from '@/hooks/useIndicadorDreMatriz'
import { RV_GENTE_DRE } from '@/lib/constants'
import { menorMelhor } from '@/lib/rv-gente'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { MetaGente, ResultadoGente } from '@/types'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtInt(v: number): string {
  return Math.round(v).toLocaleString('pt-BR')
}

// Chave combinada pro seletor único — "bi:<indicador>" ou "dre:<id>" — pra
// achar de volta a fonte e o id original sem precisar de 2 estados separados.
const PREFIXO_BI = 'bi:'
const PREFIXO_DRE = 'dre:'
const chaveBi = (indicador: string) => `${PREFIXO_BI}${indicador}`
const chaveDre = (id: string) => `${PREFIXO_DRE}${id}`

/**
 * Acompanhamento mensal dos indicadores de gente — seletor único combinando
 * os indicadores importados (planilha de resultados, operação×mês) com os de
 * origem no DRE (Pacote de Gente/Salários/Benefícios do Farol), que antes
 * viviam em dois seletores/cards separados (este + `IndicadoresDreCard`).
 * A matriz do DRE reaproveita `useIndicadorDreMatriz`, mesmo cálculo usado
 * pelo card avulso das outras subpáginas de RV.
 */
export function RvGenteTab() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  // ── Indicadores importados (planilha de resultados) ─────────────────────
  const [metas, setMetas] = useState<MetaGente[]>([])
  const [resultados, setResultados] = useState<ResultadoGente[]>([])
  const [carregandoBi, setCarregandoBi] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregandoBi(true)
      const [m, r] = await Promise.all([
        supabase.from('metas_gente').select('*'),
        supabase.from('resultados_gente').select('*'),
      ])
      if (m.error) toast({ title: 'Erro ao carregar metas de gente', description: m.error.message, variant: 'destructive' })
      if (r.error) toast({ title: 'Erro ao carregar resultados de gente', description: r.error.message, variant: 'destructive' })
      setMetas((m.data as MetaGente[]) ?? [])
      setResultados((r.data as ResultadoGente[]) ?? [])
      setCarregandoBi(false)
    }
    carregar()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const indicadoresBi = useMemo(
    () => Array.from(new Set([...metas.map(m => m.indicador), ...resultados.map(r => r.indicador)])).sort(),
    [metas, resultados],
  )
  const anosBiDisponiveis = useMemo(
    () => Array.from(new Set([...metas.map(m => m.ano), ...resultados.map(r => r.ano)])).sort((a, b) => b - a),
    [metas, resultados],
  )

  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  // ── Seletor único: indicadores importados + indicadores do DRE ──────────
  const [verIndicadorChave, setVerIndicadorChave] = useState('')
  useEffect(() => {
    if (verIndicadorChave) return
    if (indicadoresBi.length > 0) setVerIndicadorChave(chaveBi(indicadoresBi[0]))
    else if (RV_GENTE_DRE.length > 0) setVerIndicadorChave(chaveDre(RV_GENTE_DRE[0].id))
  }, [indicadoresBi, verIndicadorChave])

  const fonte: 'bi' | 'dre' = verIndicadorChave.startsWith(PREFIXO_DRE) ? 'dre' : 'bi'
  const idSelecionado = verIndicadorChave.slice(verIndicadorChave.indexOf(':') + 1)

  // ── Ano único (união dos anos com dado importado e dos anos com DRE) ────
  const [verAno, setVerAno] = useState('')
  const { matriz: matrizDreComAno, carregando: carregandoDreComAno, anosDisponiveis: anosDreDisponiveis, ind: indDre } = useIndicadorDreMatriz(
    RV_GENTE_DRE,
    fonte === 'dre' ? idSelecionado : (RV_GENTE_DRE[0]?.id ?? ''),
    verAno ? Number(verAno) : null,
  )
  const anosDisponiveis = useMemo(
    () => Array.from(new Set([...anosBiDisponiveis, ...anosDreDisponiveis])).sort((a, b) => b - a),
    [anosBiDisponiveis, anosDreDisponiveis],
  )
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(verAno))) {
      setVerAno(String(anosDisponiveis[0]))
    }
  }, [anosDisponiveis, verAno])

  // ── Matriz operação × mês dos indicadores importados (resultado colorido vs meta) ──
  interface CelulaMes {
    resultado: number | null
    meta: number | null
  }

  const matrizBi = useMemo(() => {
    const ano = Number(verAno)
    const metasFiltro = metas.filter(m => m.indicador === idSelecionado && m.ano === ano)
    const resultadosFiltro = resultados.filter(r => r.indicador === idSelecionado && r.ano === ano)

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
  }, [metas, resultados, idSelecionado, verAno, nomesUnidades])

  const nomeIndicadorSelecionado = fonte === 'bi' ? idSelecionado : indDre.nome
  const carregando = fonte === 'bi' ? carregandoBi : carregandoDreComAno

  return (
    <div className="space-y-6">
      {(indicadoresBi.length > 0 || RV_GENTE_DRE.length > 0 || carregandoBi) && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Indicador</Label>
            <Select value={verIndicadorChave} onValueChange={setVerIndicadorChave}>
              <SelectTrigger className={cn('w-72', selectGlamour)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {indicadoresBi.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Indicadores importados</SelectLabel>
                    {indicadoresBi.map(i => <SelectItem key={chaveBi(i)} value={chaveBi(i)}>{i}</SelectItem>)}
                  </SelectGroup>
                )}
                {RV_GENTE_DRE.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Indicadores do DRE</SelectLabel>
                    {RV_GENTE_DRE.map(i => <SelectItem key={chaveDre(i.id)} value={chaveDre(i.id)}>{i.nome}</SelectItem>)}
                  </SelectGroup>
                )}
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

      {fonte === 'bi' ? (
        <TableCard
          titulo={`Acompanhamento — ${nomeIndicadorSelecionado || 'RV de Gente'}`}
          subtitulo={carregando
            ? 'Carregando...'
            : matrizBi.length === 0
              ? 'Sem dados'
              : `${verAno} · ${menorMelhor(idSelecionado) ? 'quanto menor melhor' : 'quanto maior melhor'} · verde = meta batida, vermelho = meta perdida`}
        >
          {carregando ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando acompanhamento...
            </div>
          ) : matrizBi.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum dado ainda — importe as metas (página Metas) e os resultados (RV de Gente &gt; Importação).
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
                {matrizBi.map(l => (
                  <TableRow key={l.operacao} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <TableCell className="text-sm font-medium">{l.unidadeNome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.operacao}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.negocio || '—'}</TableCell>
                    {l.meses.map((c, i) => {
                      const bateu = c.resultado !== null && c.meta !== null
                        ? (menorMelhor(idSelecionado) ? c.resultado <= c.meta : c.resultado >= c.meta)
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
      ) : (
        <TableCard
          titulo={`Acompanhamento — ${indDre.nome}`}
          subtitulo={carregando
            ? 'Carregando...'
            : indDre.tipo === 'avr'
              ? `${verAno} · AVR do mês vs meta do Orçamento · quanto menor melhor · verde = meta batida, vermelho = meta perdida`
              : `${verAno} · dispersão do mês (coluna diferença do DRE, contas ${indDre.prefixos.join(' + ')}) · verde = sem estouro (≥ 0)`}
        >
          {carregando ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando DRE...
            </div>
          ) : matrizDreComAno.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Sem dados do DRE pra esse ano.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Negócio</TableHead>
                  {MESES_ABREV.map(m => (
                    <TableHead key={m} className="text-center">{m}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrizDreComAno.map(l => (
                  <TableRow
                    key={`${l.unidade}|${l.negocio}`}
                    className={cn(
                      'border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30',
                      l.unidade === 'AMBEV' && 'bg-muted/40 font-semibold',
                    )}
                  >
                    <TableCell className="text-sm font-medium">{l.nome}</TableCell>
                    <TableCell className={cn(
                      'text-sm',
                      l.negocio === 'CONS' ? 'text-muted-foreground' : 'font-semibold text-blue-600 dark:text-blue-400',
                    )}>
                      {l.negocio}
                    </TableCell>
                    {l.meses.map((c, i) => {
                      if (c === null) {
                        return <TableCell key={i} className="text-center text-xs text-muted-foreground">—</TableCell>
                      }
                      const bateu = c.tipo === 'avr'
                        ? (c.meta !== null ? c.avr <= c.meta : null)
                        : c.valor >= 0
                      const texto = c.tipo === 'avr' ? fmtPct(c.avr) : fmtInt(c.valor)
                      const tooltip = c.tipo === 'avr'
                        ? (c.meta !== null ? `Meta: ${fmtPct(c.meta)}` : 'Sem meta cadastrada')
                        : 'Meta: dispersão ≥ 0 (sem estouro)'
                      return (
                        <TableCell
                          key={i}
                          title={tooltip}
                          className={cn(
                            'text-center text-xs font-medium tabular-nums',
                            bateu === null
                              ? 'text-foreground'
                              : bateu
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                          )}
                        >
                          {texto}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}
    </div>
  )
}
