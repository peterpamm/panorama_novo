import type { DreCalculoRow, DreLongoRow, Meta, Natureza, OrcamentoLinha } from '@/types'
import { CODIGOS_PERFORMANCE, CONTA_RECEITA, CORES_FAROL } from '@/lib/constants'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'

function toList(prefixos: string | string[]): string[] {
  return typeof prefixos === 'string' ? [prefixos] : prefixos
}

function startsWithAny(codigo: string, prefixos: string[]): boolean {
  return prefixos.some(p => codigo.startsWith(p))
}

/**
 * Último ano cujo DRE REALIZADO (`vw_dre_longo`/`dre_lancamentos`) ainda está
 * gravado com a numeração ANTIGA de contas — diferente do Orçamento
 * (`ULTIMO_ANO_ORCAMENTO_ESTRUTURA_ANTIGA` em orcamento-farol.ts, que vai até
 * 2026 inclusive): o realizado de 2026 já foi reimportado direto na
 * numeração nova (ver migration_110_dre_renumeracao_2026.sql), então só 2025
 * pra trás ficou com o esquema antigo no banco.
 */
const ULTIMO_ANO_DRE_REALIZADO_ESTRUTURA_ANTIGA = 2025

/**
 * Traduz um `conta_codigo` do DRE realizado pra numeração ATUAL (a que
 * `PACOTES`/`CODIGOS_PERFORMANCE`/todo o resto do Farol usa) — inverso de
 * `paraCodigoPreCutover` (orcamento-farol.ts, que faz NOVO→ANTIGO só pro
 * Orçamento). Pra linhas de até `ULTIMO_ANO_DRE_REALIZADO_ESTRUTURA_ANTIGA`,
 * todo código ANTIGO ≥ 035 desloca +1 (035 virou 036, ..., 282 virou 283 —
 * "GASTOS COM SALÁRIOS" entrou como a nova 035, empurrando o resto).
 * 001-034 nunca mudou, fica como veio. Sem essa tradução, qualquer pacote do
 * Farol com código ≥ 035 (EBITDA 233, Geração de Caixa 276, Despesa
 * Administrativa 158 etc.) lê a conta errada pra 2025 pra trás.
 */
function codigoDreNumeracaoAtual(codigo: string, ano: number): string {
  if (ano > ULTIMO_ANO_DRE_REALIZADO_ESTRUTURA_ANTIGA) return codigo
  const n = Number(codigo)
  if (!Number.isFinite(n) || n < 35 || n > 282) return codigo
  return String(n + 1).padStart(3, '0')
}

/**
 * Converte linhas brutas de vw_dre_longo (espelho fiel do Excel do GInfo,
 * incluindo o sinal negativo nativo de REMUNERADO/REALIZADO/AVR para contas
 * de custo) para o formato que o Farol de Metas espera, replicando
 * tratar_dataframe() de scripts/tratar_dre_pro.py: REAL e REMUN tornam-se
 * magnitude (abs), DIF mantém o sinal original, e AVR é invertido para
 * qualquer conta que não seja EBITDA/Geração de Caixa. `conta_codigo` já sai
 * traduzido pra numeração atual (`codigoDreNumeracaoAtual`) — inclusive
 * antes de checar `CODIGOS_PERFORMANCE`, senão o sinal do AVR de EBITDA/
 * Geração de Caixa também saía invertido pra 2025 pra trás (o código antigo
 * dessas contas não batia com a lista, que é sempre a numeração nova).
 */
export function normalizarParaCalculo(rows: DreLongoRow[]): DreCalculoRow[] {
  return rows.map(r => {
    const conta_codigo = codigoDreNumeracaoAtual(r.conta_codigo, r.ano)
    const ehPerformance = CODIGOS_PERFORMANCE.includes(conta_codigo)
    return {
      conta_codigo,
      real: Math.abs(r.realizado ?? 0),
      remun: Math.abs(r.remunerado ?? 0),
      dif: r.diferenca ?? 0,
      avr: ehPerformance ? (r.avr ?? 0) : -(r.avr ?? 0),
      // avo vem do GInfo com o mesmo sinal bruto do avr (negativo p/ custo) — mesma inversão,
      // mas preserva null (sem dado) em vez de 0, pra distinguir "meta zero" de "sem AVO no período".
      avo: r.avo === null ? null : (ehPerformance ? r.avo : -r.avo),
    }
  })
}

export function somaReal(rows: DreCalculoRow[], prefixos: string[]): number {
  return rows
    .filter(r => startsWithAny(r.conta_codigo, prefixos))
    .reduce((acc, r) => acc + r.real, 0)
}

