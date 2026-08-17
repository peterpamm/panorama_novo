import { AJUSTE_TODAS_UNIDADES, type CalendarioEvento } from '@/types'

const DIAS_SEMANA_NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** Converte "YYYY-MM-DD" em {ano, mes, dia} sem passar por Date (evita fuso comer um dia). */
function partesData(data: string): { ano: number; mes: number; dia: number } | null {
  const m = data.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) }
}

/** Número comparável AAAAMMDD, pra checar se um dia está dentro da vigência. */
function comoNumero(ano: number, mes: number, dia: number): number {
  return ano * 10000 + mes * 100 + dia
}

function dentroDaVigencia(evento: CalendarioEvento, ano: number, mes: number, dia: number): boolean {
  const alvo = comoNumero(ano, mes, dia)
  const inicio = partesData(evento.data_inicio)
  if (inicio && alvo < comoNumero(inicio.ano, inicio.mes, inicio.dia)) return false
  if (evento.data_fim) {
    const fim = partesData(evento.data_fim)
    if (fim && alvo > comoNumero(fim.ano, fim.mes, fim.dia)) return false
  }
  return true
}

/** O evento vale pra essa unidade? ('*' vale pra todas.) */
export function eventoDaUnidade(evento: CalendarioEvento, unidade: string): boolean {
  return evento.unidade === unidade || evento.unidade === AJUSTE_TODAS_UNIDADES
}

/**
 * Em que dias do mês esse evento acontece — o que o calendário desenha.
 * Único cai no próprio dia; semanal em todo `dia_semana` do mês; mensal no
 * `dia_mes` (limitado ao último dia, então 31 vira 28/29/30 conforme o mês).
 * Sempre respeitando a vigência (`data_inicio`/`data_fim`), pra um RPS
 * encerrado sumir dos meses novos sem apagar o histórico.
 */
export function ocorrenciasNoMes(evento: CalendarioEvento, ano: number, mes: number): number[] {
  const totalDias = new Date(ano, mes, 0).getDate()

  if (evento.tipo === 'unico') {
    const data = partesData(evento.data_inicio)
    if (!data || data.ano !== ano || data.mes !== mes) return []
    return [data.dia]
  }

  if (evento.tipo === 'semanal') {
    if (evento.dia_semana === null) return []
    const dias: number[] = []
    for (let dia = 1; dia <= totalDias; dia++) {
      if (new Date(ano, mes - 1, dia).getDay() !== evento.dia_semana) continue
      if (dentroDaVigencia(evento, ano, mes, dia)) dias.push(dia)
    }
    return dias
  }

  if (evento.dia_mes === null) return []
  const dia = Math.min(evento.dia_mes, totalDias)
  return dentroDaVigencia(evento, ano, mes, dia) ? [dia] : []
}

/**
 * Agrupa os eventos de uma unidade pelos dias do mês em que caem — mesmo
 * formato do `agruparRotinasComAjustes`, pra tela desenhar rotina e evento
 * lado a lado na mesma célula.
 */
export function agruparEventosPorDia(
  eventos: CalendarioEvento[],
  unidade: string,
  ano: number,
  mes: number,
): Map<number, CalendarioEvento[]> {
  const porDia = new Map<number, CalendarioEvento[]>()
  for (const evento of eventos) {
    if (!eventoDaUnidade(evento, unidade)) continue
    for (const dia of ocorrenciasNoMes(evento, ano, mes)) {
      porDia.set(dia, [...(porDia.get(dia) ?? []), evento])
    }
  }
  return porDia
}

/** Descrição curta da recorrência, pra listagem e tooltip ("Toda sexta", "Todo dia 10", "15/08/2026"). */
export function rotuloRecorrencia(evento: CalendarioEvento): string {
  if (evento.tipo === 'semanal' && evento.dia_semana !== null) {
    const nome = DIAS_SEMANA_NOMES[evento.dia_semana]
    return evento.dia_semana === 0 || evento.dia_semana === 6 ? `Todo ${nome}` : `Toda ${nome}`
  }
  if (evento.tipo === 'mensal' && evento.dia_mes !== null) return `Todo dia ${evento.dia_mes}`
  const data = partesData(evento.data_inicio)
  return data ? `${String(data.dia).padStart(2, '0')}/${String(data.mes).padStart(2, '0')}/${data.ano}` : '—'
}
