/**
 * Consolidação do Resumo Geral / Ranking Corporativo da Reunião Resultados —
 * soma a pontuação dos 6 setores por unidade e aplica as bonificações extras
 * (EBITDA batido + colocação nos 3 Rankings Ambev). Funções puras, sem
 * acesso a dados — quem monta os `useReuniaoDados` dos 6 setores e o EBITDA
 * (`valorFarolPacoteUnidadeMes`/`buscarMetaOrcamento`, ver
 * `ResultadoMesReuniaoTab.tsx`) é a página.
 */
import type { ResumoGeralAmbevSetor, ResumoGeralHistorico } from '@/types'

/** Bônus (pontos) fixo por bater a meta mensal de EBITDA (Orçado × Realizado). */
export const PONTOS_EBITDA_BATIDO = 50

/** Posição da unidade em cada um dos 3 Rankings Ambev do mês (Gente/Frota/Segurança são independentes — a mesma unidade pode ser 1º num e não pontuar noutro). */
export type PosicoesAmbev = Record<ResumoGeralAmbevSetor, number | null>

export const POSICOES_AMBEV_VAZIAS: PosicoesAmbev = { gente: null, frota: null, seguranca: null }

/** Bônus de UM Ranking Ambev pela colocação da unidade nele — lançado manualmente pelo admin, não guardado (só a posição é). */
export function bonusRankingAmbev(posicao: number | null): number {
  if (posicao === null) return 0
  if (posicao === 1) return 50
  if (posicao >= 2 && posicao <= 5) return 30
  return 0
}

/** Soma o bônus dos 3 Rankings Ambev (Gente/Frota/Segurança) — 1º nos 3 dá 150. */
export function somarBonusRankingAmbev(posicoes: PosicoesAmbev): number {
  return bonusRankingAmbev(posicoes.gente) + bonusRankingAmbev(posicoes.frota) + bonusRankingAmbev(posicoes.seguranca)
}

/** Bateu a meta mensal de EBITDA — natureza 'performance' (PACOTES['232']): maior é melhor. */
export function ebitdaBatido(avr: number | null, meta: number | null): boolean {
  return avr !== null && meta !== null && avr >= meta
}

/** Contribuição de um setor pra uma unidade num mês — `pontos` null (setor sem indicador lançado, ou unidade não participa dele) conta como 0 na soma. */
export interface ContribuicaoSetor {
  setor: string
  unidade: string
  negocio: string
  pontos: number | null
}

/** Soma as contribuições dos setores pra uma linha (unidade+negócio) — a "Pontuação dos setores" do Resumo Geral. Financeiro não separa Camaçari, então sua contribuição já chega igual nas duas linhas (Rota/Armazém) — decidido no chamador. */
export function somarPontuacaoSetores(contribuicoes: ContribuicaoSetor[]): number {
  return contribuicoes.reduce((acc, c) => acc + (c.pontos ?? 0), 0)
}

/** Total de bonificações extras (EBITDA + os 3 Rankings Ambev) de uma unidade no mês. */
export function somarPontosExtras(ebitdaOk: boolean, posicoesAmbev: PosicoesAmbev): number {
  return (ebitdaOk ? PONTOS_EBITDA_BATIDO : 0) + somarBonusRankingAmbev(posicoesAmbev)
}

export interface ResumoMesUnidade {
  pontuacaoSetores: number
  ebitdaOk: boolean
  posicoesAmbev: PosicoesAmbev
  pontosExtras: number
  pontuacaoFinal: number
}

/** Pontuação final ao vivo de uma unidade (ou linha Rota/Armazém, no caso de Camaçari) num mês — setores + bonificações do próprio mês. Usado nas telas mensais (Resumo Geral, Ranking por Setor, Detalhes da Unidade); o Ranking Anual soma isso mês a mês em cima do acumulado importado (ver `somarAcumuladoAnual`). */
export function resolverResumoMesUnidade(params: {
  contribuicoesSetores: ContribuicaoSetor[]
  ebitdaAvr: number | null
  ebitdaMeta: number | null
  posicoesAmbev: PosicoesAmbev
}): ResumoMesUnidade {
  const pontuacaoSetores = somarPontuacaoSetores(params.contribuicoesSetores)
  const ebitdaOk = ebitdaBatido(params.ebitdaAvr, params.ebitdaMeta)
  const pontosExtras = somarPontosExtras(ebitdaOk, params.posicoesAmbev)
  return {
    pontuacaoSetores,
    ebitdaOk,
    posicoesAmbev: params.posicoesAmbev,
    pontosExtras,
    pontuacaoFinal: pontuacaoSetores + pontosExtras,
  }
}

/** Acumulado até um mês de corte, importado de planilha (Resumo Geral > Importação de Histórico). */
export interface AcumuladoHistorico {
  mesFinal: number
  pontuacaoAcumulada: number
}

/** Soma os 6 setores do histórico importado — o "Total" da planilha, recalculado (nunca lido direto do arquivo). */
export function totalHistoricoSetores(h: ResumoGeralHistorico): number {
  return h.financeiro + h.gente + h.frota + h.seguranca + h.distribuicao + h.armazem
}

/**
 * Pontuação acumulada do ano pra uma unidade (Ranking Anual): quando existe
 * histórico importado, começa dele (já cobre Jan até `mesFinal`) e soma só
 * os meses AO VIVO depois desse corte — nunca conta o mesmo mês duas vezes.
 * Sem histórico, soma os 12 meses ao vivo normalmente. `pontuacaoFinalDoMes`
 * retorna null pra mês sem nenhum indicador lançado (conta como 0, não
 * derruba a soma nem marca "sem dado" se outros meses tiverem valor).
 */
export function somarAcumuladoAnual(
  pontuacaoFinalDoMes: (mes: number) => number | null,
  historico: AcumuladoHistorico | null,
): number {
  const mesInicio = historico ? historico.mesFinal + 1 : 1
  let acumulado = historico ? historico.pontuacaoAcumulada : 0
  for (let mes = mesInicio; mes <= 12; mes++) {
    acumulado += pontuacaoFinalDoMes(mes) ?? 0
  }
  return acumulado
}
