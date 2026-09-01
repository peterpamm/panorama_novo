import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import { useIndicadorDreMatriz, linhasDreParaIndicador } from '@/hooks/useIndicadorDreMatriz'
import { avrPorPrefixo, normalizarParaCalculo } from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { negocioDreFrotaT1, OPERACOES_FROTA_EMPILHADEIRA, OPERACOES_FROTA_MANUTENCAO, OPERACOES_FROTA_T1, resolverUnidadesFrotaT1 } from '@/lib/rv-frota-t1'
import { RV_FROTA_DRE } from '@/lib/constants'
import { TabelaIndicadorGenerica, type CelulaIndicador, type LinhaIndicador } from '@/components/rv/TabelaIndicadorGenerica'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'
import type { ResultadoDescontoCivf, ResultadoDescontoStressTest, Unidade } from '@/types'

const PREFIXO_DRE = 'dre:'
const chaveDre = (id: string) => `${PREFIXO_DRE}${id}`

const INDICADORES_DESCONTO = [
  { id: 'civf', nome: 'Desconto CIVF', tabelaResultado: 'resultados_desconto_civf', tabelaMeta: 'rv_desconto_civf_meta' },
  { id: 'stress_test', nome: 'Desconto Stress Test', tabelaResultado: 'resultados_desconto_stress_test', tabelaMeta: 'rv_desconto_stress_test_meta' },
] as const
type IndicadorDescontoId = (typeof INDICADORES_DESCONTO)[number]['id']
const PREFIXO_DESCONTO = 'desconto:'
const chaveDesconto = (id: string) => `${PREFIXO_DESCONTO}${id}`

interface IndicadorFrotaT1 {
  id: string
  nome: string
  operacoes: string[]
  formato: 'pct' | 'valor'
  fonte: 'dre' | 'importado'
  tabelaResultado?: string
  tabelaMeta?: string
  natureza: 'menor' | 'maior'
}
const INDICADORES_T1: IndicadorFrotaT1[] = [
  { id: 'custos_gerais', nome: 'Custos Gerais Frota (DRE 113)', operacoes: OPERACOES_FROTA_T1, formato: 'pct', fonte: 'dre', natureza: 'menor' },
  { id: 'ad_checklist', nome: 'Ad. Check List', operacoes: OPERACOES_FROTA_T1, formato: 'pct', fonte: 'importado', tabelaResultado: 'resultados_ad_checklist_frota', tabelaMeta: 'rv_frota_ad_checklist_meta', natureza: 'maior' },
  { id: 'ad_milimetragem', nome: 'Ad. Milimetragem', operacoes: OPERACOES_FROTA_T1, formato: 'pct', fonte: 'importado', tabelaResultado: 'resultados_ad_milimetragem_frota', tabelaMeta: 'rv_frota_ad_milimetragem_meta', natureza: 'maior' },
  { id: 'indisp_manutencao', nome: 'Indisponibilidade Manutenção', operacoes: OPERACOES_FROTA_MANUTENCAO, formato: 'pct', fonte: 'importado', tabelaResultado: 'resultados_indisp_manutencao_frota', tabelaMeta: 'rv_frota_indisp_manutencao_meta', natureza: 'menor' },
  { id: 'disp_empilhadeira', nome: 'Disponibilidade Empilhadeira', operacoes: OPERACOES_FROTA_EMPILHADEIRA, formato: 'pct', fonte: 'importado', tabelaResultado: 'resultados_disp_empilhadeira_frota', tabelaMeta: 'rv_frota_disp_empilhadeira_meta', natureza: 'maior' },
]
const PREFIXO_T1 = 't1:'
const chaveT1 = (id: string) => `${PREFIXO_T1}${id}`

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface LinhaDesconto {
  unidade: string
  nome: string
  meses: (number | null)[]
}

interface ResultadoImportadoT1 { unidade: string; ano: number; mes: number; valor: number }
interface MetaFrotaT1 { meta_pct?: number; meta_valor?: number; peso: number }

/**
 * Acompanhamento da RV de Frota — seletor único combinando os indicadores com
 * origem no DRE (Manutenção, Pneus, Diesel), os Descontos (CIVF, Stress Test)
 * e os 5 indicadores específicos das 3 lideranças T1 (Estância, Ponta Grossa
 * e CDR Bahia). Antes viviam em três cards/seletores separados
 * (IndicadoresDreCard + DescontosFrotaCard + FrotaT1Card).
 */
