import { CODIGOS_PERFORMANCE, PACOTE_CONTA_ORCAMENTO, PACOTES } from '@/lib/constants'
import type { OrcamentoLinha } from '@/types'

/**
 * A planilha de orçamento guarda contas de custo com o mesmo sinal negativo
 * do GInfo (ex: Custo Operacional = -71,40% da receita) — igual
 * normalizarParaCalculo faz pro AVR do DRE, invertemos o sinal pra todo
 * pacote que não seja EBITDA/Geração de Caixa, pra bater com a convenção do
 * resto do Farol (custo sempre positivo, "quanto menor melhor").
 */
export function ajustarSinal(codigo: string, valor: number): number {
  return CODIGOS_PERFORMANCE.includes(codigo) ? valor : -valor
}

/**
 * Último ano cujo Orçamento foi montado com a estrutura ANTIGA do DRE (antes
 * do GInfo inserir "GASTOS COM SALÁRIOS" logo após a conta 034, deslocando
 * +1 tudo que já era ≥ 035 — cutover em 09/2026, valendo a partir dos DREs
 * de todas as unidades desde então). O Orçamento de 2026 não vai ser
 * refeito — só o de 2027 em diante já nasce com a numeração nova, batendo
 * direto com `PACOTES`/`PACOTE_CONTA_ORCAMENTO` sem tradução nenhuma.
 * Quando 2027 chegar, esse ano some do caminho de tradução abaixo sozinho.
 */
const ULTIMO_ANO_ORCAMENTO_ESTRUTURA_ANTIGA = 2026

/**
 * Traduz o código do pacote (numeração NOVA do DRE, pós-cutover) de volta
 * pro código antigo, só pra buscar no Orçamento de até
 * `ULTIMO_ANO_ORCAMENTO_ESTRUTURA_ANTIGA` — a planilha desses anos ainda usa
 * a estrutura anterior à inserção de "GASTOS COM SALÁRIOS". Regra: tudo
 * ≥ 035 (numeração nova) desloca -1 — o inverso exato do deslocamento
 * uniforme +1 confirmado na renumeração. Limitado à faixa real de contas do
 * DRE (035-283) de propósito — ids sintéticos como '900' (Gastos Totais,
 * combinação de duas contas, nunca existiu no plano de contas) não podem
 * cair aqui, ou '900' viraria '899' e some da busca em PACOTE_CONTA_ORCAMENTO.
 */
function paraCodigoPreCutover(codigoAtual: string): string {
  const n = Number(codigoAtual)
  if (!Number.isFinite(n) || n < 35 || n > 283) return codigoAtual
  return String(n - 1).padStart(3, '0')
}

/**
 * A partir do cutover, unidades novas (ex: Aracaju/Estância/Salvador/
 * Camaçari, 08/2026 em diante) chegam com o orçamento já montado direto na
 * numeração do DRE — as ~281 contas do plano batendo 1:1 por código E
 * descrição (conferido linha a linha contra o catálogo novo), sem o esquema
 * "próprio da planilha" que `PACOTE_CONTA_ORCAMENTO` usa (ex: EBITDA = '133'
 * na planilha bespoke das unidades antigas). As duas coisas convivem na
 * mesma tabela `orcamentos` — dá pra distinguir sem sinalizador novo nem
 * mexer no import: o esquema bespoke antigo nunca passa de ~155 contas, e
 * numeração nativa do DRE cobre até 283, então qualquer linha com código
 * ≥ 200 (mesmo negócio/ano/unidade) é prova de que esse orçamento específico
 * já é nativo — os dois nunca colidem no mesmo unidade/negócio/ano.
 */
export function usaNumeracaoDreNativa(orcamentos: OrcamentoLinha[], unidade: string, negocio: string, ano: number): boolean {
  return orcamentos.some(o =>
    o.unidade === unidade && o.negocio === negocio && o.ano === ano && Number(o.conta_codigo) >= 200,
  )
}

