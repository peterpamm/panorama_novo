import { AJUSTE_TODAS_UNIDADES, type RotinaAjusteDia, type RotinaFinanceira } from '@/types'
import { prazoDaRotina, resolverDiaDoMes } from '@/lib/rotina-prazo'

/**
 * Ajustes de dia (o "arrastei o chip") são exceções por cima do prazo
 * cadastrado. Mais de um pode se aplicar ao mesmo mês — ex: um permanente
 * pra todas as unidades desde março e um pontual só pro Cascavel em agosto.
 * A ordem de precedência, do mais forte pro mais fraco:
 *
 *   1. Pontual (só neste mês) da própria unidade
 *   2. Pontual de todas as unidades
 *   3. Permanente da própria unidade — o de vigência mais recente
 *   4. Permanente de todas as unidades — o de vigência mais recente
 *   5. Nada: vale o prazo do cadastro
 *
 * Pontual ganha de permanente de propósito: ele é sempre uma decisão sobre
 * ESTE mês ("caiu no feriado, joga pro dia 11"), então deve vencer a regra
 * geral, inclusive a específica da unidade.
 */
function pontuacaoAjuste(ajuste: RotinaAjusteDia, unidade: string): number {
  const daUnidade = ajuste.unidade === unidade
  if (!ajuste.permanente) return daUnidade ? 4 : 3
  return daUnidade ? 2 : 1
}

/** Ajustes que valem pra essa unidade nesse mês — pontual do próprio mês, ou permanente já vigente. */
function ajustesAplicaveis(
  ajustes: RotinaAjusteDia[],
  rotinaId: string,
  unidade: string,
  ano: number,
  mes: number,
): RotinaAjusteDia[] {
  return ajustes.filter(a => {
    if (a.rotina_id !== rotinaId) return false
    if (a.unidade !== unidade && a.unidade !== AJUSTE_TODAS_UNIDADES) return false
    if (!a.permanente) return a.ano === ano && a.mes === mes
    // Permanente vale da vigência em diante — mês anterior à vigência continua
    // mostrando o dia que valia na época.
    return a.ano < ano || (a.ano === ano && a.mes <= mes)
  })
}

/** Vigência como número comparável (202608), pra achar o permanente mais recente. */
function vigencia(ajuste: RotinaAjusteDia): number {
  return ajuste.ano * 100 + ajuste.mes
}

/** O ajuste que vence pra essa rotina/unidade/mês, ou null se nenhum se aplica. */
export function ajusteVigente(
  ajustes: RotinaAjusteDia[],
  rotinaId: string,
  unidade: string,
  ano: number,
  mes: number,
): RotinaAjusteDia | null {
  const aplicaveis = ajustesAplicaveis(ajustes, rotinaId, unidade, ano, mes)
  if (aplicaveis.length === 0) return null

  return aplicaveis.reduce((melhor, atual) => {
    const pMelhor = pontuacaoAjuste(melhor, unidade)
    const pAtual = pontuacaoAjuste(atual, unidade)
    if (pAtual !== pMelhor) return pAtual > pMelhor ? atual : melhor
    // Mesmo escopo: o de vigência mais recente manda (só acontece entre permanentes).
    return vigencia(atual) > vigencia(melhor) ? atual : melhor
  })
}

/**
 * Em que dia a rotina cai pra essa unidade nesse mês: o ajuste vigente
 * quando existe, senão o prazo do cadastro. null = sem data (fica fora da
 * grade do calendário).
 */
export function diaDaRotinaNoMes(
  rotina: RotinaFinanceira,
  ajustes: RotinaAjusteDia[],
  unidade: string,
  ano: number,
  mes: number,
): number | null {
  const ajuste = ajusteVigente(ajustes, rotina.id ?? '', unidade, ano, mes)
  if (ajuste) {
    // Ajuste nunca pode apontar pra um dia que não existe no mês (ex: 31 em
    // fevereiro, herdado de um permanente criado num mês de 31 dias).
    const ultimoDia = new Date(ano, mes, 0).getDate()
    return Math.min(ajuste.dia, ultimoDia)
  }
  return resolverDiaDoMes(prazoDaRotina(rotina), ano, mes)
}

/**
 * Agrupa as rotinas pelo dia em que caem pra uma unidade, já considerando os
 * ajustes — versão do `agruparRotinasPorDia` usada pelo Calendário depois que
 * o arrastar entrou em cena.
 */
export function agruparRotinasComAjustes(
  rotinas: RotinaFinanceira[],
  ajustes: RotinaAjusteDia[],
  unidade: string,
  ano: number,
  mes: number,
): { porDia: Map<number, RotinaFinanceira[]>; semData: RotinaFinanceira[] } {
  const porDia = new Map<number, RotinaFinanceira[]>()
  const semData: RotinaFinanceira[] = []

  for (const rotina of rotinas) {
    const dia = diaDaRotinaNoMes(rotina, ajustes, unidade, ano, mes)
    if (dia === null) {
      semData.push(rotina)
      continue
    }
    porDia.set(dia, [...(porDia.get(dia) ?? []), rotina])
  }
  return { porDia, semData }
}
