import type { DreCalculoRow, DreLongoRow, Meta, Natureza } from '@/types'
import { CODIGOS_PERFORMANCE, CONTA_RECEITA, CORES_FAROL } from '@/lib/constants'

function toList(prefixos: string | string[]): string[] {
  return typeof prefixos === 'string' ? [prefixos] : prefixos
}

function startsWithAny(codigo: string, prefixos: string[]): boolean {
  return prefixos.some(p => codigo.startsWith(p))
}

/**
 * Converte linhas brutas de vw_dre_longo (espelho fiel do Excel do GInfo,
 * incluindo o sinal negativo nativo de REMUNERADO/REALIZADO/AVR para contas
 * de custo) para o formato que o Farol de Metas espera, replicando
 * tratar_dataframe() de scripts/tratar_dre_pro.py: REAL e REMUN tornam-se
 * magnitude (abs), DIF mantém o sinal original, e AVR é invertido para
 * qualquer conta que não seja EBITDA/Geração de Caixa.
 */
export function normalizarParaCalculo(rows: DreLongoRow[]): DreCalculoRow[] {
  return rows.map(r => ({
    conta_codigo: r.conta_codigo,
    real: Math.abs(r.realizado ?? 0),
    remun: Math.abs(r.remunerado ?? 0),
    dif: r.diferenca ?? 0,
    avr: CODIGOS_PERFORMANCE.includes(r.conta_codigo) ? (r.avr ?? 0) : -(r.avr ?? 0),
    // avo vem do GInfo com o mesmo sinal bruto do avr (negativo p/ custo) — mesma inversão,
    // mas preserva null (sem dado) em vez de 0, pra distinguir "meta zero" de "sem AVO no período".
    avo: r.avo === null ? null : (CODIGOS_PERFORMANCE.includes(r.conta_codigo) ? r.avo : -r.avo),
  }))
}

function somaReal(rows: DreCalculoRow[], prefixos: string[]): number {
  return rows
    .filter(r => startsWithAny(r.conta_codigo, prefixos))
    .reduce((acc, r) => acc + r.real, 0)
}

/** Soma de REAL para contas que começam com "002" (Receita Líquida Operacional). */
export function calcularReceita(rows: DreCalculoRow[]): number {
  return somaReal(rows, [CONTA_RECEITA])
}

/**
 * AVR para um conjunto de linhas normalizadas, já filtrado pelo período
 * desejado (um mês específico, ou o acumulado do ano). Espelha
 * avr_por_prefix / avr_acumulado_por_prefix do Python: prefixo único = média
 * ponderada pelo REAL; múltiplos prefixos = soma do REAL dividida pela
 * receita (conta 002), em percentual.
 */
export function avrPorPrefixo(rows: DreCalculoRow[], prefixos: string | string[]): number {
  const lista = toList(prefixos)

  if (lista.length === 1) {
    const subset = rows.filter(r => r.conta_codigo.startsWith(lista[0]))
    const totalReal = subset.reduce((acc, r) => acc + r.real, 0)
    if (totalReal === 0) return 0
    const somaPonderada = subset.reduce((acc, r) => acc + r.avr * r.real, 0)
    return somaPonderada / totalReal
  }

  const receita = calcularReceita(rows)
  if (receita === 0) return 0
  const totalReal = somaReal(rows, lista)
  return (totalReal / receita) * 100
}

/** Impacto financeiro em R$. Custo: (meta-avr)/100*receita; Performance: (avr-meta)/100*receita. */
export function calcularImpactoFinanceiro(
  avr: number,
  meta: number | null,
  receita: number,
  natureza: Natureza,
): number {
  if (meta === null || receita === 0) return 0
  return natureza === 'custo' ? ((meta - avr) / 100) * receita : ((avr - meta) / 100) * receita
}

export interface Semaforo {
  corClasse: 'positivo' | 'negativo' | 'semCor'
  cor: string
  delta: number | null
}

/** Custo: delta = meta-avr (>=0 é bom); Performance: delta = avr-meta (>=0 é bom). Sem meta = cinza. */
export function calcularSemaforo(avr: number, meta: number | null, natureza: Natureza): Semaforo {
  if (meta === null) {
    return { corClasse: 'semCor', cor: CORES_FAROL.neutro, delta: null }
  }
  const delta = natureza === 'custo' ? meta - avr : avr - meta
  return delta >= 0
    ? { corClasse: 'positivo', cor: CORES_FAROL.positivo, delta }
    : { corClasse: 'negativo', cor: CORES_FAROL.negativo, delta }
}

/**
 * Lookup de meta, espelhando a regra do Python: em modo YTD usa sempre mes=0
 * (meta anual); em modo mensal usa mes=0 se ano<2026 (regime antigo, só
 * existia meta anual) ou o mês selecionado se ano>=2026.
 */
export function buscarMeta(
  metas: Meta[],
  params: { unidade: string; negocio: string; ano: number; codigo: string; isYtd: boolean; mes: number },
): number | null {
  const { unidade, negocio, ano, codigo, isYtd, mes } = params
  const mesBusca = isYtd ? 0 : ano < 2026 ? 0 : mes
  const row = metas.find(
    m => m.unidade === unidade && m.negocio === negocio && m.ano === ano && m.codigo === codigo && m.mes === mesBusca,
  )
  return row ? row.meta_avr : null
}

