import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import { useValesIndicador } from '@/hooks/useValesIndicador'
import { RV_DISTRIBUICAO_DRE } from '@/lib/constants'
import { unidadeSplitNegocio } from '@/lib/rv-gente'
import { avrPorPrefixo, normalizarParaCalculo } from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { TabelaIndicadorGenerica, type CelulaIndicador, type LinhaIndicador } from '@/components/rv/TabelaIndicadorGenerica'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'
import type { MetaDevolucao, MetaPresenteismoDu, PainelPerdasAux, ResultadoDistribuicaoBi } from '@/types'

const INDICADOR_PACOTE_GENTE = RV_DISTRIBUICAO_DRE[0]
const NEGOCIO_PACOTE_GENTE = INDICADOR_PACOTE_GENTE.negocio ?? 'ROTA'

const INDICADORES_DISTRIBUICAO = [
  { id: 'indisponibilidade', nome: 'Indisponibilidade' },
  { id: 'pacote_gente', nome: INDICADOR_PACOTE_GENTE.nome },
  { id: 'logon_du', nome: 'LogOn DU' },
  { id: 'devolucao', nome: 'Devolução' },
  { id: 'presenteismo_du', nome: 'Presenteísmo DU' },
] as const
type IndicadorDistribuicaoId = (typeof INDICADORES_DISTRIBUICAO)[number]['id']
const ID_VALES = 'vales'

interface IndisponibilidadeMeta {
  meta_valor: number
  peso: number
}

interface LogonDuMeta {
  meta_pct: number
  peso: number
}

function fmtValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Acompanhamento da RV de Distribuição — seletor único combinando
 * Indisponibilidade (mesmo dado do Painel de Perdas), Pacote de Gente
 * (158, origem no DRE), LogOn DU / Devolução / Presenteísmo DU (planilha
 * compartilhada do BI) e Vales (dispersão do DRE vs % da Meta de Perdas) —
 * antes viviam em dois cards/seletores separados (IndicadoresDistribuicaoCard
 * + ValesPerdasCard).
 */