export function AcompanhamentoFrotaTab() {
  const { unidades } = useUnidades()
  const { rows: rowsDre, loading: loadingDre } = useDreLongoTodasUnidades()
  const { orcamentos, loading: loadingOrcamento } = useOrcamentoTodasUnidades()

  const [verIndicadorChave, setVerIndicadorChave] = useState(chaveDre(RV_FROTA_DRE[0].id))
  const fonte: 'dre' | 'desconto' | 't1' = verIndicadorChave.startsWith(PREFIXO_DESCONTO)
    ? 'desconto'
    : verIndicadorChave.startsWith(PREFIXO_T1) ? 't1' : 'dre'
  const idDre = fonte === 'dre' ? verIndicadorChave.slice(PREFIXO_DRE.length) : RV_FROTA_DRE[0].id
  const idDesconto = (fonte === 'desconto' ? verIndicadorChave.slice(PREFIXO_DESCONTO.length) : INDICADORES_DESCONTO[0].id) as IndicadorDescontoId
  const idT1 = fonte === 't1' ? verIndicadorChave.slice(PREFIXO_T1.length) : INDICADORES_T1[0].id
  const indT1 = INDICADORES_T1.find(i => i.id === idT1) ?? INDICADORES_T1[0]

  // ── Descontos (CIVF / Stress Test) ──────────────────────────────────────
  const indDesconto = INDICADORES_DESCONTO.find(i => i.id === idDesconto) ?? INDICADORES_DESCONTO[0]
  const [resultadosDesconto, setResultadosDesconto] = useState<(ResultadoDescontoCivf | ResultadoDescontoStressTest)[]>([])
  const [metaDesconto, setMetaDesconto] = useState<{ meta_valor: number; peso: number } | null>(null)
  const [carregandoDesconto, setCarregandoDesconto] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregandoDesconto(true)
      const [r, m] = await Promise.all([
        supabase.from(indDesconto.tabelaResultado).select('*'),
        supabase.from(indDesconto.tabelaMeta).select('*').maybeSingle(),
      ])
      setResultadosDesconto((r.data as (ResultadoDescontoCivf | ResultadoDescontoStressTest)[]) ?? [])
      setMetaDesconto(m.data as { meta_valor: number; peso: number } | null)
      setCarregandoDesconto(false)
    }
    carregar()
  }, [indDesconto.tabelaResultado, indDesconto.tabelaMeta])

  // ── T1 (importados) ──────────────────────────────────────────────────────
  const [resultadosT1, setResultadosT1] = useState<ResultadoImportadoT1[]>([])
  const [metaT1, setMetaT1] = useState<MetaFrotaT1 | null>(null)
  const [carregandoT1, setCarregandoT1] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregandoT1(true)
      if (indT1.fonte === 'dre') {
        setResultadosT1([])
        setMetaT1(null)
        setCarregandoT1(false)
        return
      }
      const [r, m] = await Promise.all([
        supabase.from(indT1.tabelaResultado!).select('*'),
        supabase.from(indT1.tabelaMeta!).select('*').maybeSingle(),
      ])
      setResultadosT1((r.data as ResultadoImportadoT1[]) ?? [])
      setMetaT1(m.data as MetaFrotaT1 | null)
      setCarregandoT1(false)
    }
    carregar()
  }, [indT1])

  const unidadesAlvoT1 = useMemo(() => resolverUnidadesFrotaT1(indT1.operacoes, unidades), [indT1, unidades])

  // ── Ano único ────────────────────────────────────────────────────────────
  const [verAno, setVerAno] = useState('')
  const { matriz, carregando: carregandoDre, anosDisponiveis: anosDre, ind: indDreSel } = useIndicadorDreMatriz(
    RV_FROTA_DRE, idDre, verAno ? Number(verAno) : null,
  )
  const anosDesconto = useMemo(
    () => Array.from(new Set(resultadosDesconto.map(r => r.ano))).sort((a, b) => b - a),
    [resultadosDesconto],
  )
  const anosT1 = useMemo(() => {
    if (indT1.fonte === 'dre') return Array.from(new Set(rowsDre.filter(r => r.tipo_periodo === 'MENSAL').map(r => r.ano))).sort((a, b) => b - a)
    return Array.from(new Set(resultadosT1.map(r => r.ano))).sort((a, b) => b - a)
  }, [indT1.fonte, rowsDre, resultadosT1])

  const anosDisponiveis = fonte === 'dre' ? anosDre : fonte === 'desconto' ? anosDesconto : anosT1
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(verAno))) setVerAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, verAno])
  const ano = Number(verAno)

  const linhasDre = useMemo(() => linhasDreParaIndicador(matriz), [matriz])

  const linhasDescontoBrutas = useMemo<LinhaDesconto[]>(() => {
    const doAno = resultadosDesconto.filter(r => r.ano === ano)
    if (!ano || doAno.length === 0) return []
    const codigos = Array.from(new Set(doAno.map(r => r.unidade)))
    const nomesUnidades = new Map(unidades.map(u => [u.codigo, u.nome]))
    return codigos
      .sort((a, b) => (nomesUnidades.get(a) ?? a).localeCompare(nomesUnidades.get(b) ?? b))
      .map(codigo => ({
        unidade: codigo,
        nome: nomesUnidades.get(codigo) ?? codigo,
        meses: Array.from({ length: 12 }, (_, i) => doAno.find(r => r.unidade === codigo && r.mes === i + 1)?.valor ?? null),
      }))
  }, [resultadosDesconto, ano, unidades])

  const linhasDesconto = useMemo<LinhaIndicador[]>(() => linhasDescontoBrutas.map(l => ({
    key: l.unidade,
    nome: l.nome,
    meses: l.meses.map((valor): CelulaIndicador | null => {
      if (valor === null) return null
      return {
        texto: fmtValor(valor),
        tooltip: metaDesconto !== null ? `Meta: R$ ${fmtValor(metaDesconto.meta_valor)}` : 'Sem meta cadastrada',
        bateu: metaDesconto === null ? null : valor <= metaDesconto.meta_valor,
      }
    }),
  })), [linhasDescontoBrutas, metaDesconto])

  function valorDoMesT1(unidade: Unidade, mes: number): number | null {
    if (indT1.fonte === 'dre') {
      const negocio = negocioDreFrotaT1(unidade.codigo, unidades)
      const rowsMes = rowsDre.filter(r => r.unidade === unidade.codigo && r.negocio === negocio && r.tipo_periodo === 'MENSAL' && r.ano === ano && r.mes === mes)
      if (rowsMes.length === 0) return null
      return avrPorPrefixo(normalizarParaCalculo(rowsMes), ['113'])
    }
    return resultadosT1.find(r => r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor ?? null
  }
  function metaDoMesT1(unidade: Unidade, mes: number): number | undefined {
    if (indT1.fonte === 'dre') {
      const negocio = negocioDreFrotaT1(unidade.codigo, unidades)
      return buscarMetaOrcamento(orcamentos, { unidade: unidade.codigo, negocio, ano, codigo: '113', mes }) ?? undefined
    }
    return metaT1 ? (indT1.formato === 'pct' ? metaT1.meta_pct : metaT1.meta_valor) : undefined
  }

  const linhasT1 = useMemo<LinhaIndicador[]>(() => unidadesAlvoT1.map(u => ({
    key: u.codigo,
    nome: u.nome,
    meses: Array.from({ length: 12 }, (_, i): CelulaIndicador | null => {
      const mes = i + 1
      const valor = valorDoMesT1(u, mes)
      if (valor === null) return null
      const meta = metaDoMesT1(u, mes)
      const bateu = meta === undefined ? null : (indT1.natureza === 'menor' ? valor <= meta : valor >= meta)
      return {
        texto: indT1.formato === 'pct' ? `${fmtPct(valor)}%` : fmtValor(valor),
        tooltip: meta !== undefined ? `Meta: ${indT1.formato === 'pct' ? `${fmtPct(meta)}%` : `R$ ${fmtValor(meta)}`}` : 'Sem meta cadastrada',
        bateu,
      }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [unidadesAlvoT1, indT1, ano, rowsDre, orcamentos, resultadosT1, metaT1, unidades])

  const linhas = fonte === 'dre' ? linhasDre : fonte === 'desconto' ? linhasDesconto : linhasT1
  const carregandoT1Tudo = carregandoT1 || (indT1.fonte === 'dre' && (loadingDre || loadingOrcamento))
  const carregando = fonte === 'dre' ? carregandoDre : fonte === 'desconto' ? carregandoDesconto : carregandoT1Tudo

  const titulo = fonte === 'dre' ? indDreSel.nome : fonte === 'desconto' ? indDesconto.nome : indT1.nome
  const subtitulo = fonte === 'dre'
    ? (indDreSel.tipo === 'avr'
      ? `${verAno} · AVR do mês vs meta do Orçamento · quanto menor melhor · verde = meta batida, vermelho = meta perdida`
      : `${verAno} · dispersão do mês (coluna diferença do DRE, contas ${indDreSel.prefixos.join(' + ')}) · verde = sem estouro (≥ 0)`)
    : fonte === 'desconto'
      ? `${verAno} · resultado do mês (R$) vs meta · quanto menor melhor`
      : `${verAno} · resultado do mês (${indT1.formato === 'pct' ? '%' : 'R$'}) vs meta${indT1.fonte === 'dre' ? ' do Orçamento (por mês)' : ' única (mesma pra todas as unidades)'} · quanto ${indT1.natureza === 'menor' ? 'menor' : 'maior'} melhor`
  const semDados = fonte === 'dre'
    ? 'Sem dados do DRE pra esse ano.'
    : fonte === 'desconto'
      ? 'Sem resultados importados — importe na aba Importação desta página.'
      : 'Nenhuma unidade reconhecida — cadastre o apelido na Administração se o nome for diferente.'

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
                {RV_FROTA_DRE.map(i => <SelectItem key={chaveDre(i.id)} value={chaveDre(i.id)}>{i.nome}</SelectItem>)}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Descontos</SelectLabel>
                {INDICADORES_DESCONTO.map(i => <SelectItem key={chaveDesconto(i.id)} value={chaveDesconto(i.id)}>{i.nome}</SelectItem>)}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Frota T1 (Estância/Ponta Grossa/CDR Bahia)</SelectLabel>
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
        mostrarNegocio={fonte === 'dre'}
        semDadosTexto={semDados}
      />
    </div>
  )
}
