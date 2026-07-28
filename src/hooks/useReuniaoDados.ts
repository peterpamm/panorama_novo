import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { usePainelPerdasAux } from '@/hooks/usePainelPerdasAux'
import { useToast } from '@/components/ui/use-toast'
import { calcularPontosGanhos, parseValorInput, resolverNaturezaFormato, valorParaInputEditavel } from '@/lib/reuniao-resultados'
import { INDICADORES_PERDAS } from '@/lib/painel-perdas-calculations'
import { PACOTES } from '@/lib/constants'
import { avrPorPrefixo, normalizarParaCalculo } from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { fetchOrcamentoPaginado } from '@/lib/orcamento-fetch'
import { calcularAderenciaPorUnidade } from '@/lib/rotinas-financeiras'
import type {
  DreLongoRow, MetaPerdaIndicador, OrcamentoLinha,
  PainelPerdasAux as PainelPerdasAuxRow, ReuniaoIndicador, ReuniaoResultadoMensal, ReuniaoSetor,
  RotinaFinanceira, RotinaFinanceiraStatus,
} from '@/types'

/** Resultado mensal de um indicador de fonte 'perdas' — mesma lógica de `valorIndicadorUnidadeMes` em `PainelPerdasPage.tsx`. */
export function valorPerdasUnidadeMes(rowsDre: DreLongoRow[], rowsAux: PainelPerdasAuxRow[], indKey: string, unidade: string, ano: number, mes: number): number | null {
  const ind = INDICADORES_PERDAS.find(i => i.key === indKey)
  if (!ind) return null
  if (ind.fonte === 'AUX') {
    const auxKey = ind.key as PainelPerdasAuxRow['indicador']
    if (unidade === 'AMBEV') {
      const temDados = rowsAux.some(r => r.ano === ano && r.mes === mes && r.indicador === auxKey)
      if (!temDados) return null
      return rowsAux.filter(r => r.ano === ano && r.mes === mes && r.indicador === auxKey).reduce((acc, r) => acc + r.valor, 0)
    }
    const rows = rowsAux.filter(r => r.unidade === unidade && r.ano === ano && r.mes === mes && r.indicador === auxKey)
    return rows.length > 0 ? rows.reduce((acc, r) => acc + r.valor, 0) : null
  }
  const rowsU = rowsDre.filter(r => r.unidade === unidade && r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === ano && r.mes === mes)
  if (rowsU.length === 0) return null
  return rowsU.filter(r => ind.contas.some(c => r.conta_codigo.startsWith(c))).reduce((acc, r) => acc + (r.diferenca ?? 0), 0)
}

/** Meta mensal de um indicador de fonte 'perdas' — meta_anual/12 de metas_perdas_indicadores, igual `metaPerdasMensal` em `PainelPerdasPage.tsx`. */
export function metaPerdasUnidadeMes(metasPerdasIndicadores: MetaPerdaIndicador[], indKey: string, unidade: string, ano: number): number | null {
  const rows = unidade === 'AMBEV'
    ? metasPerdasIndicadores.filter(m => m.unidade !== 'AMBEV' && m.ano === ano && m.indicador === indKey)
    : metasPerdasIndicadores.filter(m => m.unidade === unidade && m.ano === ano && m.indicador === indKey)
  if (rows.length === 0) return null
  const metaAnual = rows.reduce((acc, m) => acc + m.meta_anual, 0)
  return metaAnual / 12
}

/** AVR mensal de um pacote do Farol (fonte 'farol_pacote') — também usado direto pro EBITDA (código '232') fora do contexto de um indicador cadastrado. */
export function valorFarolPacoteUnidadeMes(rowsDre: DreLongoRow[], codigo: string, unidade: string, ano: number, mes: number): number | null {
  const info = PACOTES[codigo]
  if (!info) return null
  const rowsU = rowsDre.filter(r => r.unidade === unidade && r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === ano && r.mes === mes)
  if (rowsU.length === 0) return null
  return avrPorPrefixo(normalizarParaCalculo(rowsU), info.prefixos)
}

