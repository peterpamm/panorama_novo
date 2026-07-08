import type { DreCalculoRow, DreLongoRow } from '@/types'
import { normalizarParaCalculo } from '@/lib/farol-calculations'

export interface SeriePontoConta {
  mes: number
  remunerado: number
  realizado: number
  gap: number
}

/**
 * Série mensal de uma única conta (espera `rowsMensal` já filtrado por
 * unidade/negócio/ano/conta_codigo/tipo_periodo=MENSAL). `gap` é sempre
 * REALIZADO − REMUNERADO (o campo `diferenca` da view, já com o sinal
 * correto — positivo é sempre bom, negativo sempre mau, tanto pra contas de
 * custo quanto de performance, sem precisar de lógica condicional por
 * natureza).
 */
export function calcularSerieMensalConta(rowsMensal: DreLongoRow[]): SeriePontoConta[] {
  const calc = normalizarParaCalculo(rowsMensal)
  const porMes = new Map<number, SeriePontoConta>()
  rowsMensal.forEach((row, i) => {
    const c = calc[i]
    const atual = porMes.get(row.mes) ?? { mes: row.mes, remunerado: 0, realizado: 0, gap: 0 }
    atual.remunerado += c.remun
    atual.realizado += c.real
    atual.gap += c.dif
    porMes.set(row.mes, atual)
  })
  return Array.from(porMes.values()).sort((a, b) => a.mes - b.mes)
}

export interface ResumoConta {
  remunerado: number
  realizado: number
  gap: number
  gapPercent: number
  variacaoRemun: number | null
  variacaoReal: number | null
}

/** Totais do ano (soma dos meses) + variação % vs. o mesmo período do ano anterior (null se não houver dado anterior). */
export function calcularResumoConta(rowsAtual: DreCalculoRow[], rowsAnoAnterior: DreCalculoRow[]): ResumoConta {
  const remunerado = rowsAtual.reduce((acc, r) => acc + r.remun, 0)
  const realizado = rowsAtual.reduce((acc, r) => acc + r.real, 0)
  const gap = rowsAtual.reduce((acc, r) => acc + r.dif, 0)
  const gapPercent = remunerado !== 0 ? (gap / remunerado) * 100 : 0

  const remuneradoAnterior = rowsAnoAnterior.reduce((acc, r) => acc + r.remun, 0)
  const realizadoAnterior = rowsAnoAnterior.reduce((acc, r) => acc + r.real, 0)

  const variacaoRemun = remuneradoAnterior !== 0 ? ((remunerado - remuneradoAnterior) / remuneradoAnterior) * 100 : null
  const variacaoReal = realizadoAnterior !== 0 ? ((realizado - realizadoAnterior) / realizadoAnterior) * 100 : null

  return { remunerado, realizado, gap, gapPercent, variacaoRemun, variacaoReal }
}

/** Verde se o gap (REAL−REMUN) for >= 0, vermelho se negativo — sinal já universal, sem branch de natureza. */
export function corClasseGap(gap: number): 'positivo' | 'negativo' {
  return gap >= 0 ? 'positivo' : 'negativo'
}

export interface AberturaContaResumo {
  codigo: string
  remunerado: number
  realizado: number
  gap: number
  avr: number | null
}

/**
 * Resumo por conta (REMUN/REAL/GAP somados, AVR médio) dentro de um pacote
 * DRE, pra um período já filtrado (1 mês ou o acumulado-do-ano). Réplica das
 * regras da aba "Abertura de Contas" do painel antigo (groupby CONTA, sum
 * REMUN/REAL/DIF, mean AVR).
 */
export function calcularAberturaResumo(rows: DreLongoRow[]): AberturaContaResumo[] {
  const porConta = new Map<string, DreLongoRow[]>()
  rows.forEach(r => {
    const arr = porConta.get(r.conta_codigo) ?? []
    arr.push(r)
    porConta.set(r.conta_codigo, arr)
  })
  return Array.from(porConta.entries()).map(([codigo, rs]) => {
    const calc = normalizarParaCalculo(rs)
    return {
      codigo,
      remunerado: calc.reduce((a, r) => a + r.remun, 0),
      realizado: calc.reduce((a, r) => a + r.real, 0),
      gap: calc.reduce((a, r) => a + r.dif, 0),
      avr: calc.length ? calc.reduce((a, r) => a + r.avr, 0) / calc.length : null,
    }
  })
}

