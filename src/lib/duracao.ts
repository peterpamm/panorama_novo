/**
 * Duração no formato "HH:MM" ou "HH:MM:SS" (ex: "01:40" = 1h40min) → minutos
 * totais (100). Célula Excel formatada como hora vem como fração do dia
 * (serial: 1 = 24h, ex: 0,05625 = 01:21), também convertida pra minutos.
 * Compartilhado entre o parser de resultado do BI (armazem-resultado-parser)
 * e os cards de meta (TMA).
 *
 * Algumas planilhas (import da Reunião Resultados) vêm com a célula de
 * RESULT sem formatação de hora — um número "puro" já em minutos (ex: 141 =
 * 02:21), não a fração do dia. Um valor >= 1 nunca é uma fração de dia válida
 * pra esse indicador (seria mais de 24h de TMA), então nesse caso já está em
 * minutos — sem multiplicar por 1440. Sem essa distinção, esse número puro
 * virava um TMA absurdo (141 → "3384:00" em vez de "02:21").
 */
export function parseDuracaoParaMinutos(raw: unknown): number | null {
  if (typeof raw === 'number') return raw < 1 ? Math.round(raw * 24 * 60 * 100) / 100 : Math.round(raw * 100) / 100
  const str = String(raw ?? '').trim()
  if (str === '') return null
  const partes = str.split(':').map(p => p.trim())
  if (partes.length < 2 || partes.some(p => p === '' || Number.isNaN(Number(p)))) return null
  const [h, m, s = '0'] = partes
  return Math.round((Number(h) * 60 + Number(m) + Number(s) / 60) * 100) / 100
}

/** Minutos totais (100) → "HH:MM" (ou "HH:MM:SS" se sobrar fração de segundo). */
export function formatarMinutosComoDuracao(totalMinutos: number): string {
  const totalSegundos = Math.round(totalMinutos * 60)
  const horas = Math.floor(totalSegundos / 3600)
  const minutos = Math.floor((totalSegundos % 3600) / 60)
  const segundos = totalSegundos % 60
  const hh = String(horas).padStart(2, '0')
  const mm = String(minutos).padStart(2, '0')
  return segundos === 0 ? `${hh}:${mm}` : `${hh}:${mm}:${String(segundos).padStart(2, '0')}`
}