/**
 * Meta derivada do AVO (% orçado por conta, já exportado pelo GInfo), para um
 * pacote (1 ou mais prefixos de conta). Soma direta dos avo das contas do
 * pacote, já no período filtrado (mensal ou ACUMULADO_ANO). Retorna null
 * quando nenhuma conta do pacote tem avo no período (ex: arquivo importado
 * antes da coluna existir) — nesse caso o chamador deve cair para `buscarMeta`.
 */
export function metaPorPrefixoAvo(rows: DreCalculoRow[], prefixos: string | string[]): number | null {
  const lista = toList(prefixos)
  const subset = rows.filter(r => startsWithAny(r.conta_codigo, lista) && r.avo !== null)
  if (subset.length === 0) return null
  return subset.reduce((acc, r) => acc + (r.avo as number), 0)
}

/**
 * Meta do pacote: no modo Mensal, prioriza o AVO do próprio mês importado
 * (meta mensal real, vinda do GInfo), caindo para a tabela `metas` quando o
 * período não tem AVO. No modo YTD, usa sempre a meta cadastrada manualmente
 * (mes=0, "Anual") — o total_avo da view é só o orçado acumulado até o
 * último mês importado, não a meta fixa do ano inteiro, então não serve como
 * substituto da meta anual.
 */
export function buscarMetaComFallback(
  calcRows: DreCalculoRow[],
  metasManual: Meta[],
  params: { unidade: string; negocio: string; ano: number; codigo: string; isYtd: boolean; mes: number; prefixos: string | string[] },
): number | null {
  if (!params.isYtd) {
    const metaAvo = metaPorPrefixoAvo(calcRows, params.prefixos)
    if (metaAvo !== null) return metaAvo
  }
  return buscarMeta(metasManual, params)
}

export interface SeriePontoMensal {
  mes: number
  avr: number
  meta: number | null
}

/**
 * Série mensal (só os meses presentes no ano) de AVR realizado x meta, para
 * alimentar o gráfico de tendência de um indicador. A meta de cada ponto usa
 * sempre a regra do modo Mensal (AVO do próprio mês, com fallback pra tabela
 * manual) — nunca a do modo YTD, mesmo que o Farol esteja em modo YTD.
 */
export function calcularSerieAnual(
  rowsAno: DreLongoRow[],
  metasManual: Meta[],
  params: { unidade: string; negocio: string; ano: number; codigo: string; prefixos: string | string[] },
): SeriePontoMensal[] {
  const mensal = rowsAno.filter(r => r.tipo_periodo === 'MENSAL')
  const meses = Array.from(new Set(mensal.map(r => r.mes))).sort((a, b) => a - b)
  return meses.map(mes => {
    const calc = normalizarParaCalculo(mensal.filter(r => r.mes === mes))
    const avr = avrPorPrefixo(calc, params.prefixos)
    const meta = buscarMetaComFallback(calc, metasManual, { ...params, isYtd: false, mes })
    return { mes, avr, meta }
  })
}

export interface EstouroZeroResultado {
  real: number
  remun: number
  impacto: number
}

/** Estouro Zero: real não pode exceder remunerado. Impacto = soma de DIF (REALIZADO-REMUNERADO), sinal original. */
export function calcularEstouroZero(rows: DreCalculoRow[], prefixos: string[]): EstouroZeroResultado {
  const subset = rows.filter(r => startsWithAny(r.conta_codigo, prefixos))
  const real = subset.reduce((acc, r) => acc + r.real, 0)
  const remun = subset.reduce((acc, r) => acc + r.remun, 0)
  const impacto = subset.reduce((acc, r) => acc + r.dif, 0)
  return { real, remun, impacto }
}

export interface ReducaoCustosResultado {
  realAtual: number
  realAnterior: number
  variacaoPct: number
  metaValor: number
  status: 'meta_atingida' | 'reduziu_nao_bateu' | 'aumentou'
  corClasse: 'positivo' | 'atencao' | 'negativo'
}

/** Redução de Custos -15%: compara o REAL (magnitude) do período atual com o mesmo período do ano anterior. */
export function calcularReducaoCustos(rowsAtual: DreCalculoRow[], rowsAnterior: DreCalculoRow[], contas: string[]): ReducaoCustosResultado {
  const realAtual = somaReal(rowsAtual, contas)
  const realAnterior = somaReal(rowsAnterior, contas)
  const variacaoPct = realAnterior !== 0 ? ((realAtual - realAnterior) / realAnterior) * 100 : 0
  const metaValor = realAnterior * 0.85

  if (variacaoPct <= -15) {
    return { realAtual, realAnterior, variacaoPct, metaValor, status: 'meta_atingida', corClasse: 'positivo' }
  }
  if (variacaoPct <= 0) {
    return { realAtual, realAnterior, variacaoPct, metaValor, status: 'reduziu_nao_bateu', corClasse: 'atencao' }
  }
  return { realAtual, realAnterior, variacaoPct, metaValor, status: 'aumentou', corClasse: 'negativo' }
}
