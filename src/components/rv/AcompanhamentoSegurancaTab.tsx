import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useIndicadorDreMatriz, linhasDreParaIndicador } from '@/hooks/useIndicadorDreMatriz'
import { RV_SEGURANCA_DRE } from '@/lib/constants'
import { unidadeSplitNegocio } from '@/lib/rv-gente'
import { TabelaIndicadorGenerica, type CelulaIndicador, type LinhaIndicador } from '@/components/rv/TabelaIndicadorGenerica'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'
import type { DtoT1Meta, DtoT2Meta, ExcessoVelocidadeMeta, FaiMeta, GsdMeta, LogonMeta, ResultadoDtoT1, ResultadoDtoT2, ResultadoExcessoVelocidade, ResultadoFai, ResultadoGsd, ResultadoLogon, ResultadoTri, TriMeta } from '@/types'

const PREFIXO_DRE = 'dre:'
const chaveDre = (id: string) => `${PREFIXO_DRE}${id}`

/**
 * Indicadores de RV que não vêm do DRE — `formato`/`direcao` controlam como o
 * valor é exibido e comparado com a meta: % (quanto maior melhor) ou
 * contagem (quanto menor melhor, ex: nº de excessos).
 */
const INDICADORES_FORA_DRE = [
  { id: 'dto', nome: 'DTO (T1/T2)', formato: 'pct', direcao: 'maior' },
  { id: 'gsd', nome: 'GSD', formato: 'pct', direcao: 'maior' },
  { id: 'logon', nome: 'LogOn', formato: 'pct', direcao: 'maior' },
  { id: 'excesso_velocidade', nome: 'Excesso de Velocidade / FAI', formato: 'contagem', direcao: 'menor' },
  { id: 'tri', nome: 'TRI', formato: 'contagem', direcao: 'menor' },
] as const
type IndicadorForaDreId = (typeof INDICADORES_FORA_DRE)[number]['id']

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtContagem(v: number): string {
  return Math.round(v).toLocaleString('pt-BR')
}

interface LinhaBruta {
  key: string
  unidade: string
  nome: string
  negocio: string
  meta: number | null
  meses: (number | null)[]
}

/**
 * Acompanhamento da RV de Segurança — seletor único combinando os
 * indicadores com origem no DRE (EPI's, Uniformes) e os de fora do DRE (DTO,
 * GSD, LogOn, Excesso de Velocidade/FAI, TRI) — antes viviam em dois
 * cards/seletores separados (IndicadoresDreCard + IndicadoresForaDreCard).
 * DTO é um indicador só, mas a apuração vem de duas fontes: o BI (T2, uma
 * linha por unidade) e a planilha de inspeção por colaborador (T1, calculada
 * na importação) — usada pras operações "empurrada" que o BI não cobre. Uma
 * unidade com split de negócio (ex: Camaçari) aparece duas vezes: ROTA (T2) e
 * ARM (T1).
 */
