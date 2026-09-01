import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { OPERACOES_ARMAZEM_T1 } from '@/lib/armazem-tiers'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { formatarMinutosComoDuracao } from '@/lib/duracao'
import { TabelaIndicadorGenerica, type CelulaIndicador, type LinhaIndicador } from '@/components/rv/TabelaIndicadorGenerica'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'
import type {
  MetaArmazemEfc, MetaArmazemPresenteismoAl, MetaArmazemQuebras, MetaArmazemRefugo, MetaArmazemTma,
  MetaArmazemT1DisponibilidadeGente, MetaArmazemT1PresenteismoAl, MetaArmazemT1Quebras, MetaArmazemT1Tma,
  ResultadoArmazemBi, ResultadoArmazemQuebras, ResultadoArmazemT1Bi,
} from '@/types'

const INDICADORES_T2 = [
  { id: 'efc', nome: 'EFC' },
  { id: 'tma', nome: 'TMA' },
  { id: 'presenteismo_al', nome: 'Presenteísmo AL' },
  { id: 'refugo', nome: 'Refugo' },
  { id: 'quebras', nome: 'Quebras' },
] as const
type IndicadorT2Id = (typeof INDICADORES_T2)[number]['id']

const INDICADORES_T1 = [
  { id: 'tma', nome: 'TMA' },
  { id: 'disponibilidade_gente', nome: 'Disponibilidade de Gente' },
  { id: 'presenteismo_al', nome: 'Presenteísmo AL' },
  { id: 'quebras', nome: 'Quebras' },
] as const
type IndicadorT1Id = (typeof INDICADORES_T1)[number]['id']

const PREFIXO_T2 = 't2:'
const PREFIXO_T1 = 't1:'
const chaveT2 = (id: string) => `${PREFIXO_T2}${id}`
const chaveT1 = (id: string) => `${PREFIXO_T1}${id}`

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface LinhaBruta {
  unidade: string
  nome: string
  meses: (number | null)[]
}

/**
 * Acompanhamento da RV de Armazém — seletor único combinando os indicadores
 * do T2 (EFC, TMA, Presenteísmo AL, Refugo, Quebras — planilha do BI T2 +
 * cadastro manual de Quebras) e do T1 (Estância/CDR Bahia: TMA,
 * Disponibilidade de Gente, Presenteísmo AL, Quebras — planilha do BI T1,
 * cadastro totalmente separado do T2). Antes viviam em dois cards/seletores
 * separados (IndicadoresArmazemT2Card + IndicadoresArmazemT1Card).
 */