/** % de aderência mensal das Rotinas Financeiras (fonte 'rotinas') — mesma conta de `DashboardRotinasTab.tsx`. */
export function valorRotinasUnidadeMes(rotinasIds: Set<string>, statusAno: RotinaFinanceiraStatus[], unidade: string, mes: number): number | null {
  return calcularAderenciaPorUnidade(rotinasIds, statusAno, unidade).porMes[mes - 1] ?? null
}

/**
 * Dados + cálculos compartilhados por todas as abas da Reunião Resultados que
 * mostram pontuação por unidade/mês (Apuração, Resultado do Mês): indicadores
 * ativos do setor/ano, participantes, resultados manuais e o resultado/meta
 * efetivos (automáticos calculados em cima do DRE/Orçamento/Metas de
 * Perdas/Rotinas, ou manuais vindos do banco).
 */
export function useReuniaoDados(setor: ReuniaoSetor, ano: string) {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const { rows: rowsDre } = useDreLongoTodasUnidades()
  const { rows: rowsAux } = usePainelPerdasAux()
  const nomesUnidades = useMemo(() => {
    const m: Record<string, string> = {}
    for (const u of unidades) m[u.codigo] = u.nome
    return m
  }, [unidades])

  const [carregando, setCarregando] = useState(true)
  const [indicadores, setIndicadores] = useState<ReuniaoIndicador[]>([])
  const [participantesPorIndicador, setParticipantesPorIndicador] = useState<Record<string, string[]>>({})
  const [resultados, setResultados] = useState<Record<string, number | null>>({})
  const [valoresInput, setValoresInput] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  // Dados extra pra indicadores de fonte automática — só buscados se existir
  // pelo menos 1 indicador dessa fonte no setor/ano (metas_perdas_indicadores
  // não tem filtro de unidade, igual PainelPerdasPage.tsx; orçamento usa a
  // mesma paginação de FarolDeMetasPage.tsx; rotinas mirra DashboardRotinasTab.tsx).
  const [metasPerdasIndicadores, setMetasPerdasIndicadores] = useState<MetaPerdaIndicador[]>([])
  const [orcamentoRows, setOrcamentoRows] = useState<OrcamentoLinha[]>([])
  const [rotinasIds, setRotinasIds] = useState<Set<string>>(new Set())
  const [statusAnoRotinas, setStatusAnoRotinas] = useState<RotinaFinanceiraStatus[]>([])
  const [metaRotinas, setMetaRotinas] = useState<number | null>(null)

  async function carregar() {
    setCarregando(true)
    const { data: inds, error } = await supabase
      .from('reuniao_resultados_indicadores')
      .select('*')
      .eq('setor', setor)
      .eq('ano', Number(ano))
      .eq('ativo', true)
      .order('ordem')
    if (error) {
      toast({ title: 'Erro ao carregar indicadores', description: error.message, variant: 'destructive' })
      setCarregando(false)
      return
    }
    const indicadoresAtivos = (inds as ReuniaoIndicador[]) ?? []
    setIndicadores(indicadoresAtivos)

    const precisaPerdas = indicadoresAtivos.some(i => i.fonte === 'perdas')
    const precisaOrcamento = indicadoresAtivos.some(i => i.fonte === 'farol_pacote')
    const precisaRotinas = indicadoresAtivos.some(i => i.fonte === 'rotinas')
    const [resPerdas, resOrcamento, resRotinas, resStatusRotinas, resMetaRotinas] = await Promise.all([
      precisaPerdas
        ? supabase.from('metas_perdas_indicadores').select('*').eq('ano', Number(ano))
        : Promise.resolve({ data: [] as MetaPerdaIndicador[] }),
      precisaOrcamento
        ? fetchOrcamentoPaginado((from, to) =>
            supabase.from('orcamentos').select('*').eq('negocio', 'CONS').eq('ano', Number(ano)).range(from, to),
          )
        : Promise.resolve([] as OrcamentoLinha[]),
      precisaRotinas
        ? supabase.from('rotinas_financeiras').select('*').eq('ativo', true)
        : Promise.resolve({ data: [] as RotinaFinanceira[] }),
      precisaRotinas
        ? supabase.from('rotinas_financeiras_status').select('*').eq('ano', Number(ano))
        : Promise.resolve({ data: [] as RotinaFinanceiraStatus[] }),
      precisaRotinas
        ? supabase.from('meta_rotinas_financeiras').select('*').maybeSingle()
        : Promise.resolve({ data: null as { meta_pct: number } | null }),
    ])
    setMetasPerdasIndicadores((resPerdas.data as MetaPerdaIndicador[]) ?? [])
    setOrcamentoRows(Array.isArray(resOrcamento) ? resOrcamento : [])
    setRotinasIds(new Set(((resRotinas.data as RotinaFinanceira[]) ?? []).map(r => r.id!)))
    setStatusAnoRotinas((resStatusRotinas.data as RotinaFinanceiraStatus[]) ?? [])
    setMetaRotinas(resMetaRotinas.data ? Number(resMetaRotinas.data.meta_pct) : null)

    const ids = indicadoresAtivos.map(i => i.id)
    if (ids.length === 0) {
      setParticipantesPorIndicador({})
      setResultados({})
      setValoresInput({})
      setCarregando(false)
      return
    }

    const [{ data: parts }, { data: mensais }] = await Promise.all([
      supabase.from('reuniao_resultados_participantes').select('*').in('indicador_id', ids),
      supabase.from('reuniao_resultados_mensais').select('*').in('indicador_id', ids),
    ])

    const partesMap: Record<string, string[]> = {}
    for (const p of parts ?? []) {
      const lista = partesMap[p.indicador_id] ?? []
      lista.push(p.unidade)
      partesMap[p.indicador_id] = lista
    }
    for (const chave of Object.keys(partesMap)) {
      partesMap[chave].sort((a, b) => (nomesUnidades[a] ?? a).localeCompare(nomesUnidades[b] ?? b))
    }
    setParticipantesPorIndicador(partesMap)

    const resMap: Record<string, number | null> = {}
    const inputMap: Record<string, string> = {}
    for (const r of (mensais as ReuniaoResultadoMensal[]) ?? []) {
      const chave = `${r.indicador_id}|${r.unidade}|${r.mes}`
      resMap[chave] = r.resultado
      const ind = indicadoresAtivos.find(i => i.id === r.indicador_id)
      if (ind) inputMap[chave] = valorParaInputEditavel(r.resultado, ind.formato)
    }
    setResultados(resMap)
    setValoresInput(inputMap)
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [setor, ano]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Resultado + meta dos indicadores de fonte automática, pré-calculados pra
   * toda unidade/mês de uma vez só — as funções acima filtram `rowsDre`/`rowsAux`
   * (dezenas de milhares de linhas), então rodá-las célula a célula DENTRO do
   * render deixava a tela extremamente lenta a cada tecla digitada num
   * indicador manual (qualquer `setValoresInput` re-renderiza tudo). Memoizado
   * com dependências que não incluem `valoresInput`/`resultados`, então digitar
   * não recalcula nada aqui — só o lookup abaixo, que é O(1).
   */
  const automaticosPorIndicador = useMemo(() => {
    const mapa: Record<string, { resultado: number | null; meta: number | null }> = {}
    for (const ind of indicadores) {
      if (ind.fonte === 'manual') continue
      const participantes = participantesPorIndicador[ind.id] ?? []
      for (const unidadeCodigo of participantes) {
        for (let mes = 1; mes <= 12; mes++) {
          const chave = `${ind.id}|${unidadeCodigo}|${mes}`
          if (ind.fonte === 'perdas' && ind.fonte_chave) {
            mapa[chave] = {
              resultado: valorPerdasUnidadeMes(rowsDre, rowsAux, ind.fonte_chave, unidadeCodigo, Number(ano), mes),
              meta: metaPerdasUnidadeMes(metasPerdasIndicadores, ind.fonte_chave, unidadeCodigo, Number(ano)),
            }
          } else if (ind.fonte === 'farol_pacote' && ind.fonte_chave) {
            mapa[chave] = {
              resultado: valorFarolPacoteUnidadeMes(rowsDre, ind.fonte_chave, unidadeCodigo, Number(ano), mes),
              meta: buscarMetaOrcamento(orcamentoRows, { unidade: unidadeCodigo, negocio: 'CONS', ano: Number(ano), codigo: ind.fonte_chave, mes }),
            }
          } else if (ind.fonte === 'rotinas') {
            mapa[chave] = {
              resultado: valorRotinasUnidadeMes(rotinasIds, statusAnoRotinas, unidadeCodigo, mes),
              meta: metaRotinas,
            }
          }
        }
      }
    }
    return mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicadores, participantesPorIndicador, rowsDre, rowsAux, metasPerdasIndicadores, orcamentoRows, rotinasIds, statusAnoRotinas, metaRotinas, ano])

  /** Resultado + meta efetivos de um indicador/unidade/mês — manual vem do estado editável, automático vem do memo acima. */
  function resultadoEMeta(ind: ReuniaoIndicador, unidadeCodigo: string, mes: number): { resultado: number | null; meta: number | null } {
    if (ind.fonte !== 'manual') {
      return automaticosPorIndicador[`${ind.id}|${unidadeCodigo}|${mes}`] ?? { resultado: null, meta: null }
    }
    return { resultado: resultados[`${ind.id}|${unidadeCodigo}|${mes}`] ?? null, meta: ind.meta }
  }

  async function handleSalvar(indicador: ReuniaoIndicador, unidadeCodigo: string, mes: number) {
    const chave = `${indicador.id}|${unidadeCodigo}|${mes}`
    const resultado = parseValorInput(valoresInput[chave] ?? '', indicador.formato)
    setSalvando(chave)
    const { error } = await supabase
      .from('reuniao_resultados_mensais')
      .upsert({ indicador_id: indicador.id, unidade: unidadeCodigo, mes, resultado }, { onConflict: 'indicador_id,unidade,mes' })
    setSalvando(null)
    if (error) {
      toast({ title: 'Erro ao salvar resultado', description: error.message, variant: 'destructive' })
      return
    }
    setResultados(prev => ({ ...prev, [chave]: resultado }))
  }

  const unidadesDoTotal = useMemo(() => {
    const codigos = new Set<string>()
    for (const lista of Object.values(participantesPorIndicador)) {
      for (const codigo of lista) codigos.add(codigo)
    }
    return Array.from(codigos).sort((a, b) => (nomesUnidades[a] ?? a).localeCompare(nomesUnidades[b] ?? b))
  }, [participantesPorIndicador, nomesUnidades])

  const totalPorUnidadeMes = useMemo(() => {
    const totais: Record<string, number | null> = {}
    for (const unidadeCodigo of unidadesDoTotal) {
      for (let mes = 1; mes <= 12; mes++) {
        let soma = 0
        let algumLancado = false
        for (const ind of indicadores) {
          const participa = (participantesPorIndicador[ind.id] ?? []).includes(unidadeCodigo)
          if (!participa) continue
          const { resultado, meta } = resultadoEMeta(ind, unidadeCodigo, mes)
          const { natureza } = resolverNaturezaFormato(ind)
          const pontos = calcularPontosGanhos(resultado, meta, natureza, ind.pontos)
          if (pontos !== null) { algumLancado = true; soma += pontos }
        }
        totais[`${unidadeCodigo}|${mes}`] = algumLancado ? soma : null
      }
    }
    return totais
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadesDoTotal, indicadores, participantesPorIndicador, resultados, rowsDre, rowsAux, metasPerdasIndicadores, orcamentoRows, rotinasIds, statusAnoRotinas, metaRotinas, ano])

  const maiorPorMes = useMemo(() => {
    const maiores: Record<number, number> = {}
    for (let mes = 1; mes <= 12; mes++) {
      const valores = unidadesDoTotal
        .map(u => totalPorUnidadeMes[`${u}|${mes}`])
        .filter((v): v is number => v !== null)
      maiores[mes] = valores.length > 0 ? Math.max(...valores) : -1
    }
    return maiores
  }, [unidadesDoTotal, totalPorUnidadeMes])

  return {
    carregando, indicadores, participantesPorIndicador,
    resultados, valoresInput, setValoresInput, salvando, handleSalvar,
    resultadoEMeta, unidadesDoTotal, totalPorUnidadeMes, maiorPorMes,
    nomesUnidades, rowsDre,
  }
}
