import { CONTA_RECEITA } from '@/lib/constants'
import type { OrcamentoLinha } from '@/types'

const MESES_SEMESTRE: Record<13 | 14, number[]> = {
  13: [1, 2, 3, 4, 5, 6],
  14: [7, 8, 9, 10, 11, 12],
}

/**
 * Recalcula os blocos de 1º e 2º semestre (mes=13/14) do orçamento a partir
 * dos 12 meses já importados de um ano — pra cada unidade×negócio×conta,
 * soma o ORÇADO (R$) dos 6 meses do semestre, e recalcula o AV como Análise
 * Vertical acumulada: soma do ORÇADO da conta dividida pela soma do ORÇADO
 * da Receita Líquida Operacional (mesma unidade×negócio), no semestre —
 * mesma conta que a própria planilha já faz mês a mês. `ah` não se aplica
 * (fica 0). Roda de novo (upsert) sempre que o orçamento for reimportado —
 * ex: quando novas unidades entram no 2º semestre.
 */
export function calcularLinhasSemestre(rows: OrcamentoLinha[], ano: number): Omit<OrcamentoLinha, 'id'>[] {
  const doAno = rows.filter(r => r.ano === ano && r.mes >= 1 && r.mes <= 12)

  const combos = new Map<string, { unidade: string; negocio: string }>()
  for (const r of doAno) combos.set(`${r.unidade}|${r.negocio}`, { unidade: r.unidade, negocio: r.negocio })

  const resultado: Omit<OrcamentoLinha, 'id'>[] = []

  for (const { unidade, negocio } of combos.values()) {
    const rowsCombo = doAno.filter(r => r.unidade === unidade && r.negocio === negocio)
    const contas = new Map<string, string>()
    for (const r of rowsCombo) contas.set(r.conta_codigo, r.conta_nome)

    for (const semestre of [13, 14] as const) {
      const meses = MESES_SEMESTRE[semestre]
      const rowsSemestre = rowsCombo.filter(r => meses.includes(r.mes))
      const somaReceita = rowsSemestre
        .filter(r => r.conta_codigo === CONTA_RECEITA)
        .reduce((acc, r) => acc + r.orcado, 0)

      for (const [conta_codigo, conta_nome] of contas.entries()) {
        const rowsConta = rowsSemestre.filter(r => r.conta_codigo === conta_codigo)
        if (rowsConta.length === 0) continue
        const somaOrcado = rowsConta.reduce((acc, r) => acc + r.orcado, 0)
        const av = somaReceita === 0 ? 0 : (somaOrcado / somaReceita) * 100
        resultado.push({ unidade, negocio, ano, mes: semestre, conta_codigo, conta_nome, orcado: somaOrcado, av, ah: 0 })
      }
    }
  }

  return resultado
}