export interface AberturaContaMensal {
  mes: number
  remunerado: number
  realizado: number
  gap: number
  avr: number | null
}

export interface AberturaContaDetalhe {
  codigo: string
  meses: AberturaContaMensal[]
  total: AberturaContaResumo
}

/**
 * Detalhamento mensal por conta dentro de um pacote DRE (espera `rowsMensal`
 * já filtrado por unidade/negócio/ano/pacote/tipo_periodo=MENSAL), só pra
 * contas com movimento no ano (remunerado ou realizado somado != 0) — mesmo
 * filtro "contas_com_movimento" do painel antigo.
 */
export function calcularAberturaDetalheMensal(rowsMensal: DreLongoRow[]): AberturaContaDetalhe[] {
  const porConta = new Map<string, DreLongoRow[]>()
  rowsMensal.forEach(r => {
    const arr = porConta.get(r.conta_codigo) ?? []
    arr.push(r)
    porConta.set(r.conta_codigo, arr)
  })

  const resultado: AberturaContaDetalhe[] = []
  for (const [codigo, rs] of porConta) {
    const calc = normalizarParaCalculo(rs)
    const totalRemun = calc.reduce((a, r) => a + r.remun, 0)
    const totalReal = calc.reduce((a, r) => a + r.real, 0)
    if (totalRemun === 0 && totalReal === 0) continue

    const porMes = new Map<number, AberturaContaMensal>()
    rs.forEach((row, i) => {
      const c = calc[i]
      porMes.set(row.mes, { mes: row.mes, remunerado: c.remun, realizado: c.real, gap: c.dif, avr: c.avr })
    })

    resultado.push({
      codigo,
      meses: Array.from(porMes.values()).sort((a, b) => a.mes - b.mes),
      total: {
        codigo,
        remunerado: totalRemun,
        realizado: totalReal,
        gap: calc.reduce((a, r) => a + r.dif, 0),
        avr: calc.length ? calc.reduce((a, r) => a + r.avr, 0) / calc.length : null,
      },
    })
  }
  return resultado.sort((a, b) => a.codigo.localeCompare(b.codigo))
}

export interface PontoComparativoAnual {
  mes: number
  remunA: number
  remunB: number
  gapRemun: number
  realA: number
  realB: number
  gapReal: number
}

function somarPorMes(rows: DreLongoRow[]): Map<number, { remun: number; real: number }> {
  const calc = normalizarParaCalculo(rows)
  const porMes = new Map<number, { remun: number; real: number }>()
  rows.forEach((row, i) => {
    const c = calc[i]
    const atual = porMes.get(row.mes) ?? { remun: 0, real: 0 }
    atual.remun += c.remun
    atual.real += c.real
    porMes.set(row.mes, atual)
  })
  return porMes
}

/**
 * Compara Remunerado/Realizado mês a mês entre 2 anos (espera `rowsAnoA`/
 * `rowsAnoB` já filtrados por unidade/negócio/conta/tipo_periodo=MENSAL).
 * `gapRemun`/`gapReal` = anoB − anoA, igual ao painel antigo (réplica da
 * aba "Ano vs Ano").
 */
export function calcularComparativoAnual(rowsAnoA: DreLongoRow[], rowsAnoB: DreLongoRow[]): PontoComparativoAnual[] {
  const porMesA = somarPorMes(rowsAnoA)
  const porMesB = somarPorMes(rowsAnoB)
  const meses = Array.from(new Set([...porMesA.keys(), ...porMesB.keys()])).sort((a, b) => a - b)

  return meses.map(mes => {
    const a = porMesA.get(mes) ?? { remun: 0, real: 0 }
    const b = porMesB.get(mes) ?? { remun: 0, real: 0 }
    return {
      mes,
      remunA: a.remun,
      remunB: b.remun,
      gapRemun: b.remun - a.remun,
      realA: a.real,
      realB: b.real,
      gapReal: b.real - a.real,
    }
  })
}

/**
 * Cor da coluna GAP REAL na aba Ano vs Ano: negativo (gastou menos que o ano
 * anterior) = verde, positivo = vermelho. Inverso de `corClasseGap` de
 * propósito — réplica do esquema de cores do painel antigo (`colorir_gap_real`
 * vs `colorir_gap_remun`), mantido por escolha explícita do usuário mesmo
 * sem diferenciar contas de performance.
 */
export function corClasseGapReal(gap: number): 'positivo' | 'negativo' {
  return gap <= 0 ? 'positivo' : 'negativo'
}
