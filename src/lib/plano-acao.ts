import type { PlanoAcaoStatus } from '@/types'

export const STATUS_LABEL: Record<PlanoAcaoStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  validado: 'Validado',
}

/** Classes de pílula (fundo/texto) por status — mesmo padrão de "Ativa/Inativa" já usado no app. */
export const STATUS_PILL: Record<PlanoAcaoStatus, string> = {
  pendente: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  em_andamento: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  concluido: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  validado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
}

export const STATUS_ORDEM: PlanoAcaoStatus[] = ['pendente', 'em_andamento', 'concluido', 'validado']

/** Status que cada papel pode escolher no formulário de mudança de status — unidade nunca valida. */
export function statusPermitidos(isAdmin: boolean): PlanoAcaoStatus[] {
  return isAdmin ? STATUS_ORDEM : STATUS_ORDEM.filter(s => s !== 'validado')
}

/** 'YYYY-MM-DD' de hoje, no fuso local — comparável lexicograficamente com `prazo`. */
export function hojeIso(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

export function estaAtrasado(prazo: string, status: PlanoAcaoStatus): boolean {
  return status !== 'validado' && prazo < hojeIso()
}

/** Formata uma data 'YYYY-MM-DD' em pt-BR sem sofrer o deslocamento de fuso do `new Date(iso)`. */
export function formatDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function formatDataHoraBr(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
