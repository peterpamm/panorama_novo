import type { DreCalculoRow } from '@/types'

export interface LinhaTopConta {
  codigo: string
  realizado: number
  gap: number
}

/** Agrega uma faixa de contas (ex: 191–227, subcontas do pacote Despesas ADM Gerais) e retorna as `topN` com pior gap (diferença mais negativa primeiro). */
export function topContasFaixa(rows: DreCalculoRow[], contaIni: number, contaFim: number, topN = 10): LinhaTopConta[] {
  const porConta = new Map<string, LinhaTopConta>()
  for (const r of rows) {
    const num = Number(r.conta_codigo)
    if (!Number.isInteger(num) || num < contaIni || num > contaFim) continue
    const atual = porConta.get(r.conta_codigo) ?? { codigo: r.conta_codigo, realizado: 0, gap: 0 }
    atual.realizado += r.real
    atual.gap += r.dif
    porConta.set(r.conta_codigo, atual)
  }
  return Array.from(porConta.values())
    .filter(c => c.realizado !== 0 || c.gap !== 0)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, topN)
}
