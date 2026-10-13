import type { LimpaPauta, StatusAprovacaoLimpaPauta } from '@/types'

export const STATUS_APROVACAO_LABEL: Record<StatusAprovacaoLimpaPauta, string> = {
  em_analise: 'Em Análise',
  ok: 'OK',
  nok: 'NOK',
}

export const STATUS_APROVACAO_PILL: Record<StatusAprovacaoLimpaPauta, string> = {
  em_analise: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  nok: 'bg-red-500/15 text-red-700 dark:text-red-400',
}

export const STATUS_APROVACAO_OPCOES: StatusAprovacaoLimpaPauta[] = ['em_analise', 'ok', 'nok']

/** As 3 aprovações internas, em ordem de alçada (GOD é a mais baixa, RPO a mais alta) — cada uma com seu campo de status e justificativa em `LimpaPauta`. */
export const CAMPOS_APROVACAO = [
  { chave: 'god', titulo: 'GOD', campoStatus: 'status_god', campoJustificativa: 'justificativa_god' },
  { chave: 'geo', titulo: 'GEO', campoStatus: 'status_geo', campoJustificativa: 'justificativa_geo' },
  { chave: 'rpo', titulo: 'RPO', campoStatus: 'status_rpo', campoJustificativa: 'justificativa_rpo' },
] as const

/**
 * "Status atual" do registro, pela hierarquia de alçada: quem decidiu por
 * último na ordem GOD → GEO → RPO vale mais — ou seja, a decisão da alçada
 * mais alta que já saiu de "Em Análise" vence (RPO sobrepõe GEO, que
 * sobrepõe GOD). Sem nenhuma decisão ainda, fica "Em Análise". Não tem
 * relação com `status_freightech` (que é só o status cru do Freightech,
 * mostrado à parte no detalhe).
 */
export function statusAtualLimpaPauta(r: Pick<LimpaPauta, 'status_god' | 'status_geo' | 'status_rpo'>): StatusAprovacaoLimpaPauta {
  if (r.status_rpo !== 'em_analise') return r.status_rpo
  if (r.status_geo !== 'em_analise') return r.status_geo
  return r.status_god
}

type ReferenciaLimpaPauta = Pick<
  LimpaPauta,
  'status_god' | 'status_geo' | 'status_rpo' | 'justificativa_god' | 'justificativa_geo' | 'justificativa_rpo'
>

/** Qual alçada decidiu o `statusAtualLimpaPauta` de hoje, e a justificativa que ela escreveu — pro preview ao passar o mouse na lista (`AcompanhamentoLimpaPautaTab`). Null quando ninguém decidiu ainda ("Em Análise"). */
export function alcadaAtualLimpaPauta(r: ReferenciaLimpaPauta): { titulo: string; justificativa: string } | null {
  if (r.status_rpo !== 'em_analise') return { titulo: 'RPO', justificativa: r.justificativa_rpo }
  if (r.status_geo !== 'em_analise') return { titulo: 'GEO', justificativa: r.justificativa_geo }
  if (r.status_god !== 'em_analise') return { titulo: 'GOD', justificativa: r.justificativa_god }
  return null
}

export interface LinhaDashboardUnidadeSegmento {
  unidade: string
  segmento: string
  valorTotal: number
}

/** Soma `valor_solicitado` por combinação Unidade+Segmento — pra tabela "Unidade/Segmento/Valor total" do Dashboard, maior valor primeiro. */
export function agruparLimpaPautaPorUnidadeSegmento(
  registros: Pick<LimpaPauta, 'unidade' | 'segmento' | 'valor_solicitado'>[],
): LinhaDashboardUnidadeSegmento[] {
  const mapa = new Map<string, LinhaDashboardUnidadeSegmento>()
  for (const r of registros) {
    const chave = `${r.unidade}|${r.segmento}`
    const atual = mapa.get(chave) ?? { unidade: r.unidade, segmento: r.segmento, valorTotal: 0 }
    atual.valorTotal += r.valor_solicitado
    mapa.set(chave, atual)
  }
  return Array.from(mapa.values()).sort((a, b) => b.valorTotal - a.valorTotal)
}

export interface LinhaDashboardUnidadeStatus {
  unidade: string
  valorSolicitado: number
  valorAprovado: number
  valorEmAnalise: number
  valorReprovado: number
}

/** Soma `valor_solicitado` por Unidade, quebrado pelo "status atual" (`statusAtualLimpaPauta`) — pra tabela "Unidade/Solicitado/Aprovado/Em Análise/Reprovado" do Dashboard, maior solicitado primeiro. */
export function agruparLimpaPautaPorUnidadeStatus(
  registros: Pick<LimpaPauta, 'unidade' | 'valor_solicitado' | 'status_god' | 'status_geo' | 'status_rpo'>[],
): LinhaDashboardUnidadeStatus[] {
  const mapa = new Map<string, LinhaDashboardUnidadeStatus>()
  for (const r of registros) {
    const atual = mapa.get(r.unidade) ?? { unidade: r.unidade, valorSolicitado: 0, valorAprovado: 0, valorEmAnalise: 0, valorReprovado: 0 }
    atual.valorSolicitado += r.valor_solicitado
    const status = statusAtualLimpaPauta(r)
    if (status === 'ok') atual.valorAprovado += r.valor_solicitado
    else if (status === 'nok') atual.valorReprovado += r.valor_solicitado
    else atual.valorEmAnalise += r.valor_solicitado
    mapa.set(r.unidade, atual)
  }
  return Array.from(mapa.values()).sort((a, b) => b.valorSolicitado - a.valorSolicitado)
}
