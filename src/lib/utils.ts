import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/** Espelha formatar_valor_monetario do Python: R$ X.XK / R$ X.XM, ou inteiro com separador de milhar. */
export function formatCurrencyCompact(value: number | null | undefined): string {
  if (value == null) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(1)}K`
  return `${sign}R$ ${abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null) return '—'
  return `${value.toFixed(digits)}%`
}

export function formatPercentSigned(value: number | null | undefined, digits = 2): string {
  if (value == null) return '—'
  const sinal = value >= 0 ? '+' : ''
  return `${sinal}${value.toFixed(digits)}%`
}

/** Converte número formatado em pt-BR (ex: "1.252.522,80" ou "-77,83") para number. */
export function parseNumeroPtBr(value: unknown): number {
  if (typeof value === 'number') return value
  if (value == null) return 0
  const str = String(value).trim()
  if (str === '' || str === '-') return 0
  const normalizado = str.replace(/\./g, '').replace(',', '.')
  const parsed = parseFloat(normalizado)
  return Number.isNaN(parsed) ? 0 : parsed
}
