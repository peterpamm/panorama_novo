import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import { RV_DISTRIBUICAO_DRE } from '@/lib/constants'
import { avrPorPrefixo, normalizarParaCalculo } from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'
import type { MetaDevolucao, MetaPresenteismoDu, PainelPerdasAux, ResultadoDistribuicaoBi } from '@/types'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const INDICADOR_PACOTE_GENTE = RV_DISTRIBUICAO_DRE[0]

const INDICADORES_DISTRIBUICAO = [
  { id: 'indisponibilidade', nome: 'Indisponibilidade' },
  { id: 'pacote_gente', nome: INDICADOR_PACOTE_GENTE.nome },
  { id: 'logon_du', nome: 'LogOn DU' },
  { id: 'devolucao', nome: 'Devolução' },
  { id: 'presenteismo_du', nome: 'Presenteísmo DU' },
] as const

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

interface LinhaIndisponibilidade {
  unidade: string
  nome: string
  meses: (number | null)[]
}

interface LinhaPacoteGente {
  unidade: string
  nome: string
  meses: ({ avr: number; meta: number | null } | null)[]
}

/** LogOn DU e Devolução têm a mesma forma: resultado da planilha do BI vs meta (única ou por unidade). */
interface LinhaDistribuicaoBi {
  unidade: string
  nome: string
  meses: (number | null)[]
}

const NEGOCIO_PACOTE_GENTE = INDICADOR_PACOTE_GENTE.negocio ?? 'ROTA'

/**
 * Acompanhamento dos indicadores de RV da Distribuição — Indisponibilidade
 * (mesmo dado do Painel de Perdas, sem split de negócio), Pacote de Gente
 * (158, contas 158+033, origem no DRE, AVR vs meta do Orçamento — sempre o
 * resultado do negócio ROTA, a mesma regra da apuração, já que é a RV da
 * liderança da rota/distribuição), e LogOn DU / Devolução / Presenteísmo DU
 * (planilha compartilhada do BI, filtrada por indicador — mesmos dados e
 * mesma regra da apuração). Um seletor alterna entre eles. Vales tem card
 * próprio (ValesPerdasCard), reaproveitado também pelo Financeiro.
 */