export function AcompanhamentoSegurancaTab() {
  const { unidades } = useUnidades()
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const [verIndicadorChave, setVerIndicadorChave] = useState(chaveDre(RV_SEGURANCA_DRE[0].id))
  const fonte: 'dre' | 'fora' = verIndicadorChave.startsWith(PREFIXO_DRE) ? 'dre' : 'fora'
  const idDre = fonte === 'dre' ? verIndicadorChave.slice(PREFIXO_DRE.length) : RV_SEGURANCA_DRE[0].id
  const idForaDre = (fonte === 'fora' ? verIndicadorChave : INDICADORES_FORA_DRE[0].id) as IndicadorForaDreId

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
  const [carregandoForaDre, setCarregandoForaDre] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregandoForaDre(true)
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
      setCarregandoForaDre(false)
    }
    carregar()
  }, [])

  const anosForaDre = useMemo(
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

  const [verAno, setVerAno] = useState('')
  const { matriz, carregando: carregandoDre, anosDisponiveis: anosDre, ind: indDre } = useIndicadorDreMatriz(
    RV_SEGURANCA_DRE, idDre, verAno ? Number(verAno) : null,
  )
  const anosDisponiveis = useMemo(
    () => fonte === 'dre' ? anosDre : anosForaDre,
    [fonte, anosDre, anosForaDre],
  )
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(verAno))) setVerAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, verAno])

  const linhasDre = useMemo(() => linhasDreParaIndicador(matriz), [matriz])

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

  const ano = Number(verAno)

  const linhasDto = useMemo<LinhaBruta[]>(() => {
    if (!ano) return []
    const linhas: LinhaBruta[] = []

    const codigosT2 = Array.from(new Set(resultadosDtoT2.filter(r => r.ano === ano).map(r => r.unidade)))
    for (const codigo of codigosT2) {
      const nome = nomesUnidades.get(codigo) ?? codigo
      linhas.push({
        key: `${codigo}|t2`, unidade: codigo, nome,
        negocio: unidadeSplitNegocio(codigo, nome) ? 'ROTA' : 'CONS',
        meta: dtoT2Meta?.meta_pct ?? null,
        meses: meses(resultadosDtoT2, codigo, ano),
      })
    }

    const codigosT1 = Array.from(new Set(resultadosDtoT1.filter(r => r.ano === ano).map(r => r.unidade)))
    for (const codigo of codigosT1) {
      const nome = nomesUnidades.get(codigo) ?? codigo
      linhas.push({
        key: `${codigo}|t1`, unidade: codigo, nome,
        negocio: unidadeSplitNegocio(codigo, nome) ? 'ARM' : 'CONS',
        meta: dtoT1Metas.get(codigo)?.meta_pct ?? null,
        meses: meses(resultadosDtoT1, codigo, ano),
      })
    }

    return linhas.sort((a, b) => a.nome.localeCompare(b.nome) || a.negocio.localeCompare(b.negocio))
  }, [resultadosDtoT2, resultadosDtoT1, dtoT2Meta, dtoT1Metas, ano, nomesUnidades])

  const linhasGsd = useMemo<LinhaBruta[]>(() => {
    if (!ano) return []
    const chaves = Array.from(new Set(resultadosGsd.filter(r => r.ano === ano).map(r => `${r.unidade}|${r.negocio}`)))
    return chaves
      .map(chave => {
        const [codigo, negocio] = chave.split('|')
        return {
          key: chave, unidade: codigo, nome: nomesUnidades.get(codigo) ?? codigo, negocio,
          meta: gsdMeta?.meta_pct ?? null,
          meses: meses(resultadosGsd, codigo, ano, negocio),
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome) || a.negocio.localeCompare(b.negocio))
  }, [resultadosGsd, gsdMeta, ano, nomesUnidades])

  const linhasLogon = useMemo<LinhaBruta[]>(() => {
    if (!ano) return []
    const chaves = Array.from(new Set(resultadosLogon.filter(r => r.ano === ano).map(r => `${r.unidade}|${r.negocio}`)))
    return chaves
      .map(chave => {
        const [codigo, negocio] = chave.split('|')
        return {
          key: chave, unidade: codigo, nome: nomesUnidades.get(codigo) ?? codigo, negocio,
          meta: logonMeta?.meta_pct ?? null,
          meses: meses(resultadosLogon, codigo, ano, negocio),
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome) || a.negocio.localeCompare(b.negocio))
  }, [resultadosLogon, logonMeta, ano, nomesUnidades])

  const linhasExcessoVelocidade = useMemo<LinhaBruta[]>(() => {
    if (!ano) return []
    const linhas: LinhaBruta[] = []

    const codigosExcesso = Array.from(new Set(resultadosExcessoVelocidade.filter(r => r.ano === ano).map(r => r.unidade)))
    for (const codigo of codigosExcesso) {
      const nome = nomesUnidades.get(codigo) ?? codigo
      linhas.push({
        key: `${codigo}|excesso`, unidade: codigo, nome,
        negocio: unidadeSplitNegocio(codigo, nome) ? 'ROTA' : 'CONS',
        meta: excessoVelocidadeMetas.get(codigo)?.meta_max ?? null,
        meses: meses(resultadosExcessoVelocidade, codigo, ano),
      })
    }

    const codigosFai = Array.from(new Set(resultadosFai.filter(r => r.ano === ano).map(r => r.unidade)))
    for (const codigo of codigosFai) {
      const nome = nomesUnidades.get(codigo) ?? codigo
      linhas.push({
        key: `${codigo}|fai`, unidade: codigo, nome,
        negocio: unidadeSplitNegocio(codigo, nome) ? 'ARM' : 'CONS',
        meta: faiMetas.get(codigo)?.meta_max ?? null,
        meses: meses(resultadosFai, codigo, ano),
      })
    }

    return linhas.sort((a, b) => a.nome.localeCompare(b.nome) || a.negocio.localeCompare(b.negocio))
  }, [resultadosExcessoVelocidade, excessoVelocidadeMetas, resultadosFai, faiMetas, ano, nomesUnidades])

  const linhasTri = useMemo<LinhaBruta[]>(() => {
    if (!ano) return []
    const codigos = Array.from(new Set(resultadosTri.filter(r => r.ano === ano).map(r => r.unidade)))
    return codigos
      .map(codigo => ({
        key: codigo, unidade: codigo, nome: nomesUnidades.get(codigo) ?? codigo, negocio: 'CONS',
        meta: triMeta?.meta_max ?? null,
        meses: meses(resultadosTri, codigo, ano),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [resultadosTri, triMeta, ano, nomesUnidades])

  const linhasBrutasForaDre: Record<IndicadorForaDreId, LinhaBruta[]> = {
    dto: linhasDto, gsd: linhasGsd, logon: linhasLogon, excesso_velocidade: linhasExcessoVelocidade, tri: linhasTri,
  }

  const indForaDre = INDICADORES_FORA_DRE.find(i => i.id === idForaDre)!
  const linhasForaDre = useMemo<LinhaIndicador[]>(() => {
    const brutas = linhasBrutasForaDre[idForaDre]
    return brutas.map(l => ({
      key: l.key,
      nome: l.nome,
      negocio: l.negocio,
      meses: l.meses.map((valor): CelulaIndicador | null => {
        if (valor === null) return null
        const fmt = indForaDre.formato === 'contagem' ? fmtContagem : fmtPct
        const sufixo = indForaDre.formato === 'contagem' ? '' : '%'
        return {
          texto: `${fmt(valor)}${sufixo}`,
          tooltip: l.meta !== null ? `Meta: ${fmt(l.meta)}${sufixo}` : 'Sem meta cadastrada',
          bateu: l.meta === null ? null : indForaDre.direcao === 'menor' ? valor <= l.meta : valor >= l.meta,
        }
      }),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idForaDre, linhasDto, linhasGsd, linhasLogon, linhasExcessoVelocidade, linhasTri])

  const linhas = fonte === 'dre' ? linhasDre : linhasForaDre
  const carregando = fonte === 'dre' ? carregandoDre : carregandoForaDre
  const titulo = fonte === 'dre' ? indDre.nome : indForaDre.nome
  const subtitulo = fonte === 'dre'
    ? (indDre.tipo === 'avr'
      ? `${verAno} · AVR do mês vs meta do Orçamento · quanto menor melhor · verde = meta batida, vermelho = meta perdida`
      : `${verAno} · dispersão do mês (coluna diferença do DRE, contas ${indDre.prefixos.join(' + ')}) · verde = sem estouro (≥ 0)`)
    : idForaDre === 'dto'
      ? `${verAno} · % do mês vs meta · quanto maior melhor · unidades com Rota e Armazém aparecem em duas linhas`
      : idForaDre === 'excesso_velocidade'
        ? `${verAno} · contagem do mês vs meta · quanto menor melhor · Camaçari aparece em duas linhas (Rota = Excesso de Velocidade, Armazém = FAI)`
        : indForaDre.direcao === 'menor'
          ? `${verAno} · contagem do mês vs meta · quanto menor melhor`
          : `${verAno} · % do mês vs meta · quanto maior melhor`
  const semDados = fonte === 'dre'
    ? 'Sem dados do DRE pra esse ano.'
    : idForaDre === 'tri'
      ? 'Nenhum acidente grave registrado nesse ano — sem registro conta como zero em todas as unidades.'
      : 'Sem resultados importados — importe na aba Importação desta página.'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Indicador</Label>
          <Select value={verIndicadorChave} onValueChange={setVerIndicadorChave}>
            <SelectTrigger className={cn('w-72', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Indicadores do DRE</SelectLabel>
                {RV_SEGURANCA_DRE.map(i => <SelectItem key={chaveDre(i.id)} value={chaveDre(i.id)}>{i.nome}</SelectItem>)}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Indicadores fora do DRE</SelectLabel>
                {INDICADORES_FORA_DRE.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
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
        mostrarNegocio
        semDadosTexto={semDados}
      />
    </div>
  )
}
