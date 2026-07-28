import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { unidadeSplitNegocio } from '@/lib/rv-gente'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'
import type { DtoT1Meta, DtoT2Meta, ExcessoVelocidadeMeta, FaiMeta, GsdMeta, LogonMeta, ResultadoDtoT1, ResultadoDtoT2, ResultadoExcessoVelocidade, ResultadoFai, ResultadoGsd, ResultadoLogon, ResultadoTri, TriMeta } from '@/types'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * Indicadores de RV que não vêm do DRE — a lista existe pra caber os
 * próximos indicadores fora do DRE sem mudar a estrutura da tela (mesmo
 * padrão do seletor de indicadores do IndicadoresDreCard). `formato`/`direcao`
 * controlam como o valor é exibido e comparado com a meta: % (quanto maior
 * melhor) ou contagem (quanto menor melhor, ex: nº de excessos).
 */
const INDICADORES_FORA_DRE = [
  { id: 'dto', nome: 'DTO (T1/T2)', formato: 'pct', direcao: 'maior' },
  { id: 'gsd', nome: 'GSD', formato: 'pct', direcao: 'maior' },
  { id: 'logon', nome: 'LogOn', formato: 'pct', direcao: 'maior' },
  { id: 'excesso_velocidade', nome: 'Excesso de Velocidade / FAI', formato: 'contagem', direcao: 'menor' },
  { id: 'tri', nome: 'TRI', formato: 'contagem', direcao: 'menor' },
] as const

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtContagem(v: number): string {
  return Math.round(v).toLocaleString('pt-BR')
}

interface LinhaDto {
  key: string
  unidade: string
  nome: string
  /** ROTA/ARM quando a unidade abre por negócio (Camaçari) — CONS nas demais. */
  negocio: string
  meta: number | null
  meses: (number | null)[]
}

/**
 * DTO é um indicador só, mas a apuração vem de duas fontes: o BI (T2, uma
 * linha por unidade) e a planilha de inspeção por colaborador (T1, calculada
 * na importação) — usada pras operações "empurrada" que o BI não cobre. Uma
 * unidade com split de negócio (ex: Camaçari) aparece duas vezes: ROTA (T2) e
 * ARM (T1). Tabela de indicadores fora do DRE, separada da de indicadores do
 * DRE (IndicadoresDreCard).
 */