export function AcompanhamentoArmazemTab() {
  const { unidades } = useUnidades()
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])
  const codigosT1 = useMemo(
    () => new Set(OPERACOES_ARMAZEM_T1.map(nome => resolverUnidade(nome, unidades)?.codigo).filter((c): c is string => !!c)),
    [unidades],
  )

  const [verIndicadorChave, setVerIndicadorChave] = useState(chaveT2(INDICADORES_T2[0].id))
  const tier: 't2' | 't1' = verIndicadorChave.startsWith(PREFIXO_T1) ? 't1' : 't2'
  const idT2 = (tier === 't2' ? verIndicadorChave.slice(PREFIXO_T2.length) : INDICADORES_T2[0].id) as IndicadorT2Id
  const idT1 = (tier === 't1' ? verIndicadorChave.slice(PREFIXO_T1.length) : INDICADORES_T1[0].id) as IndicadorT1Id

  // ── T2 ───────────────────────────────────────────────────────────────────
  const [resultadosBiT2, setResultadosBiT2] = useState<ResultadoArmazemBi[]>([])
  const [efcMetas, setEfcMetas] = useState<Map<string, number>>(new Map())
  const [tmaMetasT2, setTmaMetasT2] = useState<Map<string, number>>(new Map())
  const [presenteismoMetasT2, setPresenteismoMetasT2] = useState<MetaArmazemPresenteismoAl[]>([])
  const [refugoMeta, setRefugoMeta] = useState<MetaArmazemRefugo | null>(null)
  const [resultadosQuebras, setResultadosQuebras] = useState<ResultadoArmazemQuebras[]>([])
  const [quebrasMetaT2, setQuebrasMetaT2] = useState<MetaArmazemQuebras | null>(null)
  const [carregandoT2, setCarregandoT2] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregandoT2(true)
      const [rb, me, mt, mp, mr, rq, mq] = await Promise.all([
        supabase.from('resultados_armazem_bi').select('*'),
        supabase.from('rv_armazem_efc_meta').select('*'),
        supabase.from('rv_armazem_tma_meta').select('*'),
        supabase.from('metas_armazem_presenteismo_al').select('*'),
        supabase.from('rv_armazem_refugo_meta').select('*').maybeSingle(),
        supabase.from('resultados_armazem_quebras').select('*'),
        supabase.from('rv_armazem_quebras_meta').select('*').maybeSingle(),
      ])
      setResultadosBiT2((rb.data as ResultadoArmazemBi[]) ?? [])
      setEfcMetas(new Map(((me.data as MetaArmazemEfc[]) ?? []).map(x => [x.unidade, Number(x.meta_pct)])))
      setTmaMetasT2(new Map(((mt.data as MetaArmazemTma[]) ?? []).map(x => [x.unidade, Number(x.meta_minutos)])))
      setPresenteismoMetasT2((mp.data as MetaArmazemPresenteismoAl[]) ?? [])
      setRefugoMeta(mr.data as MetaArmazemRefugo | null)
      setResultadosQuebras((rq.data as ResultadoArmazemQuebras[]) ?? [])
      setQuebrasMetaT2(mq.data as MetaArmazemQuebras | null)
      setCarregandoT2(false)
    }
    carregar()
  }, [])

  // ── T1 ───────────────────────────────────────────────────────────────────
  const [resultadosBiT1, setResultadosBiT1] = useState<ResultadoArmazemT1Bi[]>([])
  const [tmaMetasT1, setTmaMetasT1] = useState<MetaArmazemT1Tma[]>([])
  const [disponibilidadeMetas, setDisponibilidadeMetas] = useState<MetaArmazemT1DisponibilidadeGente[]>([])
  const [presenteismoMetasT1, setPresenteismoMetasT1] = useState<MetaArmazemT1PresenteismoAl[]>([])
  const [quebrasMetaT1, setQuebrasMetaT1] = useState<MetaArmazemT1Quebras | null>(null)
  const [carregandoT1, setCarregandoT1] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregandoT1(true)
      const [rb, mt, md, mp, mq] = await Promise.all([
        supabase.from('resultados_armazem_t1_bi').select('*'),
        supabase.from('metas_armazem_t1_tma').select('*'),
        supabase.from('metas_armazem_t1_disponibilidade_gente').select('*'),
        supabase.from('metas_armazem_t1_presenteismo_al').select('*'),
        supabase.from('rv_armazem_t1_quebras_meta').select('*').maybeSingle(),
      ])
      setResultadosBiT1((rb.data as ResultadoArmazemT1Bi[]) ?? [])
      setTmaMetasT1((mt.data as MetaArmazemT1Tma[]) ?? [])
      setDisponibilidadeMetas((md.data as MetaArmazemT1DisponibilidadeGente[]) ?? [])
      setPresenteismoMetasT1((mp.data as MetaArmazemT1PresenteismoAl[]) ?? [])
      setQuebrasMetaT1(mq.data as MetaArmazemT1Quebras | null)
      setCarregandoT1(false)
    }
    carregar()
  }, [])

  // ── T2: linhas + meta/formato por indicador ─────────────────────────────
  const resultadosDoIndicadorT2 = useMemo(() => resultadosBiT2.filter(r => r.indicador === idT2), [resultadosBiT2, idT2])
  const resultadosQuebrasT2 = useMemo(() => resultadosQuebras.filter(r => !codigosT1.has(r.unidade)), [resultadosQuebras, codigosT1])

  const anosT2 = useMemo(() => {
    const anos = idT2 === 'quebras' ? resultadosQuebrasT2.map(r => r.ano) : resultadosDoIndicadorT2.map(r => r.ano)
    return Array.from(new Set(anos)).sort((a, b) => b - a)
  }, [idT2, resultadosDoIndicadorT2, resultadosQuebrasT2])

  // ── T1: linhas + meta/formato por indicador ─────────────────────────────
  const resultadosDoIndicadorT1 = useMemo(() => resultadosBiT1.filter(r => r.indicador === idT1), [resultadosBiT1, idT1])
  const resultadosQuebrasT1 = useMemo(() => resultadosQuebras.filter(r => codigosT1.has(r.unidade)), [resultadosQuebras, codigosT1])

  const anosT1 = useMemo(() => {
    const anos = idT1 === 'quebras' ? resultadosQuebrasT1.map(r => r.ano) : resultadosDoIndicadorT1.map(r => r.ano)
    return Array.from(new Set(anos)).sort((a, b) => b - a)
  }, [idT1, resultadosDoIndicadorT1, resultadosQuebrasT1])

  const anosDisponiveis = tier === 't2' ? anosT2 : anosT1
  const [verAno, setVerAno] = useState('')
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(verAno))) setVerAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, verAno])
  const ano = Number(verAno)

  const linhasBrutasT2 = useMemo<LinhaBruta[]>(() => {
    const fonte = idT2 === 'quebras' ? resultadosQuebrasT2 : resultadosDoIndicadorT2
    const doAno = fonte.filter(r => r.ano === ano)
    if (!ano || doAno.length === 0) return []
    const codigos = Array.from(new Set(doAno.map(r => r.unidade)))
    return codigos
      .map(codigo => ({
        unidade: codigo,
        nome: nomesUnidades.get(codigo) ?? codigo,
        meses: Array.from({ length: 12 }, (_, i) => doAno.find(r => r.unidade === codigo && r.mes === i + 1)?.valor ?? null),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [idT2, resultadosDoIndicadorT2, resultadosQuebrasT2, ano, nomesUnidades])

  const linhasBrutasT1 = useMemo<LinhaBruta[]>(() => {
    const fonte = idT1 === 'quebras' ? resultadosQuebrasT1 : resultadosDoIndicadorT1
    const doAno = fonte.filter(r => r.ano === ano)
    if (!ano || doAno.length === 0) return []
    const codigos = Array.from(new Set(doAno.map(r => r.unidade)))
    return codigos
      .map(codigo => ({
        unidade: codigo,
        nome: nomesUnidades.get(codigo) ?? codigo,
        meses: Array.from({ length: 12 }, (_, i) => doAno.find(r => r.unidade === codigo && r.mes === i + 1)?.valor ?? null),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [idT1, resultadosDoIndicadorT1, resultadosQuebrasT1, ano, nomesUnidades])

  function metaT2(unidadeCodigo: string, mes: number): number | null {
    if (idT2 === 'efc') return efcMetas.get(unidadeCodigo) ?? null
    if (idT2 === 'tma') return tmaMetasT2.get(unidadeCodigo) ?? null
    if (idT2 === 'presenteismo_al') return presenteismoMetasT2.find(m => m.unidade === unidadeCodigo && m.ano === ano && m.mes === mes)?.valor ?? null
    if (idT2 === 'refugo') return refugoMeta?.meta_pct ?? null
    return quebrasMetaT2?.meta_valor ?? null
  }
  function bateuT2(valor: number, meta: number): boolean {
    return idT2 === 'efc' ? valor >= meta : valor <= meta
  }
  function formatarT2(v: number): string {
    if (idT2 === 'tma') return formatarMinutosComoDuracao(v)
    if (idT2 === 'quebras') return `R$ ${fmtValor(v)}`
    return `${fmtPct(v)}%`
  }

  function metaT1(unidadeCodigo: string, mes: number): number | null {
    if (idT1 === 'tma') return tmaMetasT1.find(m => m.unidade === unidadeCodigo && m.ano === ano && m.mes === mes)?.valor ?? null
    if (idT1 === 'disponibilidade_gente') return disponibilidadeMetas.find(m => m.unidade === unidadeCodigo && m.ano === ano && m.mes === mes)?.valor ?? null
    if (idT1 === 'presenteismo_al') return presenteismoMetasT1.find(m => m.unidade === unidadeCodigo && m.ano === ano && m.mes === mes)?.valor ?? null
    return quebrasMetaT1?.meta_valor ?? null
  }
  function bateuT1(valor: number, meta: number): boolean {
    return idT1 === 'disponibilidade_gente' ? valor >= meta : valor <= meta
  }
  function formatarT1(v: number): string {
    if (idT1 === 'tma') return formatarMinutosComoDuracao(v)
    if (idT1 === 'quebras') return `R$ ${fmtValor(v)}`
    return `${fmtPct(v)}%`
  }

  const linhas = useMemo<LinhaIndicador[]>(() => {
    const [brutas, metaFn, bateuFn, fmtFn] = tier === 't2'
      ? [linhasBrutasT2, metaT2, bateuT2, formatarT2] as const
      : [linhasBrutasT1, metaT1, bateuT1, formatarT1] as const
    return brutas.map(l => ({
      key: l.unidade,
      nome: l.nome,
      meses: l.meses.map((valor, i): CelulaIndicador | null => {
        if (valor === null) return null
        const meta = metaFn(l.unidade, i + 1)
        return {
          texto: fmtFn(valor),
          tooltip: meta !== null ? `Meta: ${fmtFn(meta)}` : 'Sem meta cadastrada',
          bateu: meta === null ? null : bateuFn(valor, meta),
        }
      }),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, linhasBrutasT2, linhasBrutasT1, idT2, idT1])

  const carregando = tier === 't2' ? carregandoT2 : carregandoT1
  const indT2 = INDICADORES_T2.find(i => i.id === idT2)!
  const indT1 = INDICADORES_T1.find(i => i.id === idT1)!
  const titulo = tier === 't2' ? `${indT2.nome} (T2)` : `${indT1.nome} (T1)`
  const regra = tier === 't2'
    ? (idT2 === 'efc'
      ? 'resultado do mês (%) vs meta por unidade · quanto maior melhor'
      : idT2 === 'tma'
        ? 'resultado do mês (HH:MM) vs meta por unidade · quanto menor melhor'
        : idT2 === 'presenteismo_al'
          ? 'resultado do mês (%) vs meta mensal por unidade · quanto menor melhor'
          : idT2 === 'refugo'
            ? 'resultado do mês (%) vs meta única · quanto menor melhor'
            : 'cadastro manual (R$) vs meta única · quanto menor melhor · Estância/CDR Bahia ficam na aba T1')
    : (idT1 === 'tma'
      ? 'resultado do mês (HH:MM) vs meta mensal por unidade · quanto menor melhor'
      : idT1 === 'disponibilidade_gente'
        ? 'resultado do mês (%) vs meta mensal por unidade · quanto maior melhor'
        : idT1 === 'presenteismo_al'
          ? 'resultado do mês (%) vs meta mensal por unidade · quanto menor melhor'
          : 'cadastro manual (R$) vs meta única · quanto menor melhor')
  const subtitulo = `${verAno} · ${regra}`
  const semDados = (tier === 't2' ? idT2 : idT1) === 'quebras'
    ? 'Sem resultado cadastrado — cadastre na aba Importação desta página > Quebras.'
    : tier === 't1'
      ? 'Sem resultados importados — importe na aba Importação desta página > T1.'
      : 'Sem resultados importados — importe na aba Importação desta página.'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Indicador</Label>
          <Select value={verIndicadorChave} onValueChange={setVerIndicadorChave}>
            <SelectTrigger className={cn('w-64', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>T2</SelectLabel>
                {INDICADORES_T2.map(i => <SelectItem key={chaveT2(i.id)} value={chaveT2(i.id)}>{i.nome}</SelectItem>)}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>T1 (Estância/CDR Bahia)</SelectLabel>
                {INDICADORES_T1.map(i => <SelectItem key={chaveT1(i.id)} value={chaveT1(i.id)}>{i.nome}</SelectItem>)}
              </SelectGroup>
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

      <TabelaIndicadorGenerica
        titulo={titulo}
        subtitulo={subtitulo}
        linhas={linhas}
        carregando={carregando}
        semDadosTexto={semDados}
      />
    </div>
  )
}