export function IndicadoresDistribuicaoCard() {
  const [indId, setIndId] = useState<(typeof INDICADORES_DISTRIBUICAO)[number]['id']>('indisponibilidade')
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
  const anosDisponiveis = indId === 'indisponibilidade'
    ? anosIndisponibilidade
    : indId === 'pacote_gente'
      ? anosPacoteGente
      : indId === 'presenteismo_du'
        ? anosPresenteismoDu
        : anosLogonDevolucao

  const [ano, setAno] = useState('')
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(ano))) setAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, ano])

  const linhasIndisponibilidade = useMemo<LinhaIndisponibilidade[]>(() => {
    const anoNum = Number(ano)
    if (!anoNum) return []

    const codigos = Array.from(new Set(resultadosIndisp.filter(r => r.ano === anoNum).map(r => r.unidade)))
    return codigos
      .map(codigo => ({
        unidade: codigo,
        nome: nomesUnidades.get(codigo) ?? codigo,
        meses: Array.from({ length: 12 }, (_, i) => {
          const mes = i + 1
          return resultadosIndisp.find(r => r.unidade === codigo && r.ano === anoNum && r.mes === mes)?.valor ?? null
        }),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [resultadosIndisp, ano, nomesUnidades])

  const linhasPacoteGente = useMemo<LinhaPacoteGente[]>(() => {
    const anoNum = Number(ano)
    // Sempre o negócio ROTA — é a RV da liderança da rota/distribuição, não o consolidado da unidade.
    const mensal = rowsDre.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === anoNum && r.negocio === NEGOCIO_PACOTE_GENTE)
    if (!anoNum || mensal.length === 0) return []

    const codigosUnidades = Array.from(new Set(mensal.map(r => r.unidade)))
      .sort((a, b) => {
        if (a === 'AMBEV') return 1
        if (b === 'AMBEV') return -1
        return (nomesUnidades.get(a) ?? a).localeCompare(nomesUnidades.get(b) ?? b)
      })

    return codigosUnidades.map(unidade => {
      const rowsUnidade = mensal.filter(r => r.unidade === unidade)
      const meses = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1
        const rowsMes = rowsUnidade.filter(r => r.mes === mes)
        if (rowsMes.length === 0) return null
        const calc = normalizarParaCalculo(rowsMes)
        const avr = avrPorPrefixo(calc, INDICADOR_PACOTE_GENTE.prefixos)
        const meta = buscarMetaOrcamento(orcamentos, {
          unidade, negocio: NEGOCIO_PACOTE_GENTE, ano: anoNum, codigo: INDICADOR_PACOTE_GENTE.id, mes,
        })
        return { avr, meta }
      })
      return { unidade, nome: nomesUnidades.get(unidade) ?? unidade, meses }
    })
  }, [rowsDre, orcamentos, ano, nomesUnidades])

  const linhasLogonDu = useMemo<LinhaDistribuicaoBi[]>(() => {
    const anoNum = Number(ano)
    const doIndicador = resultadosDistribuicaoBi.filter(r => r.indicador === 'aderencia_logon_du' && r.ano === anoNum)
    if (!anoNum || doIndicador.length === 0) return []
    const codigos = Array.from(new Set(doIndicador.map(r => r.unidade)))
    return codigos
      .map(codigo => ({
        unidade: codigo,
        nome: nomesUnidades.get(codigo) ?? codigo,
        meses: Array.from({ length: 12 }, (_, i) => doIndicador.find(r => r.unidade === codigo && r.mes === i + 1)?.valor ?? null),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [resultadosDistribuicaoBi, ano, nomesUnidades])

  const linhasDevolucao = useMemo<LinhaDistribuicaoBi[]>(() => {
    const anoNum = Number(ano)
    const doIndicador = resultadosDistribuicaoBi.filter(r => r.indicador === 'devolucao_pdv' && r.ano === anoNum)
    if (!anoNum || doIndicador.length === 0) return []
    const codigos = Array.from(new Set(doIndicador.map(r => r.unidade)))
    return codigos
      .map(codigo => ({
        unidade: codigo,
        nome: nomesUnidades.get(codigo) ?? codigo,
        meses: Array.from({ length: 12 }, (_, i) => doIndicador.find(r => r.unidade === codigo && r.mes === i + 1)?.valor ?? null),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [resultadosDistribuicaoBi, ano, nomesUnidades])

  const linhasPresenteismoDu = useMemo<LinhaDistribuicaoBi[]>(() => {
    const anoNum = Number(ano)
    const doIndicador = resultadosDistribuicaoBi.filter(r => r.indicador === 'presenteismo_du' && r.ano === anoNum)
    const codigos = Array.from(new Set([
      ...doIndicador.map(r => r.unidade),
      ...presenteismoDuMetas.filter(m => m.ano === anoNum).map(m => m.unidade),
    ]))
    if (!anoNum || codigos.length === 0) return []
    return codigos
      .map(codigo => ({
        unidade: codigo,
        nome: nomesUnidades.get(codigo) ?? codigo,
        meses: Array.from({ length: 12 }, (_, i) => doIndicador.find(r => r.unidade === codigo && r.mes === i + 1)?.valor ?? null),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [resultadosDistribuicaoBi, presenteismoDuMetas, ano, nomesUnidades])

  const carregando = indId === 'indisponibilidade'
    ? carregandoIndisp
    : indId === 'pacote_gente'
      ? (loadingDre || loadingOrcamento)
      : carregandoDistribuicaoBi

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Indicador</Label>
          <Select value={indId} onValueChange={v => setIndId(v as typeof indId)}>
            <SelectTrigger className={cn('w-56', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {INDICADORES_DISTRIBUICAO.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
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

      {indId === 'indisponibilidade' ? (
        <TableCard
          titulo="Indisponibilidade"
          subtitulo={carregando
            ? 'Carregando...'
            : `${ano} · resultado do mês (R$) vs meta · mesmo dado do Painel de Perdas`}
        >
          {carregando ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : linhasIndisponibilidade.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Sem resultados importados — importe na página Importação, aba Painel de Perdas.
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
                {linhasIndisponibilidade.map(l => (
                  <TableRow key={l.unidade} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <TableCell className="py-1.5 text-sm font-medium">
                      {l.nome}
                      {metaIndisp === null && <span className="ml-1 text-[10px] text-muted-foreground">(sem meta)</span>}
                    </TableCell>
                    {l.meses.map((valor, i) => {
                      if (valor === null) {
                        return <TableCell key={i} className="py-1.5 text-center text-xs text-muted-foreground">—</TableCell>
                      }
                      const bateu = metaIndisp === null ? null : valor >= metaIndisp.meta_valor
                      return (
                        <TableCell
                          key={i}
                          title={metaIndisp !== null ? `Meta: R$ ${fmtValor(metaIndisp.meta_valor)}` : 'Sem meta cadastrada'}
                          className={cn(
                            'py-1.5 text-center text-xs font-medium tabular-nums',
                            bateu === null
                              ? 'text-foreground'
                              : bateu
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                          )}
                        >
                          {fmtValor(valor)}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      ) : indId === 'pacote_gente' ? (
        <TableCard
          titulo={INDICADOR_PACOTE_GENTE.nome}
          subtitulo={carregando
            ? 'Carregando...'
            : `${ano} · AVR das contas 158+033 (negócio ROTA) vs meta do Orçamento · quanto menor melhor · só conta pra lideranças da ROTA na apuração`}
        >
          {carregando ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando DRE...
            </div>
          ) : linhasPacoteGente.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Sem dados do DRE pra esse ano.</p>
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
                {linhasPacoteGente.map(l => (
                  <TableRow
                    key={l.unidade}
                    className={cn(
                      'border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30',
                      l.unidade === 'AMBEV' && 'bg-muted/40 font-semibold',
                    )}
                  >
                    <TableCell className="py-1.5 text-sm font-medium">{l.nome}</TableCell>
                    {l.meses.map((c, i) => {
                      if (c === null) {
                        return <TableCell key={i} className="py-1.5 text-center text-xs text-muted-foreground">—</TableCell>
                      }
                      const bateu = c.meta !== null ? c.avr <= c.meta : null
                      return (
                        <TableCell
                          key={i}
                          title={c.meta !== null ? `Meta: ${fmtPct(c.meta)}` : 'Sem meta cadastrada'}
                          className={cn(
                            'py-1.5 text-center text-xs font-medium tabular-nums',
                            bateu === null
                              ? 'text-foreground'
                              : bateu
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                          )}
                        >
                          {fmtPct(c.avr)}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      ) : indId === 'logon_du' ? (
        <TableCard
          titulo="LogOn DU"
          subtitulo={carregando ? 'Carregando...' : `${ano} · resultado do mês (%) vs meta · quanto maior melhor`}
        >
          {carregando ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : linhasLogonDu.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Sem resultados importados — importe na página Importação, aba Distribuição.
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
                {linhasLogonDu.map(l => (
                  <TableRow key={l.unidade} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <TableCell className="py-1.5 text-sm font-medium">
                      {l.nome}
                      {logonDuMeta === null && <span className="ml-1 text-[10px] text-muted-foreground">(sem meta)</span>}
                    </TableCell>
                    {l.meses.map((valor, i) => {
                      if (valor === null) {
                        return <TableCell key={i} className="py-1.5 text-center text-xs text-muted-foreground">—</TableCell>
                      }
                      const bateu = logonDuMeta === null ? null : valor >= logonDuMeta.meta_pct
                      return (
                        <TableCell
                          key={i}
                          title={logonDuMeta !== null ? `Meta: ${fmtPct(logonDuMeta.meta_pct)}%` : 'Sem meta cadastrada'}
                          className={cn(
                            'py-1.5 text-center text-xs font-medium tabular-nums',
                            bateu === null
                              ? 'text-foreground'
                              : bateu
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                          )}
                        >
                          {fmtPct(valor)}%
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      ) : indId === 'devolucao' ? (
        <TableCard
          titulo="Devolução"
          subtitulo={carregando ? 'Carregando...' : `${ano} · resultado do mês (%) vs meta · quanto menor melhor`}
        >
          {carregando ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : linhasDevolucao.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Sem resultados importados — importe na página Importação, aba Distribuição.
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
                {linhasDevolucao.map(l => {
                  const meta = devolucaoMetas.get(l.unidade) ?? null
                  return (
                    <TableRow key={l.unidade} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                      <TableCell className="py-1.5 text-sm font-medium">
                        {l.nome}
                        {meta === null && <span className="ml-1 text-[10px] text-muted-foreground">(sem meta)</span>}
                      </TableCell>
                      {l.meses.map((valor, i) => {
                        if (valor === null) {
                          return <TableCell key={i} className="py-1.5 text-center text-xs text-muted-foreground">—</TableCell>
                        }
                        const bateu = meta === null ? null : valor <= meta
                        return (
                          <TableCell
                            key={i}
                            title={meta !== null ? `Meta: ${fmtPct(meta)}%` : 'Sem meta cadastrada'}
                            className={cn(
                              'py-1.5 text-center text-xs font-medium tabular-nums',
                              bateu === null
                                ? 'text-foreground'
                                : bateu
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                                  : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                            )}
                          >
                            {fmtPct(valor)}%
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </TableCard>
      ) : (
        <TableCard
          titulo="Presenteísmo DU"
          subtitulo={carregando ? 'Carregando...' : `${ano} · resultado do mês (%) vs meta importada todo mês · quanto menor melhor`}
        >
          {carregando ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : linhasPresenteismoDu.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Sem resultados ou meta importados ainda pra esse ano.
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
                {linhasPresenteismoDu.map(l => (
                  <TableRow key={l.unidade} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <TableCell className="py-1.5 text-sm font-medium">{l.nome}</TableCell>
                    {l.meses.map((valor, i) => {
                      const mes = i + 1
                      const meta = presenteismoDuMetas.find(m => m.unidade === l.unidade && m.ano === Number(ano) && m.mes === mes)?.valor ?? null
                      if (valor === null) {
                        return <TableCell key={i} className="py-1.5 text-center text-xs text-muted-foreground">—</TableCell>
                      }
                      const bateu = meta === null ? null : valor <= meta
                      return (
                        <TableCell
                          key={i}
                          title={meta !== null ? `Meta: ${fmtPct(meta)}%` : 'Sem meta cadastrada'}
                          className={cn(
                            'py-1.5 text-center text-xs font-medium tabular-nums',
                            bateu === null
                              ? 'text-foreground'
                              : bateu
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                          )}
                        >
                          {fmtPct(valor)}%
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
