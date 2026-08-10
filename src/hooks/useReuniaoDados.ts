import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import { usePainelPerdasAux } from '@/hooks/usePainelPerdasAux'
import { useToast } from '@/components/ui/use-toast'
import { calcularPontosGanhos, parseValorInput, resolverNaturezaFormato, unidadesParticipaveis, valorParaInputEditavel } from '@/lib/reuniao-resultados'
import { INDICADORES_PERDAS } from '@/lib/painel-perdas-calculations'
import { PACOTES } from '@/lib/constants'
import { avrPorPrefixo, calcularSemaforo, normalizarParaCalculo } from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { calcularAderenciaPorUnidade } from '@/lib/rotinas-financeiras'
import type {
  DreLongoRow, MetaPerdaIndicador, OrcamentoLinha,
  PainelPerdasAux as PainelPerdasAuxRow, ReuniaoIndicador, ReuniaoResultadoMensal, ReuniaoSetor,
  RotinaFinanceira, RotinaFinanceiraStatus,
} from '@/types'

/** Chave composta unidade+negócio — mesma convenção em toda a Reunião Resultados (negocio 'CONS' pra unidade sem split). */
function chaveUN(unidade: string, negocio: string): string {
  return `${unidade}|${negocio}`
}

/** Resultado mensal de um indicador de fonte 'perdas' — mesma lógica de `valorIndicadorUnidadeMes` em `PainelPerdasPage.tsx`. Não tem dado por negócio — sempre o consolidado da unidade. */
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

/** Meta mensal de um indicador de fonte 'perdas' — meta_anual/12 de metas_perdas_indicadores, igual `metaPerdasMensal` em `PainelPerdasPage.tsx`. Não tem dado por negócio — sempre o consolidado da unidade. */
export function metaPerdasUnidadeMes(metasPerdasIndicadores: MetaPerdaIndicador[], indKey: string, unidade: string, ano: number): number | null {
  const rows = unidade === 'AMBEV'
    ? metasPerdasIndicadores.filter(m => m.unidade !== 'AMBEV' && m.ano === ano && m.indicador === indKey)
    : metasPerdasIndicadores.filter(m => m.unidade === unidade && m.ano === ano && m.indicador === indKey)
  if (rows.length === 0) return null
  const metaAnual = rows.reduce((acc, m) => acc + m.meta_anual, 0)
  return metaAnual / 12
}

/**
 * AVR mensal de um pacote do Farol (fonte 'farol_pacote') — também usado
 * direto pro EBITDA (código '232') fora do contexto de um indicador
 * cadastrado. Único fonte automático que varia por negócio (Camaçari fora do
 * Financeiro tem DRE separado por ROTA/ARM) — `negocio` default 'CONS'
 * (unidade sem split).
 */
export function valorFarolPacoteUnidadeMes(rowsDre: DreLongoRow[], codigo: string, unidade: string, ano: number, mes: number, negocio: string = 'CONS'): number | null {
  const info = PACOTES[codigo]
  if (!info) return null
  const rowsU = rowsDre.filter(r => r.unidade === unidade && r.negocio === negocio && r.tipo_periodo === 'MENSAL' && r.ano === ano && r.mes === mes)
  if (rowsU.length === 0) return null
  return avrPorPrefixo(normalizarParaCalculo(rowsU), info.prefixos)
}

/**
 * Delta (AVR - meta do Orçamento, sinal já certo pela natureza) de um pacote
 * do Farol num mês — mesma régua do Ranking (`calcularRankingIndicador` em
 * ranking-calculations.ts), usado como critério de desempate no lugar do
 * AVR puro (ex: EBITDA, código '232': duas unidades com a mesma pontuação
 * no mês, a com melhor delta de EBITDA vs a própria meta fica na frente —
 * não é mais só "quem teve o % de EBITDA mais alto", que ignorava se a meta
 * de cada unidade era diferente). null quando não tem meta cadastrada
 * (mesmo critério de "sem meta = não desempata" do resto do app).
 */
export function deltaFarolPacoteUnidadeMes(
  rowsDre: DreLongoRow[], orcamentoRows: OrcamentoLinha[], codigo: string,
  unidade: string, ano: number, mes: number, negocio: string = 'CONS',
): number | null {
  const info = PACOTES[codigo]
  if (!info) return null
  const avr = valorFarolPacoteUnidadeMes(rowsDre, codigo, unidade, ano, mes, negocio)
  if (avr === null) return null
  const meta = buscarMetaOrcamento(orcamentoRows, { unidade, negocio, ano, codigo, mes })
  return calcularSemaforo(avr, meta, info.natureza).delta
}