/**
 * Soma do REALIZADO bruto (com sinal original do GInfo, sem abs) — usado só
 * onde o sinal importa de verdade (ex: Curva de Captura de contas de
 * performance, onde um mês de prejuízo tem que subtrair do acumulado em vez
 * de somar como `somaReal`/`normalizarParaCalculo` fariam). Opera em
 * `DreLongoRow` bruto porque `DreCalculoRow.real` já perdeu o sinal.
 */
function somaRealizadoComSinal(rows: DreLongoRow[], prefixos: string[]): number {
  return rows
    .filter(r => startsWithAny(codigoDreNumeracaoAtual(r.conta_codigo, r.ano), prefixos))
    .reduce((acc, r) => acc + (r.realizado ?? 0), 0)
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
  /**
   * Receita do mês, pra converter o ponto em impacto financeiro (R$) sob
   * demanda — ver `calcularImpactoFinanceiro`. Opcional porque séries que já
   * nascem em R$ em vez de % (ex: `calcularSerieReducaoCustos`) reaproveitam
   * esse mesmo tipo sem preencher esse campo — não faz sentido "converter pra
   * R$" o que já é R$.
   */
  receita?: number
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
    const receita = calcularReceita(calc)
    return { mes, avr, meta, receita }
  })
}

export interface SeriePontoCaptura {
  mes: number
  /** AVR do próprio mês (mesmo valor do gráfico de Acompanhamento mensal) — só nos meses já realizados. */
  avrRealizado: number | null
  /** Ritmo necessário pra fechar o ano na meta — só nos meses futuros (a curva é só projeção, não tem valor nos meses já realizados). */
  avrNecessario: number | null
  metaAnual: number | null
  /**
   * Meta % do PRÓPRIO mês (vinda do Orçamento mês a mês, mesma fonte que o
   * Acompanhamento Mensal usa) — só preenchida nos meses futuros, onde o
   * Acompanhamento Mensal não tem essa informação (só cobre meses já
   * realizados). Serve só pra estender a linha "Meta" até dezembro quando o
   * gráfico também mostra a Curva de Captura — quem usa prioriza a meta do
   * Acompanhamento Mensal quando ela existe, essa é só o complemento.
   */
  metaMensal?: number | null
  /**
   * Receita do mês, pra converter o ponto em R$ sob demanda — nos meses já
   * realizados é a receita REALIZADA (mesmo uso de antes: impacto financeiro
   * do Realizado contra a meta, ver `calcularImpactoFinanceiro`); nos meses
   * futuros é a receita ORÇADA daquele mês específico (não uma média — dá pra
   * converter o ritmo necessário num teto de gasto em R$ de verdade por mês).
   * `null` só quando o Orçamento não tem a receita daquele mês cadastrada.
   * Opcional porque séries que já nascem em R$ (ex:
   * `calcularSerieCapturaReducaoCustos`) reaproveitam esse mesmo tipo sem
   * preencher esse campo.
   */
  receita?: number | null
}

/** Receita Orçada (R$) de um mês específico — soma de `orcado` na conta CONTA_RECEITA, mesmo código em qualquer esquema (bespoke ou nativo, ver CONTAS_ORCAMENTO_USADAS). null quando o Orçamento não tem linha pra esse mês. */
function receitaOrcadaMes(
  orcamentos: OrcamentoLinha[],
  params: { unidade: string; negocio: string; ano: number; mes: number },
): number | null {
  const linhas = orcamentos.filter(o =>
    o.unidade === params.unidade && o.negocio === params.negocio && o.ano === params.ano && o.mes === params.mes
    && o.conta_codigo === CONTA_RECEITA,
  )
  if (linhas.length === 0) return null
  return linhas.reduce((acc, o) => acc + o.orcado, 0)
}

