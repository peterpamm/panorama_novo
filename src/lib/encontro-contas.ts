import type { EncontroContas, EncontroContasStatus } from '@/types'

export const STATUS_LABEL: Record<EncontroContasStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  validado: 'Validado',
}

export const STATUS_PILL: Record<EncontroContasStatus, string> = {
  pendente: 'bg-red-500/15 text-red-700 dark:text-red-400',
  em_andamento: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  concluido: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  validado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
}

export const STATUS_ORDEM: EncontroContasStatus[] = ['pendente', 'em_andamento', 'concluido', 'validado']

/** Status que cada papel pode escolher no formulário de mudança de status — unidade nunca valida. */
export function statusPermitidos(isAdmin: boolean): EncontroContasStatus[] {
  return isAdmin ? STATUS_ORDEM : STATUS_ORDEM.filter(s => s !== 'validado')
}

export type NotaDebito = 'OK' | 'NOK' | 'N/A'

export const ND_LABEL: Record<NotaDebito, string> = { OK: 'OK', NOK: 'NOK', 'N/A': 'N/A' }

export const ND_PILL: Record<NotaDebito, string> = {
  OK: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  NOK: 'bg-red-500/15 text-red-700 dark:text-red-400',
  'N/A': 'bg-muted text-muted-foreground',
}

/** 'YYYY-MM-DD' de hoje, no fuso local — comparável lexicograficamente com `data`. */
export function hojeIso(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** Formata uma data 'YYYY-MM-DD' em pt-BR sem sofrer o deslocamento de fuso do `new Date(iso)`. */
export function formatDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function formatDataHoraBr(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Filtros compartilhados entre Tratativas e Histórico — mesma barra, mesma lógica. */
export interface FiltrosEcValues {
  unidade: string
  status: string
  motivo: string
  buscaMotivo: string
  chamado: string
  solicitante: string
  ano: string
  mes: string
  validadosPorMim: boolean
}

export const FILTROS_EC_INICIAL: FiltrosEcValues = {
  unidade: 'todas',
  status: 'todos',
  motivo: 'todos',
  buscaMotivo: '',
  chamado: '',
  solicitante: '',
  ano: 'todos',
  mes: 'todos',
  validadosPorMim: false,
}

/** Anos com pelo menos um EC, mais recente primeiro — pro Select de Ano do filtro. */
export function anosComEc(ecs: EncontroContas[]): number[] {
  const anos = new Set(ecs.map(e => Number(e.data.slice(0, 4))))
  return Array.from(anos).sort((a, b) => b - a)
}

export function filtrarEcs(ecs: EncontroContas[], f: FiltrosEcValues, meuEmail?: string | null): EncontroContas[] {
  return ecs.filter(e => {
    if (f.unidade === 'sem_unidade' && e.unidade) return false
    if (f.unidade !== 'todas' && f.unidade !== 'sem_unidade' && e.unidade !== f.unidade) return false
    if (f.status !== 'todos' && e.status !== f.status) return false
    if (f.motivo !== 'todos' && e.motivo !== f.motivo) return false
    if (f.buscaMotivo && !(e.motivo ?? '').toLowerCase().includes(f.buscaMotivo.toLowerCase())) return false
    if (f.chamado && !e.numero_chamado.toLowerCase().includes(f.chamado.toLowerCase())) return false
    if (f.solicitante && !e.solicitante.toLowerCase().includes(f.solicitante.toLowerCase())) return false
    if (f.ano !== 'todos' && e.data.slice(0, 4) !== f.ano) return false
    if (f.mes !== 'todos' && e.data.slice(5, 7) !== f.mes.padStart(2, '0')) return false
    if (f.validadosPorMim && e.validado_por_email !== meuEmail) return false
    return true
  })
}
