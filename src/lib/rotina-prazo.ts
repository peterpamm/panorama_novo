/**
 * Prazo estruturado das rotinas financeiras — o que permite desenhar a rotina
 * num dia do calendário (Área Financeira > Rotinas > Calendário). O campo
 * `prazo` continua sendo o texto livre que aparece na tela ("Dia 10",
 * "4º dia útil", "1 dia após envio da matriz"); isto aqui é só a versão que a
 * máquina entende.
 */
import type { PrazoTipo, RotinaFinanceira } from '@/types'

export interface PrazoEstruturado {
  tipo: PrazoTipo
  /** Dia do mês (dia_fixo) ou o n-ésimo dia útil (dia_util). null quando `tipo` é 'sem_data'. */
  dia: number | null
}

export const PRAZO_SEM_DATA: PrazoEstruturado = { tipo: 'sem_data', dia: null }

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Lê o texto livre do prazo e devolve o prazo estruturado — usado pro
 * pré-preenchimento em massa no Cadastro, não em tempo de exibição (o que vale
 * no calendário é sempre o que está salvo, revisado por gente).
 *
 * Reconhece "Dia 10", "até o dia 10", "10" (dia fixo) e "4º dia útil",
 * "4 dia util" (n-ésimo dia útil). Prazo que depende de outro evento
 * ("1 dia após envio da matriz", "após o fechamento") volta como 'sem_data'
 * de propósito: não existe dia pra ele, e chutar um seria pior que deixar na
 * lista de "sem data definida" do calendário.
 */
export function interpretarPrazoTexto(prazo: string): PrazoEstruturado {
  const texto = normalizar(prazo)
  if (texto === '') return PRAZO_SEM_DATA

  // Depende de outro evento — nenhum dia do mês serve.
  if (/\b(apos|depois|antes de|conforme|quando)\b/.test(texto)) return PRAZO_SEM_DATA

  // "4º dia útil" / "4 dia util" / "4o dia util" — precisa vir antes do dia
  // fixo, senão o "dia" da expressão confunde a outra regra.
  const diaUtil = texto.match(/(\d{1,2})\s*[º°o]?\s*dia\s*util/)
  if (diaUtil) return { tipo: 'dia_util', dia: Number(diaUtil[1]) }

  // "Dia 10" / "todo dia 10" / "até o dia 10" — o número vem DEPOIS de "dia",
  // o que naturalmente descarta "1 dia após envio" (número antes).
  const diaFixo = texto.match(/\bdia\s*(\d{1,2})\b/)
  if (diaFixo) return { tipo: 'dia_fixo', dia: Number(diaFixo[1]) }

  // Só um número solto ("10", "10/mês").
  const soNumero = texto.match(/^(\d{1,2})\b/)
  if (soNumero) return { tipo: 'dia_fixo', dia: Number(soNumero[1]) }

  return PRAZO_SEM_DATA
}

/** Dias úteis (seg-sex) do mês, em ordem — feriado NÃO é considerado (ver `resolverDiaDoMes`). */
function diasUteisDoMes(ano: number, mes: number): number[] {
  const total = new Date(ano, mes, 0).getDate()
  const dias: number[] = []
  for (let dia = 1; dia <= total; dia++) {
    const semana = new Date(ano, mes - 1, dia).getDay()
    if (semana !== 0 && semana !== 6) dias.push(dia)
  }
  return dias
}

/**
 * Em que dia do mês essa rotina cai — o que o calendário usa pra posicionar
 * o chip. Devolve null quando não há dia (prazo 'sem_data' ou sem número).
 *
 * Duas decisões que valem saber:
 * - **Dia fixo maior que o mês** cai no último dia do mês (então dia 31 é um
 *   jeito prático de dizer "último dia do mês").
 * - **Dia útil conta só seg-sex, ignorando feriado.** Em mês com feriado no
 *   começo o "4º dia útil" sai um dia adiantado — a correção é arrastar o
 *   chip no calendário, que é justamente pra isso. Dia fixo que cai em fim
 *   de semana também NÃO é empurrado sozinho, pelo mesmo motivo.
 */
export function resolverDiaDoMes(prazo: PrazoEstruturado, ano: number, mes: number): number | null {
  if (prazo.dia === null || prazo.dia <= 0) return null

  if (prazo.tipo === 'dia_fixo') {
    const ultimoDia = new Date(ano, mes, 0).getDate()
    return Math.min(prazo.dia, ultimoDia)
  }

  if (prazo.tipo === 'dia_util') {
    const uteis = diasUteisDoMes(ano, mes)
    if (uteis.length === 0) return null
    return uteis[Math.min(prazo.dia, uteis.length) - 1]
  }

  return null
}

/** Rótulo curto do prazo estruturado, pra tabela de cadastro e tooltip do calendário. */
export function rotuloPrazoEstruturado(prazo: PrazoEstruturado): string {
  if (prazo.tipo === 'dia_fixo' && prazo.dia !== null) return `Dia ${prazo.dia}`
  if (prazo.tipo === 'dia_util' && prazo.dia !== null) return `${prazo.dia}º dia útil`
  return 'Sem data'
}

/** Atalho pra ler o prazo estruturado direto de uma rotina cadastrada. */
export function prazoDaRotina(rotina: RotinaFinanceira): PrazoEstruturado {
  return { tipo: rotina.prazo_tipo, dia: rotina.prazo_dia }
}

export interface DiaCalendario {
  /** null = célula vazia no começo/fim da grade (dia de outro mês). */
  dia: number | null
  fimDeSemana: boolean
}

/**
 * Grade do mês em semanas de domingo a sábado, com células vazias antes do
 * dia 1 e depois do último dia — o formato que a tela do Calendário desenha
 * direto, sem fazer conta de posição no JSX.
 */
export function gradeDoMes(ano: number, mes: number): DiaCalendario[][] {
  const totalDias = new Date(ano, mes, 0).getDate()
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay()

  const celulas: DiaCalendario[] = []
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push({ dia: null, fimDeSemana: false })
  for (let dia = 1; dia <= totalDias; dia++) {
    const semana = new Date(ano, mes - 1, dia).getDay()
    celulas.push({ dia, fimDeSemana: semana === 0 || semana === 6 })
  }
  while (celulas.length % 7 !== 0) celulas.push({ dia: null, fimDeSemana: false })

  const semanas: DiaCalendario[][] = []
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7))
  return semanas
}

/**
 * Agrupa rotinas pelo dia do mês em que vencem. Quem não tem dia (prazo
 * 'sem_data') sai em `semData`, pra tela listar do lado da grade em vez de
 * simplesmente sumir com a rotina.
 */
export function agruparRotinasPorDia<T extends RotinaFinanceira>(
  rotinas: T[],
  ano: number,
  mes: number,
): { porDia: Map<number, T[]>; semData: T[] } {
  const porDia = new Map<number, T[]>()
  const semData: T[] = []

  for (const rotina of rotinas) {
    const dia = resolverDiaDoMes(prazoDaRotina(rotina), ano, mes)
    if (dia === null) {
      semData.push(rotina)
      continue
    }
    porDia.set(dia, [...(porDia.get(dia) ?? []), rotina])
  }
  return { porDia, semData }
}