/**
 * "Curva de captura": nos meses já realizados, mostra o AVR do próprio mês
 * (mesmo cálculo e mesmo valor de calcularSerieAnual — não é uma média
 * acumulada, senão os dois gráficos mostrariam números diferentes pro mesmo
 * mês). Nos meses futuros, mostra o ritmo necessário pros meses restantes —
 * uma "reprevisão" (reforecast): mede o quanto já foi economizado ou
 * estourado até agora e redistribui isso proporcionalmente nos meses que
 * faltam, igual um índice de performance (tipo o CPI do EVM em gestão de
 * projetos — "Estimativa no Término = Orçamento ÷ CPI" — só que aplicado por
 * mês em vez de uma vez só no total):
 *   1. Massa de Meta do mês = Receita REALIZADA do mês × Meta % do mês (cada
 *      mês já realizado, Meta % vindo do Orçamento via buscarMetaOrcamento).
 *      Soma de todos os meses já realizados = Soma Massa Meta: "quanto a
 *      unidade DEVERIA ter gasto até agora, nas próprias metas de cada mês,
 *      em cima da receita que ela de fato faturou" — nunca usa receita
 *      ORÇADA pra essa parte, só a REALIZADA, pra não misturar escalas (ver
 *      nota abaixo).
 *   2. Meta Acumulada Ponderada = Soma Massa Meta ÷ Receita Realizada
 *      Acumulada (só dos meses já realizados) — serve só de fallback pro
 *      passo 4, quando algum mês futuro não tem meta % própria cadastrada.
 *   3. Economia Realizada = Soma Massa Meta − Despesa Já Realizada (dado do
 *      DRE, independe do Orçamento). Positivo = economizou (gastou menos do
 *      que a própria meta permitia, dada a receita real); negativo = estourou.
 *   4. Massa Orçada Futura = Σ (Receita ORÇADA de cada mês restante × Meta %
 *      PRÓPRIA daquele mês) — "quanto os meses que faltam gastariam se cada
 *      um batesse exatamente a própria meta, sem nenhum ajuste". Mês sem
 *      meta % própria cadastrada cai na Meta Acumulada Ponderada (passo 2).
 *   5. Massa Disponível = Economia Realizada + Massa Orçada Futura — a
 *      economia (ou estouro) do que já passou soma (ou desconta) em cima do
 *      que os meses futuros já tinham direito de gastar pelo plano normal.
 *   6. Fator de Correção = Massa Disponível ÷ Massa Orçada Futura — um
 *      índice de performance: >1 significa "sobrou espaço, dá pra gastar
 *      mais que o normal nos meses restantes"; <1 significa "aperta". Curva
 *      de Captura (ritmo necessário) de cada mês futuro = Meta % PRÓPRIA
 *      daquele mês (passo 4) × Fator de Correção — multiplicar pelo MESMO
 *      fator em todo mês preserva o FORMATO original (um mês já orçado mais
 *      pesado, ex: dezembro por 13º/bônus, continua proporcionalmente mais
 *      pesado), só escalando tudo pra cima ou pra baixo igual.
 * IMPORTANTE (motivo de ser "Economia Realizada + Massa Orçada Futura" em vez
 * de uma única "massa permitida do ano inteiro ÷ receita restante", como era
 * antes): o passo 1-3 mede o já-realizado contra a receita REAL (não a
 * orçada), e o passo 4 mede o futuro contra a receita ORÇADA (a real ainda
 * não existe) — cada pedaço na escala de receita que faz sentido pra ele.
 * Misturar os dois numa conta só (ex: aplicar a taxa média de Jan-Set em
 * cima da receita ORÇADA do ano inteiro) distorce o resultado toda vez que a
 * receita real foge muito da orçada — unidade que fatura mais que o
 * orçado deixa a conta antiga mais apertada do que deveria (e vice-versa).
 * Quando a receita real bate com a orçada, as duas contas dão o mesmo
 * resultado — não é uma mudança de comportamento pro caso "sem surpresa",
 * só uma correção pra quando a receita foge do orçado.
 * Mês sem Meta % no Orçamento (não importado pra esse mês/pacote) fica de
 * fora da Meta Acumulada Ponderada — não zera a média, só não entra nela.
 * Sem meta % em nenhum mês já realizado, ou sem receita orçada completa pros
 * meses que faltam, não há o que projetar (retorna só os meses já
 * realizados, sem avrNecessario). `metaAnualOverride`, quando informado
 * (mesmo null), substitui a busca em `metasManual` — mas só alimenta a linha
 * de referência "Meta Anual" do gráfico e a trava abaixo, não entra no
 * cálculo do ritmo necessário em si (que vem só do Orçamento/DRE, ver acima).
 *
 * Travado pela própria meta anual (`metaAnualOverride`/`metasManual`), por
 * mês: o Fator de Correção pode liberar um ritmo necessário PIOR que a meta
 * anual nos meses restantes (ex: meta 12,54% virar "pode gastar 13,66%" só
 * porque sobrou uma folga) — isso incentivaria a unidade a gastar mais só
 * porque economizou antes. Em vez de deixar passar, cada mês fica travado na
 * própria meta nesse caso (nunca pior que ela): conta de custo (menor % é
 * melhor) não deixa o ritmo passar ACIMA da meta; conta de performance
 * (maior % é melhor, ex: EBITDA) não deixa cair ABAIXO. Sem meta anual pra
 * comparar, o ritmo fica como calculado, sem travar.
 */
