import type { RelatoSeguranca } from '@/types'

export interface CamadaPiramide {
  classificacao: string
  total: number
  sif: number
}

/**
 * Agrupa relatos de segurança por classificação — total de relatos + quantos
 * deles são SIF — ordenado do menos frequente pro mais frequente (mesma
 * leitura de uma pirâmide de segurança de verdade: topo estreito/raro, base
 * larga/comum). Não é uma lista fechada de classificações — desenha o que
 * vier nos dados importados (ver `relatos-seguranca-parser.ts`), então uma
 * classificação nova não cadastrada em lugar nenhum ainda assim aparece.
 */
export function agruparPorClassificacao(relatos: RelatoSeguranca[]): CamadaPiramide[] {
  const mapa = new Map<string, { total: number; sif: number }>()
  for (const r of relatos) {
    const atual = mapa.get(r.classificacao) ?? { total: 0, sif: 0 }
    atual.total += 1
    if (ehSifValido(r)) atual.sif += 1
    mapa.set(r.classificacao, atual)
  }
  return Array.from(mapa.entries())
    .map(([classificacao, { total, sif }]) => ({ classificacao, total, sif }))
    .sort((a, b) => a.total - b.total)
}

/**
 * Hierarquia de severidade padrão de segurança do trabalho (do mais grave —
 * topo estreito — pro mais comum — base larga). A pirâmide SEMPRE mostra
 * essas 9 fileiras, mesmo com 0 relato numa delas (ex: nunca teve Fatal) —
 * mesmo padrão de referência do usuário: a forma da pirâmide não muda mês a
 * mês, só os números dentro dela.
 */
const CLASSIFICACOES_PADRAO = [
  'FATAL', 'LTI', 'MDI', 'MTI', 'FAI', 'INCIDENTE', 'ATO INSEGURO', 'CONDIÇÃO INSEGURA', 'ABORDAGEM POSITIVA',
]

/**
 * Monta a pirâmide completa: as 9 fileiras padrão sempre aparecem, na ordem
 * de severidade (zeradas quando não tem relato) — preenchidas com o total/
 * SIF de `camadas` quando a classificação bate. Uma classificação fora
 * dessas 9 (nova, ainda não catalogada) não desaparece — entra depois de
 * todas as conhecidas, ordenada entre si do mais pro menos frequente
 * (aproximação razoável: sem saber a severidade real, pelo menos mantém
 * "mais raro primeiro").
 */
export function ordenarPorSeveridade(camadas: CamadaPiramide[]): CamadaPiramide[] {
  const porClassificacao = new Map(camadas.map(c => [c.classificacao, c]))
  const conhecidas = CLASSIFICACOES_PADRAO.map(classificacao => porClassificacao.get(classificacao) ?? { classificacao, total: 0, sif: 0 })
  const desconhecidas = camadas
    .filter(c => !CLASSIFICACOES_PADRAO.includes(c.classificacao))
    .sort((a, b) => b.total - a.total)
  return [...conhecidas, ...desconhecidas]
}

export interface RelatosDoMes {
  mes: number
  porClassificacao: Map<string, number>
  total: number
}

/**
 * Quebra os relatos por mês (mesInicial..mesFinal, inclusive) — pra montar a
 * grade de colunas mensais ao lado da pirâmide (uma coluna por mês, uma
 * célula por classificação, alinhada com a fileira correspondente da
 * pirâmide, + total do mês embaixo).
 */
export function agruparPorMes(relatos: RelatoSeguranca[], mesInicial: number, mesFinal: number): RelatosDoMes[] {
  const porMes: RelatosDoMes[] = []
  for (let m = mesInicial; m <= mesFinal; m++) {
    const doMes = relatos.filter(r => r.mes === m)
    const porClassificacao = new Map<string, number>()
    for (const r of doMes) porClassificacao.set(r.classificacao, (porClassificacao.get(r.classificacao) ?? 0) + 1)
    porMes.push({ mes: m, porClassificacao, total: doMes.length })
  }
  return porMes
}

/**
 * Valores da coluna SIF (`sif_tipo`) que contam como SIF de verdade pros
 * cards/tabela da Pirâmide — pedido explícito do usuário: só "SIF PERCUSOR"
 * e "SIF POTENCIAL" contam, outros valores que a coluna SIF possa ter (além
 * de "NÃO") não.
 */
export const SIF_TIPOS_VALIDOS = ['SIF PERCUSOR', 'SIF POTENCIAL']

function ehSifValido(relato: RelatoSeguranca): boolean {
  return relato.sif_tipo !== null && SIF_TIPOS_VALIDOS.includes(relato.sif_tipo)
}

/** FATAL sempre entra na tabela de eventos, mesmo sem marcação SIF nenhuma — pedido explícito do usuário. */
const CLASSIFICACAO_SEMPRE_LISTADA = 'FATAL'

/**
 * Classificações que só entram na TABELA de eventos abaixo da pirâmide
 * quando TAMBÉM são SIF válido (`ehSifValido`) — pedido explícito do
 * usuário: Incidente, LTI, MDI, FAI, MTI (sem Fatal, que já entra sozinho —
 * ver `CLASSIFICACAO_SEMPRE_LISTADA`). Um SIF marcado numa Abordagem
 * Positiva, Ato Inseguro ou Condição Insegura não entra na tabela, só polui
 * a apresentação. Os CARDS de SIF (`contarSif`), por outro lado, contam
 * qualquer classificação — essa lista vale só pra tabela.
 */
export const CLASSIFICACOES_SIF_VALIDO = ['LTI', 'MDI', 'MTI', 'FAI', 'INCIDENTE']

/** Quantos relatos da lista são SIF válido (`ehSifValido` — só "SIF PERCUSOR"/"SIF POTENCIAL"), em qualquer classificação — usado nos cards "SIF do mês"/"SIF acumulado". */
export function contarSif(relatos: RelatoSeguranca[]): number {
  return relatos.filter(ehSifValido).length
}

/**
 * Relatos de um mês específico que merecem uma tabela de detalhe abaixo da
 * pirâmide: classificação FATAL (sempre, mesmo sem SIF) OU classificação em
 * `CLASSIFICACOES_SIF_VALIDO` que também seja SIF válido (`ehSifValido` —
 * "SIF PERCUSOR"/"SIF POTENCIAL") — ordenados do mais recente pro mais
 * antigo.
 */
export function eventosGraves(relatos: RelatoSeguranca[], mes: number): RelatoSeguranca[] {
  return relatos
    .filter(r => r.mes === mes && (
      r.classificacao === CLASSIFICACAO_SEMPRE_LISTADA
      || (CLASSIFICACOES_SIF_VALIDO.includes(r.classificacao) && ehSifValido(r))
    ))
    .sort((a, b) => b.data_ocorrencia.localeCompare(a.data_ocorrencia))
}
