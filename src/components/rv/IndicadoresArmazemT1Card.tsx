import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { OPERACOES_ARMAZEM_T1 } from '@/lib/armazem-tiers'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { formatarMinutosComoDuracao } from '@/lib/duracao'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'
import type { MetaArmazemT1DisponibilidadeGente, MetaArmazemT1PresenteismoAl, MetaArmazemT1Quebras, MetaArmazemT1Tma, ResultadoArmazemQuebras, ResultadoArmazemT1Bi } from '@/types'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const INDICADORES_T1 = [
  { id: 'tma', nome: 'TMA' },
  { id: 'disponibilidade_gente', nome: 'Disponibilidade de Gente' },
  { id: 'presenteismo_al', nome: 'Presenteísmo AL' },
  { id: 'quebras', nome: 'Quebras' },
] as const

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Linha {
  unidade: string
  nome: string
  meses: (number | null)[]
}

/**
 * Acompanhamento dos indicadores do Armazém T1 (Estância/CDR Bahia) — TMA
 * (minutos, menor melhor), Disponibilidade de Gente (maior melhor) e
 * Presenteísmo AL (menor melhor) vêm da planilha do BI do T1
 * (resultados_armazem_t1_bi), meta mensal por unidade (muda todo mês);
 * Quebras (menor melhor, R$) é cadastro manual (resultados_armazem_quebras),
 * filtrado aqui só pras unidades do T1. Um seletor alterna entre eles —
 * mesmos dados e regra da apuração. Cadastro totalmente separado do T2.
 */