export function calcularSerieCaptura(
  rowsAno: DreLongoRow[],
  metasManual: Meta[],
  orcamentos: OrcamentoLinha[],
  params: { unidade: string; negocio: string; ano: number; codigo: string; prefixos: string | string[]; natureza: Natureza },
  metaAnualOverride?: number | null,
): SeriePontoCaptura[] {
  const mensal = rowsAno.filter(r => r.tipo_periodo === 'MENSAL')
  const mesesRealizados = Array.from(new Set(mensal.map(r => r.mes))).sort((a, b) => a - b)
  if (mesesRealizados.length === 0) return []

  const metaAnual = metaAnualOverride !== undefined ? metaAnualOverride : buscarMeta(metasManual, {
    unidade: params.unidade, negocio: params.negocio, ano: params.ano, codigo: params.codigo, isYtd: true, mes: 0,
  })

  const prefixosList = toList(params.prefixos)
  const porMes = new Map(mesesRealizados.map(mes => {
    const rowsMes = mensal.filter(r => r.mes === mes)
    const calc = normalizarParaCalculo(rowsMes)
    return [mes, {
      avr: avrPorPrefixo(calc, params.prefixos),
      receita: calcularReceita(calc),
      // Custo: `real` (magnitude) já representa "quanto foi gasto" — abs()
      // está correto (GInfo sempre reporta custo negativo). Performance (ex:
      // EBITDA): um mês de PREJUÍZO tem que SUBTRAIR do acumulado, não somar
      // como se fosse lucro — por isso usa o `realizado` bruto com sinal
      // (não passa por normalizarParaCalculo, que sempre tira o sinal via
      // abs em `real`), senão um mês negativo infla "massa já realizada" e
      // derruba artificialmente o ritmo necessário dos meses restantes.
      despesaRealizada: params.natureza === 'performance'
        ? somaRealizadoComSinal(rowsMes, prefixosList)
        : somaReal(calc, prefixosList),
    }] as const
  }))

  const ultimoMes = mesesRealizados[mesesRealizados.length - 1]
  const mesesRestantes = 12 - ultimoMes

  // Passos 1-2: massa de meta ponderada pela receita REALIZADA de cada mês já fechado.
  let somaMassaMeta = 0
  let somaReceitaPonderacao = 0
  for (const mes of mesesRealizados) {
    const receitaRealMes = porMes.get(mes)!.receita
    const metaMesPct = buscarMetaOrcamento(orcamentos, { unidade: params.unidade, negocio: params.negocio, ano: params.ano, codigo: params.codigo, mes })
    if (metaMesPct === null) continue
    somaMassaMeta += receitaRealMes * (metaMesPct / 100)
    somaReceitaPonderacao += receitaRealMes
  }
  // Já em percentual (não razão) — usada só como fallback no passo 4.
  const metaAcumuladaPonderada = somaReceitaPonderacao === 0 ? null : (somaMassaMeta / somaReceitaPonderacao) * 100

  // Passo 3: economia (ou estouro) já realizada, medida contra a receita REAL — nunca a orçada.
  const despesaJaRealizada = [...porMes.values()].reduce((acc, v) => acc + v.despesaRealizada, 0)
  const economiaRealizada = metaAcumuladaPonderada === null ? null : somaMassaMeta - despesaJaRealizada

  // Passo 4: meta % PRÓPRIA de cada mês futuro × receita ORÇADA daquele mês —
  // "quanto os meses que faltam gastariam no plano normal, sem ajuste nenhum".
  // Só fecha quando TODOS os meses restantes têm receita orçada cadastrada
  // (sem isso não dá pra saber o peso de cada mês no fator de correção).
  let metaMesFuturo: Map<number, number> | null = null
  let massaOrcadaFutura: number | null = null
  let receitaOrcadaFutura: number | null = null
  if (economiaRealizada !== null && metaAcumuladaPonderada !== null && mesesRestantes > 0) {
    const mapa = new Map<number, number>()
    let massa = 0
    let receita = 0
    let completo = true
    for (let mes = ultimoMes + 1; mes <= 12; mes++) {
      const receitaOrcMes = receitaOrcadaMes(orcamentos, { unidade: params.unidade, negocio: params.negocio, ano: params.ano, mes })
      if (receitaOrcMes === null) { completo = false; break }
      const metaMesPct = buscarMetaOrcamento(orcamentos, { unidade: params.unidade, negocio: params.negocio, ano: params.ano, codigo: params.codigo, mes })
      const pct = metaMesPct ?? metaAcumuladaPonderada
      mapa.set(mes, pct)
      massa += receitaOrcMes * (pct / 100)
      receita += receitaOrcMes
    }
    if (completo) {
      metaMesFuturo = mapa
      massaOrcadaFutura = massa
      receitaOrcadaFutura = receita
    }
  }

  // Passo 5-6: massa disponível (economia realizada + o que os meses futuros já
  // tinham direito) ÷ massa orçada futura = fator de correção — escala a meta
  // própria de cada mês futuro pra cima ou pra baixo, preservando o formato.
  const massaDisponivel = economiaRealizada === null || massaOrcadaFutura === null
    ? null
    : economiaRealizada + massaOrcadaFutura

  const ritmoNecessarioBruto = massaDisponivel === null || receitaOrcadaFutura === null || receitaOrcadaFutura === 0
    ? null
    : (massaDisponivel / receitaOrcadaFutura) * 100

  // Trava: nunca pior que a própria meta anual (ver comentário da função).
  const ritmoNecessario = ritmoNecessarioBruto === null || metaAnual === null
    ? ritmoNecessarioBruto
    : params.natureza === 'custo'
      ? Math.min(ritmoNecessarioBruto, metaAnual)
      : Math.max(ritmoNecessarioBruto, metaAnual)

  let ritmoPorMesFuturo: Map<number, number> | null = null
  if (ritmoNecessario !== null && massaDisponivel !== null && massaOrcadaFutura !== null && massaOrcadaFutura !== 0 && metaMesFuturo !== null) {
    const fatorCorrecao = massaDisponivel / massaOrcadaFutura
    ritmoPorMesFuturo = new Map(Array.from(metaMesFuturo.entries()).map(([mes, pct]) => {
      const valor = pct * fatorCorrecao
      // mesma trava de sempre (ver comentário da função), agora por mês.
      const travado = metaAnual === null ? valor : params.natureza === 'custo' ? Math.min(valor, metaAnual) : Math.max(valor, metaAnual)
      return [mes, travado]
    }))
  }

  // `avrNecessario` fica sempre null nos meses já realizados (mesmo no
  // último) — a curva é uma projeção pra FRENTE, começa só no 1º mês futuro.
  // Já teve um "ponto de conexão" aqui (repetia o avr do último mês
  // realizado pra linha não ter buraco visual), mas isso criava um ponto de
  // Necessário sobre um mês que já fechou — e em modo R$ (teto de gasto) o
  // número ali não tem o mesmo significado do Impacto Financeiro do
  // Realizado no mesmo mês, confundindo mais do que ajudava.
  const pontos: SeriePontoCaptura[] = mesesRealizados.map(mes => ({
    mes,
    avrRealizado: porMes.get(mes)!.avr,
    avrNecessario: null,
    metaAnual,
    receita: porMes.get(mes)!.receita,
  }))
  if (ritmoNecessario !== null) {
    for (let mes = ultimoMes + 1; mes <= 12; mes++) {
      const valor = ritmoPorMesFuturo?.get(mes) ?? ritmoNecessario
      // Receita ORÇADA do próprio mês (não a realizada, que ainda não existe
      // pra mês futuro) — permite converter o ritmo necessário em R$ (teto de
      // gasto do mês) com a receita de verdade daquele mês, não uma média.
      const receitaOrcMes = receitaOrcadaMes(orcamentos, { unidade: params.unidade, negocio: params.negocio, ano: params.ano, mes })
      pontos.push({ mes, avrRealizado: null, avrNecessario: valor, metaAnual, receita: receitaOrcMes, metaMensal: metaMesFuturo?.get(mes) ?? null })
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
 * Quantos meses do `ano` a unidade esteve ativa na LOG20 — usado pra dividir
 * uma meta anual (Meta de Perdas, Redução de Custos) só pelos meses em que
 * ela existia, em vez de sempre por 12 (ex: unidade que entrou em maio:
 * 12 − 5 + 1 = 8 meses). Sem `dataEntrada` (unidade antiga) ou unidade que
 * nem existia nesse ano (`mesEntradaNoAno` null — sem base pra estimar) cai
 * no padrão cheio de 12.
 */
export function mesesAtivosNoAno(dataEntrada: string | null, ano: number): number {
  const mesEntrada = mesEntradaNoAno(dataEntrada, ano)
  return mesEntrada === null ? 12 : 12 - mesEntrada + 1
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
