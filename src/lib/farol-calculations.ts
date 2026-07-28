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

export function somaReal(rows: DreCalculoRow[], prefixos: string[]): number {
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
 * Meta semestral: mes=13 na tabela `metas` = 1º semestre, mes=14 = 2º.
 * A meta do S1 é gravada automaticamente na importação do DRE de junho
 * (snapshot do total_avo acumulado Jan–Jun, que o arquivo de julho
 * sobrescreveria). Fallback: meta anual (mes=0) — comparável porque ambas
 * são % da receita.
 */
export function buscarMetaSemestral(
  metas: Meta[],
  params: { unidade: string; negocio: string; ano: number; codigo: string; semestre: 1 | 2 },
): number | null {
  const { unidade, negocio, ano, codigo, semestre } = params
  const mesBusca = semestre === 1 ? 13 : 14
  const semestral = metas.find(
    m => m.unidade === unidade && m.negocio === negocio && m.ano === ano && m.codigo === codigo && m.mes === mesBusca,
  )
  if (semestral) return semestral.meta_avr
  const anual = metas.find(
    m => m.unidade === unidade && m.negocio === negocio && m.ano === ano && m.codigo === codigo && m.mes === 0,
  )
  return anual ? anual.meta_avr : null
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
 * Meta do pacote: no modo Mensal de anos >=2026 (regime novo, com meta por
 * mês), prioriza o AVO do próprio mês importado (meta mensal real, vinda do
 * GInfo), caindo para a tabela `metas` quando o período não tem AVO. Em anos
 * anteriores a 2026 não existia meta mensal — só a anual — então o AVO
 * daquele período (quando presente) é ignorado de propósito, e a busca usa
 * sempre a tabela `metas` (que por sua vez, via `buscarMeta`, já resolve pra
 * mes=0 nesse caso). No modo YTD, idem: sempre a meta cadastrada manualmente
 * (mes=0, "Anual") — o total_avo da view é só o orçado acumulado até o
 * último mês importado, não a meta fixa do ano inteiro, então não serve como
 * substituto da meta anual.
 */
export function buscarMetaComFallback(
  calcRows: DreCalculoRow[],
  metasManual: Meta[],
  params: { unidade: string; negocio: string; ano: number; codigo: string; isYtd: boolean; mes: number; prefixos: string | string[] },
): number | null {
  if (!params.isYtd && params.ano >= 2026) {
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

export interface SeriePontoCaptura {
  mes: number
  /** AVR do próprio mês (mesmo valor do gráfico de Acompanhamento mensal) — só nos meses já realizados. */
  avrRealizado: number | null
  /** Ritmo médio necessário nos meses restantes pra fechar o ano na meta — só nos meses futuros (mais o mês de transição, igual ao avrRealizado, pra a linha conectar sem buraco). */
  avrNecessario: number | null
  metaAnual: number | null
}

/**
 * "Curva de captura": nos meses já realizados, mostra o AVR do próprio mês
 * (mesmo cálculo e mesmo valor de calcularSerieAnual — não é uma média
 * acumulada, senão os dois gráficos mostrariam números diferentes pro mesmo
 * mês). Nos meses futuros, mostra o ritmo médio necessário pros meses
 * restantes pra fechar o ano exatamente na meta anual (cadastro manual,
 * mes=0):
 *   ritmo = (meta_anual × 12 − soma do AVR mês a mês já realizado) / meses restantes
 * Sem meta anual cadastrada, não há o que projetar — retorna só os meses
 * já realizados (sem avrNecessario). `metaAnualOverride`, quando informado
 * (mesmo null), substitui a busca em `metasManual` — usado pra priorizar a
 * meta do orçamento sem duplicar essa lógica de ritmo em outro lugar.
 */
export function calcularSerieCaptura(
  rowsAno: DreLongoRow[],
  metasManual: Meta[],
  params: { unidade: string; negocio: string; ano: number; codigo: string; prefixos: string | string[] },
  metaAnualOverride?: number | null,
): SeriePontoCaptura[] {
  const mensal = rowsAno.filter(r => r.tipo_periodo === 'MENSAL')
  const mesesRealizados = Array.from(new Set(mensal.map(r => r.mes))).sort((a, b) => a - b)
  if (mesesRealizados.length === 0) return []

  const metaAnual = metaAnualOverride !== undefined ? metaAnualOverride : buscarMeta(metasManual, {
    unidade: params.unidade, negocio: params.negocio, ano: params.ano, codigo: params.codigo, isYtd: true, mes: 0,
  })

  const avrPorMes = new Map(mesesRealizados.map(mes => {
    const calc = normalizarParaCalculo(mensal.filter(r => r.mes === mes))
    return [mes, avrPorPrefixo(calc, params.prefixos)] as const
  }))

  const ultimoMes = mesesRealizados[mesesRealizados.length - 1]
  const mesesRestantes = 12 - ultimoMes
  const somaAvrMensal = [...avrPorMes.values()].reduce((acc, v) => acc + v, 0)
  const ritmoNecessario = metaAnual === null || mesesRestantes <= 0
    ? null
    : (metaAnual * 12 - somaAvrMensal) / mesesRestantes

  const pontos: SeriePontoCaptura[] = mesesRealizados.map(mes => ({
    mes,
    avrRealizado: avrPorMes.get(mes)!,
    // ponto de conexão com a linha do necessário, só quando existe projeção futura
    avrNecessario: mes === ultimoMes && ritmoNecessario !== null ? avrPorMes.get(mes)! : null,
    metaAnual,
  }))
  if (ritmoNecessario !== null) {
    for (let mes = ultimoMes + 1; mes <= 12; mes++) {
      pontos.push({ mes, avrRealizado: null, avrNecessario: ritmoNecessario, metaAnual })
    }
  }
  return pontos
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

/** Redução de Custos -15%: compara o REAL (magnitude) do período atual com o do ano anterior (já ajustado pra `data_entrada`, ver somaRealAnoAnteriorComMedia). */
export function calcularReducaoCustos(realAtual: number, realAnterior: number): ReducaoCustosResultado {
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

/** Mês (1-12) em que a unidade já estava operando, dentro do `ano` informado — `null` se a unidade nem existia nesse ano (sem base pra estimar nada). */
export function mesEntradaNoAno(dataEntrada: string | null, ano: number): number | null {
  if (!dataEntrada) return 1
  const [anoEntradaStr, mesEntradaStr] = dataEntrada.split('-')
  const anoEntrada = Number(anoEntradaStr)
  if (anoEntrada > ano) return null
  if (anoEntrada < ano) return 1
  return Number(mesEntradaStr)
}

/**
 * Soma do REAL no `ano` informado pra um conjunto de `meses`, ajustando pra
 * `dataEntrada` da unidade: meses anteriores à entrada (unidade ainda não
 * existia) usam a média mensal do período em que ela já operava nesse mesmo
 * ano, em vez de ficarem sem comparação ou contarem como zero — caso de
 * unidade que começou a operar no meio do ano anterior (ex: Petrópolis em
 * jul/2025). Meses a partir da entrada usam o REAL de verdade, mesmo que
 * seja zero (a comparação com `dataEntrada`, não com a presença de linha,
 * é o que distingue "gasto real zero" de "ainda não operava") — e se algum
 * mês dentro do período operacional não tiver linha por outro motivo
 * (ex: import faltando), conta como 0, igual a uma soma direta normal, sem
 * cair na média (a média só serve pra cobrir o período anterior à entrada).
 * Sem `dataEntrada`, o comportamento é idêntico a uma soma direta de sempre.
 * Retorna `null` quando a unidade nem existia no `ano` informado.
 *
 * Quando `meses` é um intervalo contínuo a partir de 1 (YTD ou ano completo) e
 * a unidade já operava desde o início do `ano`, prefere o bloco ACUMULADO_ANO
 * oficial no último mês do intervalo (quando existir) em vez de somar os
 * meses individuais — evita divergir do total oficial do GInfo em anos já
 * encerrados, que às vezes só trazem o acumulado fechado (ex: só dezembro),
 * sem um snapshot mês a mês como o ano em andamento tem.
 */
export function somaRealAnoAnteriorComMedia(
  rowsNegocio: DreLongoRow[],
  dataEntrada: string | null,
  ano: number,
  contas: string[],
  meses: number[],
): number | null {
  const mesEntrada = mesEntradaNoAno(dataEntrada, ano)
  if (mesEntrada === null) return null

  const mesesOrdenados = [...meses].sort((a, b) => a - b)
  const ehIntervaloDesdeInicio = mesEntrada === 1 && mesesOrdenados[0] === 1 && mesesOrdenados.every((m, i) => m === i + 1)
  if (ehIntervaloDesdeInicio) {
    const ultimoMes = mesesOrdenados[mesesOrdenados.length - 1]
    const linhaAcumulado = rowsNegocio.filter(r =>
      r.tipo_periodo === 'ACUMULADO_ANO' && r.ano === ano && r.mes === ultimoMes && contas.some(c => r.conta_codigo.startsWith(c)),
    )
    if (linhaAcumulado.length > 0) return somaReal(normalizarParaCalculo(linhaAcumulado), contas)
  }

  const linhasOperacionais = rowsNegocio.filter(r =>
    r.tipo_periodo === 'MENSAL' && r.ano === ano && r.mes >= mesEntrada && contas.some(c => r.conta_codigo.startsWith(c)),
  )
  const mesesComDado = Array.from(new Set(linhasOperacionais.map(r => r.mes)))
  if (mesesComDado.length === 0) return null

  const mediaMensal = somaReal(normalizarParaCalculo(linhasOperacionais), contas) / mesesComDado.length

  return meses.reduce((acc, mes) => {
    if (mes < mesEntrada) return acc + mediaMensal
    const linhasMes = linhasOperacionais.filter(r => r.mes === mes)
    return acc + (linhasMes.length > 0 ? somaReal(normalizarParaCalculo(linhasMes), contas) : 0)
  }, 0)
}

/** Unidade com histórico parcial (tem `dataEntrada`) cujo incremento estimado deve ser somado ao histórico de outra unidade — caso da AMBEV (consolidado), que precisa incluir a estimativa de cada unidade que entrou no meio do ano. */
export interface UnidadeIncremento {
  dataEntrada: string | null
  /** Linhas de vw_dre_longo já filtradas pra essa unidade + negócio. */
  rows: DreLongoRow[]
}

/**
 * Soma, pra cada unidade em `unidades`, a diferença entre o valor ajustado
 * por `dataEntrada` (média pro período pré-entrada) e o valor bruto (sem
 * ajuste) — ou seja, só o "extra" que a estimativa adiciona. Usado pra
 * incrementar o histórico de uma unidade consolidadora (AMBEV) com a
 * estimativa de cada unidade parcial que a compõe.
 */
export function calcularIncrementoUnidadesNovas(unidades: UnidadeIncremento[], ano: number, contas: string[], meses: number[]): number {
  return unidades.reduce((acc, u) => {
    const ajustado = somaRealAnoAnteriorComMedia(u.rows, u.dataEntrada, ano, contas, meses) ?? 0
    const bruto = somaRealAnoAnteriorComMedia(u.rows, null, ano, contas, meses) ?? 0
    return acc + (ajustado - bruto)
  }, 0)
}

/**
 * Acompanhamento mensal pra um card de Redução de Custos (-15% vs ano
 * anterior): em cada mês, o REALIZADO (R$) do ano atual contra a meta do
 * mesmo mês no ano anterior já com -15% aplicado. Reaproveita o tipo
 * SeriePontoMensal (campo `avr` aqui carrega o realizado, não um AVR
 * percentual) pra poder reaproveitar o mesmo gráfico IndicadorChart.
 * `unidadesIncremento` soma a estimativa de unidades parciais (ver
 * calcularIncrementoUnidadesNovas) — só usado quando a unidade selecionada é
 * uma consolidadora (AMBEV); vazio não muda o comportamento.
 */
export function calcularSerieReducaoCustos(
  rowsNegocio: DreLongoRow[],
  dataEntrada: string | null,
  ano: number,
  contas: string[],
  unidadesIncremento: UnidadeIncremento[] = [],
): SeriePontoMensal[] {
  const mensalAtual = rowsNegocio.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === ano)
  const meses = Array.from(new Set(mensalAtual.map(r => r.mes))).sort((a, b) => a - b)

  return meses.map(mes => {
    const realizadoAtual = somaReal(normalizarParaCalculo(mensalAtual.filter(r => r.mes === mes)), contas)
    const realizadoAnterior = somaRealAnoAnteriorComMedia(rowsNegocio, dataEntrada, ano - 1, contas, [mes])
    const incremento = calcularIncrementoUnidadesNovas(unidadesIncremento, ano - 1, contas, [mes])
    const meta = realizadoAnterior === null ? null : (realizadoAnterior + incremento) * 0.85
    return { mes, avr: realizadoAtual, meta }
  })
}

const TODOS_MESES = Array.from({ length: 12 }, (_, i) => i + 1)

/**
 * Curva de captura pra um card de Redução de Custos: meta anual = REALIZADO
 * total do ano anterior já com -15% aplicado (ajustado pra `data_entrada` e
 * pro incremento de unidades parciais, ver somaRealAnoAnteriorComMedia e
 * calcularIncrementoUnidadesNovas); ritmo necessário pros meses restantes
 * pra fechar o ano dentro dessa meta. O campo `metaAnual` de cada ponto
 * retornado carrega a MÉDIA MENSAL desse total (`/12`), não o total cheio —
 * fica na mesma escala das outras duas linhas do gráfico (realizado e
 * necessário, ambas por mês); o `ritmoNecessario` interno continua usando o
 * valor anual de verdade, sem dividir por 12.
 */
export function calcularSerieCapturaReducaoCustos(
  rowsNegocio: DreLongoRow[],
  dataEntrada: string | null,
  ano: number,
  contas: string[],
  unidadesIncremento: UnidadeIncremento[] = [],
): SeriePontoCaptura[] {
  const mensalAtual = rowsNegocio.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === ano)
  const mesesRealizados = Array.from(new Set(mensalAtual.map(r => r.mes))).sort((a, b) => a - b)
  if (mesesRealizados.length === 0) return []

  const totalAnteriorAjustado = somaRealAnoAnteriorComMedia(rowsNegocio, dataEntrada, ano - 1, contas, TODOS_MESES)
  const incrementoAnual = calcularIncrementoUnidadesNovas(unidadesIncremento, ano - 1, contas, TODOS_MESES)
  const metaAnual = totalAnteriorAjustado === null ? null : (totalAnteriorAjustado + incrementoAnual) * 0.85
  const metaMensalRef = metaAnual === null ? null : metaAnual / 12

  const realizadoPorMes = new Map(mesesRealizados.map(mes => {
    const calc = normalizarParaCalculo(mensalAtual.filter(r => r.mes === mes))
    return [mes, somaReal(calc, contas)] as const
  }))

  const ultimoMes = mesesRealizados[mesesRealizados.length - 1]
  const mesesRestantes = 12 - ultimoMes
  const somaRealizado = [...realizadoPorMes.values()].reduce((acc, v) => acc + v, 0)
  const ritmoNecessario = metaAnual === null || mesesRestantes <= 0
    ? null
    : (metaAnual - somaRealizado) / mesesRestantes

  const pontos: SeriePontoCaptura[] = mesesRealizados.map(mes => ({
    mes,
    avrRealizado: realizadoPorMes.get(mes)!,
    avrNecessario: mes === ultimoMes && ritmoNecessario !== null ? realizadoPorMes.get(mes)! : null,
    metaAnual: metaMensalRef,
  }))
  if (ritmoNecessario !== null) {
    for (let mes = ultimoMes + 1; mes <= 12; mes++) {
      pontos.push({ mes, avrRealizado: null, avrNecessario: ritmoNecessario, metaAnual: metaMensalRef })
    }
  }
  return pontos
}

export interface PontoEvolucaoReducao {
  mes: number
  resultado: ReducaoCustosResultado
}

export interface LinhaEvolucaoReducao {
  /** Um ponto por mês já realizado no ano (não inclui meses futuros). */
  meses: PontoEvolucaoReducao[]
  /** Acumulado do ano até o último mês realizado dessa própria unidade — null se não há nenhum mês realizado. */
  anual: ReducaoCustosResultado | null
}

/**
 * Evolução mês a mês de Redução de Custos pra uma unidade (linha da tabela
 * "Evolução por unidade"): em cada mês já realizado, compara o REAL do ano
 * atual com -15% do REAL do mesmo mês no ano anterior (ajustado por
 * `dataEntrada` e, quando informado, pelo incremento de unidades parciais —
 * usado só pra montar a linha totalizadora da AMBEV). `anual` é o mesmo
 * cálculo acumulado até o último mês realizado.
 */
export function calcularEvolucaoReducaoCustos(
  rowsUnidade: DreLongoRow[],
  dataEntrada: string | null,
  ano: number,
  contas: string[],
  unidadesIncremento: UnidadeIncremento[] = [],
): LinhaEvolucaoReducao {
  const mensalAtual = rowsUnidade.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === ano)
  const mesesRealizados = Array.from(new Set(mensalAtual.map(r => r.mes))).sort((a, b) => a - b)

  const meses: PontoEvolucaoReducao[] = mesesRealizados.map(mes => {
    const realAtual = somaReal(normalizarParaCalculo(mensalAtual.filter(r => r.mes === mes)), contas)
    const incremento = calcularIncrementoUnidadesNovas(unidadesIncremento, ano - 1, contas, [mes])
    const realAnterior = (somaRealAnoAnteriorComMedia(rowsUnidade, dataEntrada, ano - 1, contas, [mes]) ?? 0) + incremento
    return { mes, resultado: calcularReducaoCustos(realAtual, realAnterior) }
  })

  if (mesesRealizados.length === 0) return { meses, anual: null }

  const ultimoMes = mesesRealizados[mesesRealizados.length - 1]
  const mesesAno = Array.from({ length: ultimoMes }, (_, i) => i + 1)
  const realAtualAno = somaRealAnoAnteriorComMedia(rowsUnidade, null, ano, contas, mesesAno) ?? 0
  const incrementoAno = calcularIncrementoUnidadesNovas(unidadesIncremento, ano - 1, contas, mesesAno)
  const realAnteriorAno = (somaRealAnoAnteriorComMedia(rowsUnidade, dataEntrada, ano - 1, contas, mesesAno) ?? 0) + incrementoAno

  return { meses, anual: calcularReducaoCustos(realAtualAno, realAnteriorAno) }
}
