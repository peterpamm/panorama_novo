/**
 * Duração no formato "HH:MM" ou "HH:MM:SS" (ex: "01:40" = 1h40min) → minutos
 * totais (100). Célula Excel formatada como hora vem como fração do dia
 * (serial: 1 = 24h), também convertida pra minutos. Compartilhado entre o
 * parser de resultado do BI (armazem-bi-parser) e os cards de meta (TMA).
 */
export function parseDuracaoParaMinutos(raw: unknown): number | null {
  if (typeof raw === 'number') return Math.round(raw * 24 * 60 * 100) / 100
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
