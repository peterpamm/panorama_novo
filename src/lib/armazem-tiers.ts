/**
 * Quem é T1 e quem é T2 no Armazém — fonte única, usada tanto pelos parsers
 * de importação (resultado e meta) quanto pelas telas de RV/SDG que separam
 * os dois grupos.
 *
 * T1 e T2 têm indicadores e tabelas próprias, mesmo quando o indicador tem o
 * mesmo nome nos dois (TMA, Presenteísmo AL) — daí a importância de nunca
 * confundir o tier de uma linha importada.
 */

/** Só ESTÂNCIA e CDR BAHIA se enquadram no Armazém T1 — mesma restrição do DTO T1. */
export const OPERACOES_ARMAZEM_T1 = ['ESTÂNCIA', 'CDR BAHIA']

export type ArmazemTier = 'T1' | 'T2'

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const T1_NORMALIZADAS = OPERACOES_ARMAZEM_T1.map(normalizar)

/**
 * De qual tier é a linha importada: o nome da aba manda ("RV ARM _T1" /
 * "RV ARM _T2", como vem da planilha oficial); quando a aba não diz nada
 * (CSV, ou aba renomeada), cai pra unidade. Ter os dois critérios evita
 * depender de alguém manter o nome da aba pra sempre.
 */
export function tierDaLinha(nomeAba: string, unidade: string): ArmazemTier {
  const aba = normalizar(nomeAba).replace(/\s+/g, '')
  if (aba.includes('T1')) return 'T1'
  if (aba.includes('T2')) return 'T2'
  return T1_NORMALIZADAS.includes(normalizar(unidade)) ? 'T1' : 'T2'
}
