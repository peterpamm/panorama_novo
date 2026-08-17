import type { RotinaFinanceiraStatus } from '@/types'

/** Mês anterior, com virada de ano em janeiro — usado pra herdar N/A de um mês pro seguinte. */
export function mesAnterior(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }
}

export interface StatusExibicaoRotina {
  status: 'OK' | 'NOK' | 'N/A' | null
  observacao: string
  /** true = veio do N/A do mês anterior, ainda não gravado neste mês (ver `mapaStatusExibicao`). */
  herdado: boolean
}

/** Chave usada nos mapas de status: rotina + unidade. */
export function chaveStatus(rotinaId: string, unidadeCodigo: string): string {
  return `${rotinaId}|${unidadeCodigo}`
}

/**
 * O que mostrar em cada par rotina × unidade no mês: a resposta do próprio
 * mês quando existe; senão, o N/A do mês anterior (marcado como `herdado`).
 * N/A normalmente é estrutural — a rotina não se aplica àquela
 * unidade/negócio —, então tende a se repetir mês a mês. OK/NOK nunca
 * herdam: são um julgamento que precisa ser refeito toda vez.
 *
 * `herdado` só existe na tela; confirmar ou mudar grava uma linha de verdade
 * no mês. Compartilhado entre a matriz (Acompanhamento) e o Calendário pra
 * que as duas contem a mesma história.
 */
export function mapaStatusExibicao(
  statusMes: RotinaFinanceiraStatus[],
  statusMesAnterior: RotinaFinanceiraStatus[],
): Map<string, StatusExibicaoRotina> {
  const mapa = new Map<string, StatusExibicaoRotina>()
  for (const s of statusMesAnterior) {
    if (s.status === 'N/A') mapa.set(chaveStatus(s.rotina_id, s.unidade), { status: 'N/A', observacao: '', herdado: true })
  }
  for (const s of statusMes) {
    mapa.set(chaveStatus(s.rotina_id, s.unidade), { status: s.status, observacao: s.observacao, herdado: false })
  }
  return mapa
}

export interface AderenciaMensal {
  /** % de aderência por mês (índice 0 = janeiro), null quando a unidade não tem nenhuma rotina OK/NOK respondida naquele mês. */
  porMes: (number | null)[]
  /** % acumulado do ano inteiro (soma de OK e de OK+NOK de todos os meses), null se não houver nenhum dado no ano. */
  acumulado: number | null
}

/**
 * % de aderência = OK / (OK + NOK) — não conta rotina com status N/A nem
 * mês/rotina sem resposta nenhuma (não entram no denominador). `rotinasIds`
 * já deve vir filtrado só pras rotinas ativas (mesmo critério da aba
 * Acompanhamento).
 */
export function calcularAderenciaPorUnidade(
  rotinasIds: Set<string>,
  statusAno: RotinaFinanceiraStatus[],
  unidadeCodigo: string,
): AderenciaMensal {
  const porMes: (number | null)[] = []
  let okAno = 0
  let totalAno = 0

  for (let mes = 1; mes <= 12; mes++) {
    const doMes = statusAno.filter(s =>
      s.unidade === unidadeCodigo && s.mes === mes && rotinasIds.has(s.rotina_id) && (s.status === 'OK' || s.status === 'NOK'),
    )
    const ok = doMes.filter(s => s.status === 'OK').length
    const total = doMes.length
    porMes.push(total > 0 ? (ok / total) * 100 : null)
    okAno += ok
    totalAno += total
  }

  return { porMes, acumulado: totalAno > 0 ? (okAno / totalAno) * 100 : null }
}