export function IndicadoresArmazemT1Card() {
  const [indId, setIndId] = useState<(typeof INDICADORES_T1)[number]['id']>('tma')
  const { unidades } = useUnidades()
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])
  const codigosT1 = useMemo(
    () => new Set(OPERACOES_ARMAZEM_T1.map(nome => resolverUnidade(nome, unidades)?.codigo).filter((c): c is string => !!c)),
    [unidades],
  )

  const [resultadosBi, setResultadosBi] = useState<ResultadoArmazemT1Bi[]>([])
  const [tmaMetas, setTmaMetas] = useState<MetaArmazemT1Tma[]>([])
  const [disponibilidadeMetas, setDisponibilidadeMetas] = useState<MetaArmazemT1DisponibilidadeGente[]>([])
  const [presenteismoMetas, setPresenteismoMetas] = useState<MetaArmazemT1PresenteismoAl[]>([])
  const [resultadosQuebras, setResultadosQuebras] = useState<ResultadoArmazemQuebras[]>([])
  const [quebrasMeta, setQuebrasMeta] = useState<MetaArmazemT1Quebras | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const [rb, mt, md, mp, rq, mq] = await Promise.all([
        supabase.from('resultados_armazem_t1_bi').select('*'),
        supabase.from('metas_armazem_t1_tma').select('*'),
        supabase.from('metas_armazem_t1_disponibilidade_gente').select('*'),
        supabase.from('metas_armazem_t1_presenteismo_al').select('*'),
        supabase.from('resultados_armazem_quebras').select('*'),
        supabase.from('rv_armazem_t1_quebras_meta').select('*').maybeSingle(),
      ])
      setResultadosBi((rb.data as ResultadoArmazemT1Bi[]) ?? [])
      setTmaMetas((mt.data as MetaArmazemT1Tma[]) ?? [])
      setDisponibilidadeMetas((md.data as MetaArmazemT1DisponibilidadeGente[]) ?? [])
      setPresenteismoMetas((mp.data as MetaArmazemT1PresenteismoAl[]) ?? [])
      setResultadosQuebras((rq.data as ResultadoArmazemQuebras[]) ?? [])
      setQuebrasMeta(mq.data as MetaArmazemT1Quebras | null)
      setCarregando(false)
    }
    carregar()
  }, [])

  const resultadosDoIndicador = useMemo(
    () => resultadosBi.filter(r => r.indicador === indId),
    [resultadosBi, indId],
  )
  const resultadosQuebrasT1 = useMemo(
    () => resultadosQuebras.filter(r => codigosT1.has(r.unidade)),
    [resultadosQuebras, codigosT1],
  )

  const anosDisponiveis = useMemo(() => {
    const anos = indId === 'quebras' ? resultadosQuebrasT1.map(r => r.ano) : resultadosDoIndicador.map(r => r.ano)
    return Array.from(new Set(anos)).sort((a, b) => b - a)
  }, [indId, resultadosDoIndicador, resultadosQuebrasT1])

  const [ano, setAno] = useState('')
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(ano))) setAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, ano])

  const linhas = useMemo<Linha[]>(() => {
    const anoNum = Number(ano)
    const fonte = indId === 'quebras' ? resultadosQuebrasT1 : resultadosDoIndicador
    const doAno = fonte.filter(r => r.ano === anoNum)
    if (!anoNum || doAno.length === 0) return []
    const codigos = Array.from(new Set(doAno.map(r => r.unidade)))
    return codigos
      .map(codigo => ({
        unidade: codigo,
        nome: nomesUnidades.get(codigo) ?? codigo,
        meses: Array.from({ length: 12 }, (_, i) => doAno.find(r => r.unidade === codigo && r.mes === i + 1)?.valor ?? null),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [indId, resultadosDoIndicador, resultadosQuebrasT1, ano, nomesUnidades])

  function metaDaUnidade(unidadeCodigo: string, mes: number): number | null {
    const anoNum = Number(ano)
    if (indId === 'tma') return tmaMetas.find(m => m.unidade === unidadeCodigo && m.ano === anoNum && m.mes === mes)?.valor ?? null
    if (indId === 'disponibilidade_gente') return disponibilidadeMetas.find(m => m.unidade === unidadeCodigo && m.ano === anoNum && m.mes === mes)?.valor ?? null
    if (indId === 'presenteismo_al') return presenteismoMetas.find(m => m.unidade === unidadeCodigo && m.ano === anoNum && m.mes === mes)?.valor ?? null
    return quebrasMeta?.meta_valor ?? null
  }

  function bateu(valor: number, meta: number): boolean {
    return indId === 'disponibilidade_gente' ? valor >= meta : valor <= meta
  }

  function formatarValor(v: number): string {
    if (indId === 'tma') return formatarMinutosComoDuracao(v)
    if (indId === 'quebras') return `R$ ${fmtValor(v)}`
    return `${fmtPct(v)}%`
  }

  const ind = INDICADORES_T1.find(i => i.id === indId)!
  const subtitulo = indId === 'tma'
    ? 'resultado do mês (HH:MM) vs meta mensal por unidade · quanto menor melhor'
    : indId === 'disponibilidade_gente'
      ? 'resultado do mês (%) vs meta mensal por unidade · quanto maior melhor'
      : indId === 'presenteismo_al'
        ? 'resultado do mês (%) vs meta mensal por unidade · quanto menor melhor'
        : 'cadastro manual (R$) vs meta única · quanto menor melhor'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Indicador</Label>
          <Select value={indId} onValueChange={v => setIndId(v as typeof indId)}>
            <SelectTrigger className={cn('w-56', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {INDICADORES_T1.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TableCard
        titulo={`${ind.nome} (T1)`}
        subtitulo={carregando ? 'Carregando...' : `${ano} · ${subtitulo}`}
      >
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : linhas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {indId === 'quebras'
              ? 'Sem resultado cadastrado — cadastre em Importação > Armazém > Quebras.'
              : 'Sem resultados importados — importe na página Importação, aba Armazém > T1.'}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                {MESES_ABREV.map(m => (
                  <TableHead key={m} className="text-center">{m}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(l => (
                <TableRow key={l.unidade} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="py-1.5 text-sm font-medium">{l.nome}</TableCell>
                  {l.meses.map((valor, i) => {
                    if (valor === null) {
                      return <TableCell key={i} className="py-1.5 text-center text-xs text-muted-foreground">—</TableCell>
                    }
                    const meta = metaDaUnidade(l.unidade, i + 1)
                    const ok = meta === null ? null : bateu(valor, meta)
                    return (
                      <TableCell
                        key={i}
                        title={meta !== null ? `Meta: ${formatarValor(meta)}` : 'Sem meta cadastrada'}
                        className={cn(
                          'py-1.5 text-center text-xs font-medium tabular-nums',
                          ok === null
                            ? 'text-foreground'
                            : ok
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                        )}
                      >
                        {formatarValor(valor)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </div>
  )
}