/**
 * Só a aba TT (consolidado) das mesmas unidades novas veio diferente — ela
 * NÃO é numeração nativa do DRE (RT/AR dessas unidades são; ver
 * `usaNumeracaoDreNativa`), ela é o mesmo esquema bespoke de sempre
 * (`PACOTE_CONTA_ORCAMENTO`), só que com uma conta nova inserida na PRÓPRIA
 * numeração do orçamento — mesmíssimo padrão do cutover do DRE, só que aqui
 * é "GASTOS COM SALÁRIOS" entrando na posição 022 (não na 035), deslocando
 * +1 tudo que já era ≥ 022 (confirmado linha a linha contra o catálogo bespoke
 * das unidades antigas, ~155 contas, zero exceção). Gambiarra temporária —
 * a expectativa é que o template padronize a partir de 2027, quando isso
 * deixa de ser necessário (ver ULTIMO_ANO_ORCAMENTO_ESTRUTURA_ANTIGA).
 *
 * Detecção sem sinalizador novo: o esquema bespoke antigo nunca passa de 155
 * contas, então qualquer linha com código > 155 nessa unidade/negócio/ano já
 * prova que esse orçamento específico está deslocado.
 */
export function usaOrcamentoTtDeslocado(orcamentos: OrcamentoLinha[], unidade: string, negocio: string, ano: number): boolean {
  return orcamentos.some(o =>
    o.unidade === unidade && o.negocio === negocio && o.ano === ano && Number(o.conta_codigo) > 155,
  )
}

/** Desloca +1 um código-alvo de PACOTE_CONTA_ORCAMENTO (esquema bespoke
 * antigo) pro equivalente na aba TT deslocada das unidades novas — inverso
 * de `paraCodigoPreCutover`, mas pro esquema bespoke, não pro DRE. */
export function paraCodigoTtDeslocado(codigo: string): string {
  const n = Number(codigo)
  if (!Number.isFinite(n) || n < 22 || n > 155) return codigo
  return String(n + 1).padStart(3, '0')
}

/**
 * Núcleo comum de `buscarMetaOrcamento`/`buscarOrcadoRs` — acha as linhas do
 * Orçamento certas pra esse pacote/unidade/negócio/ano/mês (resolvendo as
 * duas fontes de código possíveis, ver `usaNumeracaoDreNativa`) e soma o
 * campo pedido (`av` = %, `orcado` = R$ bruto da planilha), com o mesmo
 * ajuste de sinal nos dois casos (custo sempre positivo, igual o resto do
 * Farol — a planilha guarda os dois campos com o sinal negativo do GInfo
 * pra conta de custo).
 */
/**
 * `indiceApenas`, quando informado, restringe a busca a um ÚNICO código
 * dentro do pacote (posição `indiceApenas` de `PACOTES[codigo].prefixos`
 * nativo, ou da mesma posição em `PACOTE_CONTA_ORCAMENTO` bespoke — as duas
 * listas são montadas na MESMA ordem de propósito, ex: Salários = ['036',
 * '161'] nativo / ['022','080'] bespoke, sempre [operacional, administrativo]
 * nessa ordem) — usado quando o pacote soma duas contas (operacional +
 * administrativo) e o chamador quer só uma das duas, não a soma. Sem
 * `indiceApenas` (default), soma todas as contas do pacote, igual sempre foi.
 */
function buscarCampoOrcamento(
  orcamentos: OrcamentoLinha[],
  params: { unidade: string; negocio: string; ano: number; codigo: string; mes: number },
  campo: 'av' | 'orcado',
  indiceApenas?: number,
): number | null {
  if (usaNumeracaoDreNativa(orcamentos, params.unidade, params.negocio, params.ano)) {
    const prefixosDreBase = PACOTES[params.codigo]?.prefixos
    if (!prefixosDreBase) return null
    const prefixosDre = indiceApenas === undefined ? prefixosDreBase : prefixosDreBase[indiceApenas] !== undefined ? [prefixosDreBase[indiceApenas]] : []
    if (prefixosDre.length === 0) return null
    const linhasDre = orcamentos.filter(o =>
      o.unidade === params.unidade && o.negocio === params.negocio && o.ano === params.ano && o.mes === params.mes
      && prefixosDre.includes(o.conta_codigo),
    )
    if (linhasDre.length === 0) return null
    return ajustarSinal(params.codigo, linhasDre.reduce((acc, l) => acc + l[campo], 0))
  }

  const codigoParaBusca = params.ano <= ULTIMO_ANO_ORCAMENTO_ESTRUTURA_ANTIGA
    ? paraCodigoPreCutover(params.codigo)
    : params.codigo
  const codigosAlvoBase = PACOTE_CONTA_ORCAMENTO[codigoParaBusca]
  if (!codigosAlvoBase) return null
  const codigosAlvoCompletos = usaOrcamentoTtDeslocado(orcamentos, params.unidade, params.negocio, params.ano)
    ? codigosAlvoBase.map(paraCodigoTtDeslocado)
    : codigosAlvoBase
  const codigosAlvo = indiceApenas === undefined
    ? codigosAlvoCompletos
    : codigosAlvoCompletos[indiceApenas] !== undefined ? [codigosAlvoCompletos[indiceApenas]] : []
  if (codigosAlvo.length === 0) return null

  const linhas = orcamentos.filter(o =>
    o.unidade === params.unidade && o.negocio === params.negocio && o.ano === params.ano && o.mes === params.mes
    && codigosAlvo.includes(o.conta_codigo),
  )
  if (linhas.length === 0) return null
  return ajustarSinal(params.codigo, linhas.reduce((acc, l) => acc + l[campo], 0))
}