export function IndicadoresForaDreCard() {
  const { unidades } = useUnidades()
  const [indId, setIndId] = useState<(typeof INDICADORES_FORA_DRE)[number]['id']>(INDICADORES_FORA_DRE[0].id)
  const ind = INDICADORES_FORA_DRE.find(i => i.id === indId) ?? INDICADORES_FORA_DRE[0]

  const [resultadosDtoT2, setResultadosDtoT2] = useState<ResultadoDtoT2[]>([])
  const [dtoT2Meta, setDtoT2Meta] = useState<DtoT2Meta | null>(null)
  const [resultadosDtoT1, setResultadosDtoT1] = useState<ResultadoDtoT1[]>([])
  const [dtoT1Metas, setDtoT1Metas] = useState<Map<string, DtoT1Meta>>(new Map())
  const [resultadosGsd, setResultadosGsd] = useState<ResultadoGsd[]>([])
  const [gsdMeta, setGsdMeta] = useState<GsdMeta | null>(null)
  const [resultadosLogon, setResultadosLogon] = useState<ResultadoLogon[]>([])
  const [logonMeta, setLogonMeta] = useState<LogonMeta | null>(null)
  const [resultadosExcessoVelocidade, setResultadosExcessoVelocidade] = useState<ResultadoExcessoVelocidade[]>([])
  const [excessoVelocidadeMetas, setExcessoVelocidadeMetas] = useState<Map<string, ExcessoVelocidadeMeta>>(new Map())
  const [resultadosFai, setResultadosFai] = useState<ResultadoFai[]>([])
  const [faiMetas, setFaiMetas] = useState<Map<string, FaiMeta>>(new Map())
  const [resultadosTri, setResultadosTri] = useState<ResultadoTri[]>([])
  const [triMeta, setTriMeta] = useState<TriMeta | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const [r2, m2, r1, m1, rg, mg, rl, ml, rv, mv, rf, mf, rt, mt] = await Promise.all([
        supabase.from('resultados_dto_t2').select('*'),
        supabase.from('rv_dto_t2_meta').select('*').maybeSingle(),
        supabase.from('resultados_dto_t1').select('*'),
        supabase.from('rv_dto_t1_meta').select('*'),
        supabase.from('resultados_gsd').select('*'),
        supabase.from('rv_gsd_meta').select('*').maybeSingle(),
        supabase.from('resultados_logon').select('*'),
        supabase.from('rv_logon_meta').select('*').maybeSingle(),
        supabase.from('resultados_excesso_velocidade').select('*'),
        supabase.from('rv_excesso_velocidade_meta').select('*'),
        supabase.from('resultados_fai').select('*'),
        supabase.from('rv_fai_meta').select('*'),
        supabase.from('resultados_tri').select('*'),
        supabase.from('rv_tri_meta').select('*').maybeSingle(),
      ])
      setResultadosDtoT2((r2.data as ResultadoDtoT2[]) ?? [])
      setDtoT2Meta(m2.data as DtoT2Meta | null)
      setResultadosDtoT1((r1.data as ResultadoDtoT1[]) ?? [])
      setDtoT1Metas(new Map(((m1.data as DtoT1Meta[]) ?? []).map(x => [x.unidade, x])))
      setResultadosGsd((rg.data as ResultadoGsd[]) ?? [])
      setGsdMeta(mg.data as GsdMeta | null)
      setResultadosLogon((rl.data as ResultadoLogon[]) ?? [])
      setLogonMeta(ml.data as LogonMeta | null)
      setResultadosExcessoVelocidade((rv.data as ResultadoExcessoVelocidade[]) ?? [])
      setExcessoVelocidadeMetas(new Map(((mv.data as ExcessoVelocidadeMeta[]) ?? []).map(x => [x.unidade, x])))
      setResultadosFai((rf.data as ResultadoFai[]) ?? [])
      setFaiMetas(new Map(((mf.data as FaiMeta[]) ?? []).map(x => [x.unidade, x])))
      setResultadosTri((rt.data as ResultadoTri[]) ?? [])
      setTriMeta(mt.data as TriMeta | null)
      setCarregando(false)
    }
    carregar()
  }, [])

  const anosDisponiveis = useMemo(
    () => Array.from(new Set([
      ...resultadosDtoT2.map(r => r.ano),
      ...resultadosDtoT1.map(r => r.ano),
      ...resultadosGsd.map(r => r.ano),
      ...resultadosLogon.map(r => r.ano),
      ...resultadosExcessoVelocidade.map(r => r.ano),
      ...resultadosFai.map(r => r.ano),
      ...resultadosTri.map(r => r.ano),
    ])).sort((a, b) => b - a),
    [resultadosDtoT2, resultadosDtoT1, resultadosGsd, resultadosLogon, resultadosExcessoVelocidade, resultadosFai, resultadosTri],
  )
  const [ano, setAno] = useState('')
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(ano))) setAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, ano])

  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  function meses(
    resultados: { unidade: string; negocio?: string; ano: number; mes: number; valor: number }[],
    codigo: string,
    anoNum: number,
    negocio?: string,
  ) {
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      return resultados.find(r =>
        r.unidade === codigo && r.ano === anoNum && r.mes === mes && (negocio === undefined || r.negocio === negocio),
      )?.valor ?? null
    })
  }

  const linhasDto = useMemo<LinhaDto[]>(() => {
    const anoNum = Number(ano)
    if (!anoNum) return []

    const linhas: LinhaDto[] = []

    const codigosT2 = Array.from(new Set(resultadosDtoT2.filter(r => r.ano === anoNum).map(r => r.unidade)))
    for (const codigo of codigosT2) {
      const nome = nomesUnidades.get(codigo) ?? codigo
      linhas.push({
        key: `${codigo}|t2`,
        unidade: codigo,
        nome,
        negocio: unidadeSplitNegocio(codigo, nome) ? 'ROTA' : 'CONS',
        meta: dtoT2Meta?.meta_pct ?? null,
        meses: meses(resultadosDtoT2, codigo, anoNum),
      })
    }

    const codigosT1 = Array.from(new Set(resultadosDtoT1.filter(r => r.ano === anoNum).map(r => r.unidade)))
    for (const codigo of codigosT1) {
      const nome = nomesUnidades.get(codigo) ?? codigo
      linhas.push({
        key: `${codigo}|t1`,
        unidade: codigo,
        nome,
        negocio: unidadeSplitNegocio(codigo, nome) ? 'ARM' : 'CONS',
        meta: dtoT1Metas.get(codigo)?.meta_pct ?? null,
        meses: meses(resultadosDtoT1, codigo, anoNum),
      })
    }

    return linhas.sort((a, b) => a.nome.localeCompare(b.nome) || a.negocio.localeCompare(b.negocio))
  }, [resultadosDtoT2, resultadosDtoT1, dtoT2Meta, dtoT1Metas, ano, nomesUnidades])

  const linhasGsd = useMemo<LinhaDto[]>(() => {
    const anoNum = Number(ano)
    if (!anoNum) return []

    const chaves = Array.from(new Set(
      resultadosGsd.filter(r => r.ano === anoNum).map(r => `${r.unidade}|${r.negocio}`),
    ))
    return chaves
      .map(chave => {
        const [codigo, negocio] = chave.split('|')
        return {
          key: chave,
          unidade: codigo,
          nome: nomesUnidades.get(codigo) ?? codigo,
          negocio,
          meta: gsdMeta?.meta_pct ?? null,
          meses: meses(resultadosGsd, codigo, anoNum, negocio),
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome) || a.negocio.localeCompare(b.negocio))
  }, [resultadosGsd, gsdMeta, ano, nomesUnidades])

  const linhasLogon = useMemo<LinhaDto[]>(() => {
    const anoNum = Number(ano)
    if (!anoNum) return []

    const chaves = Array.from(new Set(
      resultadosLogon.filter(r => r.ano === anoNum).map(r => `${r.unidade}|${r.negocio}`),
    ))
    return chaves
      .map(chave => {
        const [codigo, negocio] = chave.split('|')
        return {
          key: chave,
          unidade: codigo,
          nome: nomesUnidades.get(codigo) ?? codigo,
          negocio,
          meta: logonMeta?.meta_pct ?? null,
          meses: meses(resultadosLogon, codigo, anoNum, negocio),
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome) || a.negocio.localeCompare(b.negocio))
  }, [resultadosLogon, logonMeta, ano, nomesUnidades])

  const linhasExcessoVelocidade = useMemo<LinhaDto[]>(() => {
    const anoNum = Number(ano)
    if (!anoNum) return []

    const linhas: LinhaDto[] = []

    const codigosExcesso = Array.from(new Set(resultadosExcessoVelocidade.filter(r => r.ano === anoNum).map(r => r.unidade)))
    for (const codigo of codigosExcesso) {
      const nome = nomesUnidades.get(codigo) ?? codigo
      linhas.push({
        key: `${codigo}|excesso`,
        unidade: codigo,
        nome,
        negocio: unidadeSplitNegocio(codigo, nome) ? 'ROTA' : 'CONS',
        meta: excessoVelocidadeMetas.get(codigo)?.meta_max ?? null,
        meses: meses(resultadosExcessoVelocidade, codigo, anoNum),
      })
    }

    const codigosFai = Array.from(new Set(resultadosFai.filter(r => r.ano === anoNum).map(r => r.unidade)))
    for (const codigo of codigosFai) {
      const nome = nomesUnidades.get(codigo) ?? codigo
      linhas.push({
        key: `${codigo}|fai`,
        unidade: codigo,
        nome,
        negocio: unidadeSplitNegocio(codigo, nome) ? 'ARM' : 'CONS',
        meta: faiMetas.get(codigo)?.meta_max ?? null,
        meses: meses(resultadosFai, codigo, anoNum),
      })
    }

    return linhas.sort((a, b) => a.nome.localeCompare(b.nome) || a.negocio.localeCompare(b.negocio))
  }, [resultadosExcessoVelocidade, excessoVelocidadeMetas, resultadosFai, faiMetas, ano, nomesUnidades])

  const linhasTri = useMemo<LinhaDto[]>(() => {
    const anoNum = Number(ano)
    if (!anoNum) return []

    const codigos = Array.from(new Set(resultadosTri.filter(r => r.ano === anoNum).map(r => r.unidade)))
    return codigos
      .map(codigo => ({
        key: codigo,
        unidade: codigo,
        nome: nomesUnidades.get(codigo) ?? codigo,
        negocio: 'CONS',
        meta: triMeta?.meta_max ?? null,
        meses: meses(resultadosTri, codigo, anoNum),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [resultadosTri, triMeta, ano, nomesUnidades])

  const linhas = indId === 'gsd'
    ? linhasGsd
    : indId === 'logon'
      ? linhasLogon
      : indId === 'excesso_velocidade'
        ? linhasExcessoVelocidade
        : indId === 'tri'
          ? linhasTri
          : linhasDto

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Indicador (fora do DRE)</Label>
          <Select value={indId} onValueChange={v => setIndId(v as typeof indId)}>
            <SelectTrigger className={cn('w-64', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {INDICADORES_FORA_DRE.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
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
        titulo={ind.nome}
        subtitulo={carregando
          ? 'Carregando...'
          : indId === 'dto'
            ? `${ano} · % do mês vs meta · quanto maior melhor · unidades com Rota e Armazém aparecem em duas linhas`
            : indId === 'excesso_velocidade'
              ? `${ano} · contagem do mês vs meta · quanto menor melhor · Camaçari aparece em duas linhas (Rota = Excesso de Velocidade, Armazém = FAI)`
              : ind.direcao === 'menor'
                ? `${ano} · contagem do mês vs meta · quanto menor melhor`
                : `${ano} · % do mês vs meta · quanto maior melhor`}
      >
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : linhas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {indId === 'tri'
              ? 'Nenhum acidente grave registrado nesse ano — sem registro conta como zero em todas as unidades.'
              : 'Sem resultados importados — importe na página Importação, aba Segurança.'}
          </p>
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
              {linhas.map(l => (
                <TableRow key={l.key} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="text-sm font-medium">
                    {l.nome}
                    {l.meta === null && <span className="ml-1 text-[10px] text-muted-foreground">(sem meta)</span>}
                  </TableCell>
                  <TableCell className={cn(
                    'text-sm',
                    l.negocio === 'CONS' ? 'text-muted-foreground' : 'font-semibold text-blue-600 dark:text-blue-400',
                  )}>
                    {l.negocio}
                  </TableCell>
                  {l.meses.map((valor, i) => {
                    if (valor === null) {
                      return <TableCell key={i} className="text-center text-xs text-muted-foreground">—</TableCell>
                    }
                    const fmt = ind.formato === 'contagem' ? fmtContagem : fmtPct
                    const sufixo = ind.formato === 'contagem' ? '' : '%'
                    const bateu = l.meta === null ? null : ind.direcao === 'menor' ? valor <= l.meta : valor >= l.meta
                    return (
                      <TableCell
                        key={i}
                        title={l.meta !== null ? `Meta: ${fmt(l.meta)}${sufixo}` : 'Sem meta cadastrada'}
                        className={cn(
                          'text-center text-xs font-medium tabular-nums',
                          bateu === null
                            ? 'text-foreground'
                            : bateu
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                        )}
                      >
                        {fmt(valor)}{sufixo}
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