export function AcompanhamentoDistribuicaoTab() {
  const [verIndicadorChave, setVerIndicadorChave] = useState<IndicadorDistribuicaoId | typeof ID_VALES>('indisponibilidade')
  const { unidades } = useUnidades()
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  // ── Indisponibilidade (painel_perdas_aux) ──────────────────────────────────
  const [resultadosIndisp, setResultadosIndisp] = useState<PainelPerdasAux[]>([])
  const [metaIndisp, setMetaIndisp] = useState<IndisponibilidadeMeta | null>(null)
  const [carregandoIndisp, setCarregandoIndisp] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregandoIndisp(true)
      const [r, m] = await Promise.all([
        supabase.from('painel_perdas_aux').select('*').eq('indicador', 'indisponibilidade'),
        supabase.from('rv_indisponibilidade_meta').select('*').maybeSingle(),
      ])
      setResultadosIndisp((r.data as PainelPerdasAux[]) ?? [])
      setMetaIndisp(m.data as IndisponibilidadeMeta | null)
      setCarregandoIndisp(false)
    }
    carregar()
  }, [])

  // ── Pacote de Gente (DRE) ───────────────────────────────────────────────────
  const { rows: rowsDre, loading: loadingDre } = useDreLongoTodasUnidades()
  const { orcamentos, loading: loadingOrcamento } = useOrcamentoTodasUnidades()

  // ── LogOn DU / Devolução / Presenteísmo DU (planilha compartilhada do BI) ──
  const [resultadosDistribuicaoBi, setResultadosDistribuicaoBi] = useState<ResultadoDistribuicaoBi[]>([])
  const [logonDuMeta, setLogonDuMeta] = useState<LogonDuMeta | null>(null)
  const [devolucaoMetas, setDevolucaoMetas] = useState<Map<string, number>>(new Map())
  const [presenteismoDuMetas, setPresenteismoDuMetas] = useState<MetaPresenteismoDu[]>([])
  const [carregandoDistribuicaoBi, setCarregandoDistribuicaoBi] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregandoDistribuicaoBi(true)
      const [rb, ml, rd, rp] = await Promise.all([
        supabase.from('resultados_distribuicao_bi').select('*'),
        supabase.from('rv_logon_du_meta').select('*').maybeSingle(),
        supabase.from('rv_devolucao_meta').select('*'),
        supabase.from('metas_presenteismo_du').select('*'),
      ])
      setResultadosDistribuicaoBi((rb.data as ResultadoDistribuicaoBi[]) ?? [])
      setLogonDuMeta(ml.data as LogonDuMeta | null)
      setDevolucaoMetas(new Map(((rd.data as MetaDevolucao[]) ?? []).map(x => [x.unidade, Number(x.meta_pct)])))
      setPresenteismoDuMetas((rp.data as MetaPresenteismoDu[]) ?? [])
      setCarregandoDistribuicaoBi(false)
    }
    carregar()
  }, [])

  // ── Vales ────────────────────────────────────────────────────────────────
  const [verAno, setVerAno] = useState('')

  const anosIndisponibilidade = useMemo(
    () => Array.from(new Set(resultadosIndisp.map(r => r.ano))).sort((a, b) => b - a),
    [resultadosIndisp],
  )
  const anosPacoteGente = useMemo(
    () => Array.from(new Set(rowsDre.filter(r => r.tipo_periodo === 'MENSAL').map(r => r.ano))).sort((a, b) => b - a),
    [rowsDre],
  )
  const anosLogonDevolucao = useMemo(
    () => Array.from(new Set(resultadosDistribuicaoBi.map(r => r.ano))).sort((a, b) => b - a),
    [resultadosDistribuicaoBi],
  )
  const anosPresenteismoDu = useMemo(
    () => Array.from(new Set([...resultadosDistribuicaoBi.map(r => r.ano), ...presenteismoDuMetas.map(m => m.ano)])).sort((a, b) => b - a),
    [resultadosDistribuicaoBi, presenteismoDuMetas],
  )
  const { linhas: linhasVales, carregando: carregandoVales, anosDisponiveis: anosVales } = useValesIndicador(
    'rv_vales_distribuicao_meta', verAno ? Number(verAno) : null,
  )

  const anosDisponiveis = useMemo(() => {
    switch (verIndicadorChave) {
      case 'indisponibilidade': return anosIndisponibilidade
      case 'pacote_gente': return anosPacoteGente
      case 'presenteismo_du': return anosPresenteismoDu
      case ID_VALES: return anosVales
      default: return anosLogonDevolucao
    }
  }, [verIndicadorChave, anosIndisponibilidade, anosPacoteGente, anosPresenteismoDu, anosVales, anosLogonDevolucao])

  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(verAno))) setVerAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, verAno])

  const ano = Number(verAno)

  const linhasIndisponibilidade = useMemo<LinhaIndicador[]>(() => {
    if (!ano) return []
    const codigos = Array.from(new Set(resultadosIndisp.filter(r => r.ano === ano).map(r => r.unidade)))
    return codigos
      .map(codigo => ({
        key: codigo,
        nome: nomesUnidades.get(codigo) ?? codigo,
        meses: Array.from({ length: 12 }, (_, i): CelulaIndicador | null => {
          const mes = i + 1
          const valor = resultadosIndisp.find(r => r.unidade === codigo && r.ano === ano && r.mes === mes)?.valor
          if (valor === undefined) return null
          return {
            texto: fmtValor(valor),
            tooltip: metaIndisp !== null ? `Meta: R$ ${fmtValor(metaIndisp.meta_valor)}` : 'Sem meta cadastrada',
            bateu: metaIndisp === null ? null : valor >= metaIndisp.meta_valor,
          }
        }),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [resultadosIndisp, metaIndisp, ano, nomesUnidades])

  const linhasPacoteGente = useMemo<LinhaIndicador[]>(() => {
    const mensalTodas = rowsDre.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === ano)
    if (!ano || mensalTodas.length === 0) return []

    // Unidades com split de verdade (Camaçari, Ponta Grossa — rota e armazém
    // importados separados) usam sempre o negócio ROTA do indicador; as
    // demais (só rota, sem armazém — ex: São Cristóvão) importam o DRE
    // inteiro como CONS, nunca como ROTA — aí CONS já É a rota.
    const negocioDaUnidade = (codigo: string) =>
      unidadeSplitNegocio(codigo, nomesUnidades.get(codigo) ?? codigo) ? NEGOCIO_PACOTE_GENTE : 'CONS'

    const codigosUnidades = Array.from(new Set(
      mensalTodas.filter(r => r.negocio === negocioDaUnidade(r.unidade)).map(r => r.unidade),
    ))
      .sort((a, b) => {
        if (a === 'AMBEV') return 1
        if (b === 'AMBEV') return -1
        return (nomesUnidades.get(a) ?? a).localeCompare(nomesUnidades.get(b) ?? b)
      })

    return codigosUnidades.map(unidade => {
      const negocioUnidade = negocioDaUnidade(unidade)
      const rowsUnidade = mensalTodas.filter(r => r.unidade === unidade && r.negocio === negocioUnidade)
      const meses: (CelulaIndicador | null)[] = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1
        const rowsMes = rowsUnidade.filter(r => r.mes === mes)
        if (rowsMes.length === 0) return null
        const calc = normalizarParaCalculo(rowsMes)
        const avr = avrPorPrefixo(calc, INDICADOR_PACOTE_GENTE.prefixos)
        const meta = buscarMetaOrcamento(orcamentos, {
          unidade, negocio: negocioUnidade, ano, codigo: INDICADOR_PACOTE_GENTE.id, mes,
        })
        return {
          texto: fmtPct(avr),
          tooltip: meta !== null ? `Meta: ${fmtPct(meta)}` : 'Sem meta cadastrada',
          bateu: meta !== null ? avr <= meta : null,
        }
      })
      return { key: unidade, nome: nomesUnidades.get(unidade) ?? unidade, destaque: unidade === 'AMBEV', meses }
    })
  }, [rowsDre, orcamentos, ano, nomesUnidades])

  const linhasLogonDu = useMemo<LinhaIndicador[]>(() => {
    const doIndicador = resultadosDistribuicaoBi.filter(r => r.indicador === 'aderencia_logon_du' && r.ano === ano)
    if (!ano || doIndicador.length === 0) return []
    const codigos = Array.from(new Set(doIndicador.map(r => r.unidade)))
    return codigos
      .map(codigo => ({
        key: codigo,
        nome: nomesUnidades.get(codigo) ?? codigo,
        meses: Array.from({ length: 12 }, (_, i): CelulaIndicador | null => {
          const valor = doIndicador.find(r => r.unidade === codigo && r.mes === i + 1)?.valor
          if (valor === undefined) return null
          return {
            texto: `${fmtPct(valor)}%`,
            tooltip: logonDuMeta !== null ? `Meta: ${fmtPct(logonDuMeta.meta_pct)}%` : 'Sem meta cadastrada',
            bateu: logonDuMeta === null ? null : valor >= logonDuMeta.meta_pct,
          }
        }),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [resultadosDistribuicaoBi, logonDuMeta, ano, nomesUnidades])

  const linhasDevolucao = useMemo<LinhaIndicador[]>(() => {
    const doIndicador = resultadosDistribuicaoBi.filter(r => r.indicador === 'devolucao_pdv' && r.ano === ano)
    if (!ano || doIndicador.length === 0) return []
    const codigos = Array.from(new Set(doIndicador.map(r => r.unidade)))
    return codigos
      .map(codigo => {
        const meta = devolucaoMetas.get(codigo) ?? null
        return {
          key: codigo,
          nome: nomesUnidades.get(codigo) ?? codigo,
          meses: Array.from({ length: 12 }, (_, i): CelulaIndicador | null => {
            const valor = doIndicador.find(r => r.unidade === codigo && r.mes === i + 1)?.valor
            if (valor === undefined) return null
            return {
              texto: `${fmtPct(valor)}%`,
              tooltip: meta !== null ? `Meta: ${fmtPct(meta)}%` : 'Sem meta cadastrada',
              bateu: meta === null ? null : valor <= meta,
            }
          }),
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [resultadosDistribuicaoBi, devolucaoMetas, ano, nomesUnidades])

  const linhasPresenteismoDu = useMemo<LinhaIndicador[]>(() => {
    const doIndicador = resultadosDistribuicaoBi.filter(r => r.indicador === 'presenteismo_du' && r.ano === ano)
    const codigos = Array.from(new Set([
      ...doIndicador.map(r => r.unidade),
      ...presenteismoDuMetas.filter(m => m.ano === ano).map(m => m.unidade),
    ]))
    if (!ano || codigos.length === 0) return []
    return codigos
      .map(codigo => ({
        key: codigo,
        nome: nomesUnidades.get(codigo) ?? codigo,
        meses: Array.from({ length: 12 }, (_, i): CelulaIndicador | null => {
          const mes = i + 1
          const valor = doIndicador.find(r => r.unidade === codigo && r.mes === mes)?.valor
          if (valor === undefined) return null
          const meta = presenteismoDuMetas.find(m => m.unidade === codigo && m.ano === ano && m.mes === mes)?.valor ?? null
          return {
            texto: `${fmtPct(valor)}%`,
            tooltip: meta !== null ? `Meta: ${fmtPct(meta)}%` : 'Sem meta cadastrada',
            bateu: meta === null ? null : valor <= meta,
          }
        }),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [resultadosDistribuicaoBi, presenteismoDuMetas, ano, nomesUnidades])

  const { linhas, carregando, titulo, subtitulo, semDados } = useMemo(() => {
    switch (verIndicadorChave) {
      case 'indisponibilidade':
        return {
          linhas: linhasIndisponibilidade, carregando: carregandoIndisp, titulo: 'Indisponibilidade',
          subtitulo: `${verAno} · resultado do mês (R$) vs meta · mesmo dado do Painel de Perdas`,
          semDados: 'Sem resultados importados — importe na página Importação, aba Painel de Perdas.',
        }
      case 'pacote_gente':
        return {
          linhas: linhasPacoteGente, carregando: loadingDre || loadingOrcamento, titulo: INDICADOR_PACOTE_GENTE.nome,
          subtitulo: `${verAno} · AVR das contas 158+033 (negócio ROTA, ou CONS nas unidades sem split) vs meta do Orçamento · quanto menor melhor · só conta pra lideranças da ROTA na apuração`,
          semDados: 'Sem dados do DRE pra esse ano.',
        }
      case 'logon_du':
        return {
          linhas: linhasLogonDu, carregando: carregandoDistribuicaoBi, titulo: 'LogOn DU',
          subtitulo: `${verAno} · resultado do mês (%) vs meta · quanto maior melhor`,
          semDados: 'Sem resultados importados — importe na aba Importação desta página.',
        }
      case 'devolucao':
        return {
          linhas: linhasDevolucao, carregando: carregandoDistribuicaoBi, titulo: 'Devolução',
          subtitulo: `${verAno} · resultado do mês (%) vs meta · quanto menor melhor`,
          semDados: 'Sem resultados importados — importe na aba Importação desta página.',
        }
      case 'presenteismo_du':
        return {
          linhas: linhasPresenteismoDu, carregando: carregandoDistribuicaoBi, titulo: 'Presenteísmo DU',
          subtitulo: `${verAno} · resultado do mês (%) vs meta importada todo mês · quanto menor melhor`,
          semDados: 'Sem resultados ou meta importados ainda pra esse ano.',
        }
      default:
        return {
          linhas: linhasVales, carregando: carregandoVales, titulo: 'Vales',
          subtitulo: `${verAno} · dispersão do mês (contas 051/052, DRE consolidado) vs % da Meta de Perdas de Vales`,
          semDados: 'Sem dados do DRE pra esse ano.',
        }
    }
  }, [
    verIndicadorChave, verAno,
    linhasIndisponibilidade, carregandoIndisp,
    linhasPacoteGente, loadingDre, loadingOrcamento,
    linhasLogonDu, linhasDevolucao, linhasPresenteismoDu, carregandoDistribuicaoBi,
    linhasVales, carregandoVales,
  ])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Indicador</Label>
          <Select value={verIndicadorChave} onValueChange={v => setVerIndicadorChave(v as typeof verIndicadorChave)}>
            <SelectTrigger className={cn('w-64', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Indicadores</SelectLabel>
                {INDICADORES_DISTRIBUICAO.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Perdas</SelectLabel>
                <SelectItem value={ID_VALES}>Vales</SelectItem>
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