/**
 * Meta (%) direto do orçamento pra um pacote do Farol. `mes` é 0 pro anual
 * (bloco TOTAL da planilha), 1-12 pro mês, ou 13/14 pro 1º/2º semestre
 * (blocos recalculados — ver orcamento-semestre.ts, tela Administração >
 * Orçamento). Retorna null quando o pacote não tem mapeamento configurado ou
 * não há linha correspondente importada/calculada — nesses casos o chamador
 * deve manter a meta calculada normalmente (tabela `metas`/AVO do DRE).
 *
 * Duas fontes de código possíveis pra essa unidade/negócio/ano (ver
 * `usaNumeracaoDreNativa`):
 *  - Unidades novas (numeração nativa do DRE): soma direto pelos mesmos
 *    `prefixos` de `PACOTES[params.codigo]` — o código já bate 1:1.
 *  - Unidades antigas (esquema bespoke da planilha, `PACOTE_CONTA_ORCAMENTO`,
 *    chaveado pelos códigos ANTIGOS de propósito — ver comentário lá): pra
 *    ano ≤ ULTIMO_ANO_ORCAMENTO_ESTRUTURA_ANTIGA traduzimos `params.codigo`
 *    (sempre o id novo, pós-cutover) de volta antes de indexar.
 *
 * Só o percentual (`av`) importa aqui — pra uma meta em R$ que acompanhe o
 * mês REALIZADO (não o cenário de orçamento original), multiplique esse
 * percentual pela receita REALIZADA do período (ver o cálculo da tabela de
 * EBITDA no SDG Gerentes). Pra um orçamento em R$ "congelado" no cenário
 * original da planilha (não re-escalado pela receita realizada), use
 * `buscarOrcadoRs`.
 * `indiceApenas` — ver `buscarCampoOrcamento`: restringe a só uma das contas
 * do pacote (ex: só o código operacional, não o administrativo junto).
 */
export function buscarMetaOrcamento(
  orcamentos: OrcamentoLinha[],
  params: { unidade: string; negocio: string; ano: number; codigo: string; mes: number },
  indiceApenas?: number,
): number | null {
  return buscarCampoOrcamento(orcamentos, params, 'av', indiceApenas)
}

/**
 * Orçamento em R$ "bruto" da planilha pra um pacote do Farol — mesma busca
 * de `buscarMetaOrcamento` (dual-path unidade nova/antiga, mesmo ajuste de
 * sinal), só que soma `orcado` em vez de `av`. Esse valor reflete o cenário
 * de receita ORÇADA original (não a receita REALIZADA do período) — pra uma
 * meta em R$ que acompanhe o realizado, use `buscarMetaOrcamento` (o
 * percentual) multiplicado pela receita realizada em vez desta função.
 * `indiceApenas` — ver `buscarCampoOrcamento`: restringe a só uma das contas
 * do pacote (ex: só o código operacional de Salários, não o administrativo
 * junto) em vez de somar todas.
 */
export function buscarOrcadoRs(
  orcamentos: OrcamentoLinha[],
  params: { unidade: string; negocio: string; ano: number; codigo: string; mes: number },
  indiceApenas?: number,
): number | null {
  return buscarCampoOrcamento(orcamentos, params, 'orcado', indiceApenas)
}
