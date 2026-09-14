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

/** Valor monetário inteiro, sem casas decimais e sem abreviação K/M — ex: "R$ 1.234.567". */
export function formatCurrencyInteiro(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

/** Espelha formatar_valor_monetario do Python: R$ X.XK / R$ X.XM, ou inteiro com separador de milhar. */
/** Mesmo `formatCurrencyInteiro`, mas negativo entre parênteses em vez de sinal de menos — convenção contábil pedida no SDG Corporativo de Frota (só usada ali; o resto do app continua com o sinal de menos padrão). */
export function formatCurrencyParenteses(value: number | null | undefined): string {
  if (value == null) return '—'
  const formatado = formatCurrencyInteiro(Math.abs(value))
  return value < 0 ? `(${formatado})` : formatado
}

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

/** Número puro no formato pt-BR (ex: "1.252.522,80" ou "-77,83"), sem moeda/% — o valor exatamente como vem da planilha. */
export function formatNumeroPtBr(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
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