/** % de aderência mensal das Rotinas Financeiras (fonte 'rotinas') — mesma conta de `DashboardRotinasTab.tsx`. Não tem dado por negócio — sempre o consolidado da unidade. */
export function valorRotinasUnidadeMes(rotinasIds: Set<string>, statusAno: RotinaFinanceiraStatus[], unidade: string, mes: number): number | null {
  return calcularAderenciaPorUnidade(rotinasIds, statusAno, unidade).porMes[mes - 1] ?? null
}

/**
 * Dados + cálculos compartilhados por todas as abas da Reunião Resultados que
 * mostram pontuação por unidade/mês (Apuração, Resultado do Mês): indicadores
 * ativos do setor/ano, participantes (unidade+negócio — ver
 * `unidadesParticipaveis`, `reuniao-resultados.ts`), resultados manuais e o
 * resultado/meta efetivos (automáticos calculados em cima do DRE/Orçamento/
 * Metas de Perdas/Rotinas, ou manuais vindos do banco).
 */
export function useReuniaoDados(setor: ReuniaoSetor, ano: string) {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const { rows: rowsDre } = useDreLongoTodasUnidades()
  const { orcamentos: orcamentoRows, loading: loadingOrcamento } = useOrcamentoTodasUnidades()
  const { rows: rowsAux } = usePainelPerdasAux()
  const nomesUnidades = useMemo(() => {
    const m: Record<string, string> = {}
    for (const u of unidades) m[u.codigo] = u.nome
    return m
  }, [unidades])
  const nomesParticipaveis = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of unidadesParticipaveis(unidades, setor)) m[chaveUN(p.unidade, p.negocio)] = p.nome
    return m
  }, [unidades, setor])

  const [carregando, setCarregando] = useState(true)
  const [indicadores, setIndicadores] = useState<ReuniaoIndicador[]>([])
  const [participantesPorIndicador, setParticipantesPorIndicador] = useState<Record<string, { unidade: string; negocio: string }[]>>({})
  const [resultados, setResultados] = useState<Record<string, number | null>>({})
  const [metasImportadas, setMetasImportadas] = useState<Record<string, number | null>>({})
  const [pontosImportados, setPontosImportados] = useState<Record<string, number | null>>({})
  const [valoresInput, setValoresInput] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  // Dados extra pra indicadores de fonte automática — só buscados se existir
  // pelo menos 1 indicador dessa fonte no setor/ano (metas_perdas_indicadores
  // não tem filtro de unidade, igual PainelPerdasPage.tsx; orçamento vem do
  // cache global (useOrcamentoTodasUnidades) — não busca por conta própria,
  // senão módulos que montam esse hook várias vezes ao mesmo tempo (ex:
  // Resumo Geral, 6 setores juntos) disparariam buscas redundantes e
  // concorrentes, o mesmo bug de timeout já corrigido no Painel Geral da RV;
  // rotinas mirra DashboardRotinasTab.tsx.
  const [metasPerdasIndicadores, setMetasPerdasIndicadores] = useState<MetaPerdaIndicador[]>([])
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
    const precisaRotinas = indicadoresAtivos.some(i => i.fonte === 'rotinas')
    const [resPerdas, resRotinas, resStatusRotinas, resMetaRotinas] = await Promise.all([
      precisaPerdas
        ? supabase.from('metas_perdas_indicadores').select('*').eq('ano', Number(ano))
        : Promise.resolve({ data: [] as MetaPerdaIndicador[] }),
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
    setRotinasIds(new Set(((resRotinas.data as RotinaFinanceira[]) ?? []).map(r => r.id!)))
    setStatusAnoRotinas((resStatusRotinas.data as RotinaFinanceiraStatus[]) ?? [])
    setMetaRotinas(resMetaRotinas.data ? Number(resMetaRotinas.data.meta_pct) : null)

    const ids = indicadoresAtivos.map(i => i.id)
    if (ids.length === 0) {
      setParticipantesPorIndicador({})
      setResultados({})
      setMetasImportadas({})
      setPontosImportados({})
      setValoresInput({})
      setCarregando(false)
      return
    }

    const [{ data: parts }, { data: mensais }] = await Promise.all([
      supabase.from('reuniao_resultados_participantes').select('*').in('indicador_id', ids),
      supabase.from('reuniao_resultados_mensais').select('*').in('indicador_id', ids),
    ])

    const partesMap: Record<string, { unidade: string; negocio: string }[]> = {}
    for (const p of parts ?? []) {
      const lista = partesMap[p.indicador_id] ?? []
      lista.push({ unidade: p.unidade, negocio: p.negocio })
      partesMap[p.indicador_id] = lista
    }
    for (const chave of Object.keys(partesMap)) {
      partesMap[chave].sort((a, b) =>
        (nomesParticipaveis[chaveUN(a.unidade, a.negocio)] ?? a.unidade).localeCompare(nomesParticipaveis[chaveUN(b.unidade, b.negocio)] ?? b.unidade),
      )
    }
    setParticipantesPorIndicador(partesMap)

    const resMap: Record<string, number | null> = {}
    const metaImportMap: Record<string, number | null> = {}
    const pontosImportMap: Record<string, number | null> = {}
    const inputMap: Record<string, string> = {}
    for (const r of (mensais as ReuniaoResultadoMensal[]) ?? []) {
      const chave = `${r.indicador_id}|${r.unidade}|${r.negocio}|${r.mes}`
      resMap[chave] = r.resultado
      metaImportMap[chave] = r.meta
      pontosImportMap[chave] = r.pontos
      const ind = indicadoresAtivos.find(i => i.id === r.indicador_id)
      if (ind) inputMap[chave] = valorParaInputEditavel(r.resultado, ind.formato)
    }
    setResultados(resMap)
    setMetasImportadas(metaImportMap)
    setPontosImportados(pontosImportMap)
    setValoresInput(inputMap)
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [setor, ano]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Resultado + meta dos indicadores de fonte automática, pré-calculados pra
   * toda unidade/negócio/mês de uma vez só — as funções acima filtram
   * `rowsDre`/`rowsAux` (dezenas de milhares de linhas), então rodá-las
   * célula a célula DENTRO do render deixava a tela extremamente lenta a cada
   * tecla digitada num indicador manual (qualquer `setValoresInput`
   * re-renderiza tudo). Memoizado com dependências que não incluem
   * `valoresInput`/`resultados`, então digitar não recalcula nada aqui — só
   * o lookup abaixo, que é O(1).
   */
  const automaticosPorIndicador = useMemo(() => {
    const mapa: Record<string, { resultado: number | null; meta: number | null }> = {}
    for (const ind of indicadores) {
      if (ind.fonte === 'manual') continue
      const participantes = participantesPorIndicador[ind.id] ?? []
      for (const p of participantes) {
        for (let mes = 1; mes <= 12; mes++) {
          const chave = `${ind.id}|${p.unidade}|${p.negocio}|${mes}`
          if (ind.fonte === 'perdas' && ind.fonte_chave) {
            mapa[chave] = {
              resultado: valorPerdasUnidadeMes(rowsDre, rowsAux, ind.fonte_chave, p.unidade, Number(ano), mes),
              meta: ind.meta_fixa ?? metaPerdasUnidadeMes(metasPerdasIndicadores, ind.fonte_chave, p.unidade, Number(ano)),
            }
          } else if (ind.fonte === 'farol_pacote' && ind.fonte_chave) {
            mapa[chave] = {
              resultado: valorFarolPacoteUnidadeMes(rowsDre, ind.fonte_chave, p.unidade, Number(ano), mes, p.negocio),
              meta: buscarMetaOrcamento(orcamentoRows, { unidade: p.unidade, negocio: p.negocio, ano: Number(ano), codigo: ind.fonte_chave, mes }),
            }
          } else if (ind.fonte === 'rotinas') {
            mapa[chave] = {
              resultado: valorRotinasUnidadeMes(rotinasIds, statusAnoRotinas, p.unidade, mes),
              meta: metaRotinas,
            }
          }
        }
      }
    }
    return mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicadores, participantesPorIndicador, rowsDre, rowsAux, metasPerdasIndicadores, orcamentoRows, rotinasIds, statusAnoRotinas, metaRotinas, ano])

  /**
   * Resultado + meta efetivos de um indicador/unidade+negócio/mês. Manual,
   * termômetro e importado leem direto de `reuniao_resultados_mensais` (o
   * termômetro/importado só chegam lá pela aba Importação, não por
   * digitação célula a célula, mas é a mesma tabela) — termômetro nunca tem
   * meta (pontuação é o próprio resultado); importado usa a meta que veio
   * pronta da planilha (`metasImportadas`, só pra exibição — a pontuação
   * também já vem pronta, ver `pontosGanhos`). Os demais fontes automáticos
   * vêm do memo calculado a partir de DRE/Orçamento/Rotinas.
   */
  function resultadoEMeta(ind: ReuniaoIndicador, unidade: string, negocio: string, mes: number): { resultado: number | null; meta: number | null } {
    const chave = `${ind.id}|${unidade}|${negocio}|${mes}`
    if (ind.fonte === 'importado') {
      return { resultado: resultados[chave] ?? null, meta: metasImportadas[chave] ?? null }
    }
    if (ind.fonte === 'manual' || ind.fonte === 'termometro') {
      return {
        resultado: resultados[chave] ?? null,
        meta: ind.fonte === 'termometro' ? null : ind.meta,
      }
    }
    return automaticosPorIndicador[chave] ?? { resultado: null, meta: null }
  }

  /** Pontos ganhos, já resolvendo a fonte 'importado' (pontos prontos da planilha) — centraliza o que antes era repetido em cada tela. */
  function pontosGanhos(ind: ReuniaoIndicador, unidade: string, negocio: string, mes: number): number | null {
    const { resultado, meta } = resultadoEMeta(ind, unidade, negocio, mes)
    const { natureza } = resolverNaturezaFormato(ind)
    const importado = pontosImportados[`${ind.id}|${unidade}|${negocio}|${mes}`] ?? null
    return calcularPontosGanhos(resultado, meta, natureza, ind.pontos, ind.fonte, importado)
  }

  async function handleSalvar(indicador: ReuniaoIndicador, unidade: string, negocio: string, mes: number) {
    const chave = `${indicador.id}|${unidade}|${negocio}|${mes}`
    const resultado = parseValorInput(valoresInput[chave] ?? '', indicador.formato)
    setSalvando(chave)
    const { error } = await supabase
      .from('reuniao_resultados_mensais')
      .upsert({ indicador_id: indicador.id, unidade, negocio, mes, resultado }, { onConflict: 'indicador_id,unidade,negocio,mes' })
    setSalvando(null)
    if (error) {
      toast({ title: 'Erro ao salvar resultado', description: error.message, variant: 'destructive' })
      return
    }
    setResultados(prev => ({ ...prev, [chave]: resultado }))
  }

  const unidadesDoTotal = useMemo(() => {
    const vistos = new Map<string, { unidade: string; negocio: string }>()
    for (const lista of Object.values(participantesPorIndicador)) {
      for (const p of lista) vistos.set(chaveUN(p.unidade, p.negocio), p)
    }
    return Array.from(vistos.values()).sort((a, b) =>
      (nomesParticipaveis[chaveUN(a.unidade, a.negocio)] ?? a.unidade).localeCompare(nomesParticipaveis[chaveUN(b.unidade, b.negocio)] ?? b.unidade),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantesPorIndicador, nomesParticipaveis])

  const totalPorUnidadeMes = useMemo(() => {
    const totais: Record<string, number | null> = {}
    for (const { unidade, negocio } of unidadesDoTotal) {
      for (let mes = 1; mes <= 12; mes++) {
        let soma = 0
        let algumLancado = false
        for (const ind of indicadores) {
          const participa = (participantesPorIndicador[ind.id] ?? []).some(p => p.unidade === unidade && p.negocio === negocio)
          if (!participa) continue
          const pontos = pontosGanhos(ind, unidade, negocio, mes)
          if (pontos !== null) { algumLancado = true; soma += pontos }
        }
        totais[chaveUN(unidade, negocio) + `|${mes}`] = algumLancado ? soma : null
      }
    }
    return totais
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadesDoTotal, indicadores, participantesPorIndicador, resultados, metasImportadas, pontosImportados, rowsDre, rowsAux, metasPerdasIndicadores, orcamentoRows, rotinasIds, statusAnoRotinas, metaRotinas, ano])

  const maiorPorMes = useMemo(() => {
    const maiores: Record<number, number> = {}
    for (let mes = 1; mes <= 12; mes++) {
      const valores = unidadesDoTotal
        .map(({ unidade, negocio }) => totalPorUnidadeMes[chaveUN(unidade, negocio) + `|${mes}`])
        .filter((v): v is number => v !== null)
      maiores[mes] = valores.length > 0 ? Math.max(...valores) : -1
    }
    return maiores
  }, [unidadesDoTotal, totalPorUnidadeMes])

  return {
    carregando: carregando || loadingOrcamento, indicadores, participantesPorIndicador,
    resultados, metasImportadas, pontosImportados, valoresInput, setValoresInput, salvando, handleSalvar,
    resultadoEMeta, pontosGanhos, unidadesDoTotal, totalPorUnidadeMes, maiorPorMes,
    nomesUnidades, nomesParticipaveis, rowsDre, orcamentos: orcamentoRows,
  }
}
