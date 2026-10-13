import type { DreLongoRow, OrcamentoLinha, Unidade } from '@/types'
import { calcularReceita, normalizarParaCalculo, somaReal } from './farol-calculations'
import { buscarMetaOrcamento } from './orcamento-farol'
import { somaDif } from './painel-perdas-calculations'
import { PACOTES } from './constants'
import { somaRemunerado } from '@/pages/sdg/abertura-conta-shared'

/**
 * Os 7 "pacotes" que a aba Unidade (Análise Detalhada > Pacote de Gente) já
 * mostra, na mesma ordem — usados pelo comparativo Corporativo (uma linha por
 * unidade, por seção).
 */
export type ChavePacoteGente = '159' | '036' | '056' | '074' | '069' | '038' | 'vales'

export const PACOTES_GENTE_CORPORATIVO: { chave: ChavePacoteGente; nome: string }[] = [
  { chave: '159', nome: 'Pacote de Gente' },
  { chave: '036', nome: 'Salários' },
  { chave: '056', nome: 'Gastos com Benefícios' },
  { chave: '074', nome: 'Segurança' },
  { chave: '038', nome: 'Encargos' },
  { chave: 'vales', nome: 'Gastos com Vales' },
  { chave: '069', nome: 'Gastos Contratação/Demissão' },
]

/**
 * Quais pacotes somam operacional+administrativo (prefixos = [op, adm]) — só
 * esses têm sentido pro toggle Consolidado/Operacional/ADM. Vales é uma lista
 * de contas só, sem essa divisão. Segurança (074) TAMBÉM teria um par ADM de
 * verdade (188, confirmado em `CONTAS_TOTALIZADORAS_ADM`), mas por pedido
 * explícito do usuário `PACOTES['074']` continua só com 074 por ora — fica de
 * fora daqui até essa correção (mais ampla, afeta Farol de Metas/SDG
 * Gerentes/Ranking também, não só o Corporativo) ser feita separadamente.
 */
export const PACOTES_COM_SEGMENTO: ChavePacoteGente[] = ['159', '036', '056', '069', '038']

/**
 * Encargos — 038 (ENCARGOS, operacional) e 163 (ENCARGOS ADM, administrativo)
 * são contas-mãe totalizadoras (`CONTAS_TOTALIZADORAS_ADM` em `constants.ts`
 * já lista 163 como tal, mesmo grupo de 159/172/184/191 — cada totalizadora
 * já carrega no GInfo a soma das próprias subcontas, exatamente como qualquer
 * outro pacote em `PACOTES` soma pelo código-mãe, não pelas folhas). Somar só
 * 038 e 163 direto (em vez de expandir pelas subcontas 039-050/164-171) é o
 * mesmo padrão de Segurança (`074`)/Pacote de Gente (`159`)/etc — e, ao
 * contrário do que a aba Unidade fazia até aqui (só 039-050, nunca incluiu o
 * bloco ADM 163-171), finalmente cobre o custo administrativo de Encargos
 * também.
 */
const CODIGOS_ENCARGOS = ['038', '163']
/** Mesmos códigos de `CONTAS_VALES` em `PacoteDeGenteDetalhado.tsx` — fonte da Dispersão (ver `somaDif` abaixo), sem mudança: a Dispersão continua sendo só dos dois itens que o Painel de Perdas acompanha, não da conta-mãe inteira. */
const CONTAS_VALES = ['052', '053']
/** 051 (GASTOS COM VALES) é a conta-mãe totalizadora de 052-055 (Vales Financeiros/Físicos/Processo Cível/Sinistro) — mesmo raciocínio de `CODIGOS_ENCARGOS`: soma só a mãe pro Remunerado × Realizado, igual qualquer outro pacote em `PACOTES`. */
const CODIGO_GASTOS_COM_VALES = ['051']

/** Base de comparação que a tabela/toggle usa: Orçado (planilha de Orçamento) ou Remunerado (referência do GInfo, sempre disponível mesmo sem Orçamento cadastrado). */
export type TipoBase = 'orcado' | 'remunerado'

/** Receita REALIZADA (conta 002) de uma unidade, só do mês `mes` (não acumulada) — base pra reescalar o % orçado em R$, ver `orcadoAcumulado`. */
function receitaRealizadaMensal(rowsCons: DreLongoRow[], unidade: string, ano: number, mes: number): number | null {
  const rowsMes = rowsCons.filter(r => r.unidade === unidade && r.ano === ano && r.mes === mes && r.tipo_periodo === 'MENSAL')
  if (rowsMes.length === 0) return null
  return calcularReceita(normalizarParaCalculo(rowsMes))
}

/**
 * Orçado em R$ acumulado de Jan até `mes` pra um pacote/unidade — mês a mês,
 * pega o % orçado (`buscarMetaOrcamento`) e multiplica pela receita
 * REALIZADA daquele mês especificamente (não a receita ORÇADA do cenário
 * original da planilha). Mesma convenção que o Farol de Metas > Pacote de
 * Gente já usa pro card "Meta R$" (`BlocoPacote`, `abertura-conta-shared.tsx`
 * — ver o comentário lá: "Meta em R$ NÃO é o `orcado` bruto da planilha...
 * é o % meta multiplicado pela receita REALIZADA do próprio mês") — `buscarOrcadoRs`
 * (o R$ "congelado" direto da planilha) ficaria preso ao cenário de receita
 * orçada original, divergindo desse padrão. Mesma regra de "acumulado fica
 * null quando falta o mês mais recente" de sempre: meses anteriores sem dado
 * só não entram na soma, mas se o PRÓPRIO mês `mes` não tem % orçado ou
 * receita realizada, o acumulado inteiro vira null.
 */
function orcadoAcumulado(
  rowsCons: DreLongoRow[],
  orcamentosCons: OrcamentoLinha[],
  params: { unidade: string; ano: number; codigo: string },
  mes: number,
  indiceSegmento?: number,
): number | null {
  let soma = 0
  let ultimoMesNull = false
  for (let m = 1; m <= mes; m++) {
    const metaPercent = buscarMetaOrcamento(orcamentosCons, { ...params, negocio: 'CONS', mes: m }, indiceSegmento)
    const receitaMes = receitaRealizadaMensal(rowsCons, params.unidade, params.ano, m)
    const v = metaPercent !== null && receitaMes !== null ? (metaPercent / 100) * receitaMes : null
    if (v !== null) soma += v
    ultimoMesNull = m === mes && v === null
  }
  return ultimoMesNull ? null : soma
}

/** Orçado × Remunerado × Realizado × Receita (orçada/realizada) de UMA unidade, pro pacote `chave` — núcleo do comparativo, antes de montar a linha final. `indiceSegmento` (0=operacional, 1=adm, undefined=consolidado) só vale pros pacotes em `PACOTES_COM_SEGMENTO`. */
function calcularParaUnidade(
  chave: ChavePacoteGente,
  codigoUnidade: string,
  rowsCons: DreLongoRow[],
  orcamentosCons: OrcamentoLinha[],
  ano: number,
  mes: number,
  indiceSegmento?: number,
): { orcado: number | null; remunerado: number; realizado: number; dispersao: number | null; receitaRealizada: number } {
  const rowsUnidadeAno = rowsCons.filter(r => r.unidade === codigoUnidade && r.ano === ano)
  const rowsAcumulado = rowsUnidadeAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes <= mes)
  const calc = normalizarParaCalculo(rowsAcumulado)
  const receitaRealizada = calcularReceita(calc)

  // Vales: não é um par base×realizado — a "Dispersão" (campo `diferenca`
  // bruto, mesma fonte do Painel de Perdas) já É o desvio, sem base nenhuma.
  // `remunerado`/`realizado` somam a conta-mãe 051 (ver `CODIGO_GASTOS_COM_VALES`),
  // mas a Dispersão é a fonte de verdade pra essa seção, não `remunerado-realizado`
  // (as duas divergem — mesmo motivo que fez a gente trocar pra `somaDif` no
  // Pacote de Gente do SDG Gerentes) — por isso ela continua restrita a 052/053.
  if (chave === 'vales') {
    const realizado = somaReal(calc, CODIGO_GASTOS_COM_VALES)
    const remunerado = somaRemunerado(calc, CODIGO_GASTOS_COM_VALES)
    const dispersao = somaDif(rowsAcumulado, CONTAS_VALES)
    return { orcado: null, remunerado, realizado, dispersao, receitaRealizada }
  }

  // Encargos: nunca teve Orçamento cadastrado — só Remunerado × Realizado.
  // `indiceSegmento` aqui escolhe entre 038 (operacional) e 163 (adm), mesma
  // mecânica do bloco geral logo abaixo — só não reaproveita `PACOTES[chave]`
  // porque Encargos não tem entrada lá (nunca teve Orçamento).
  if (chave === '038') {
    const prefixos = indiceSegmento === undefined ? CODIGOS_ENCARGOS : [CODIGOS_ENCARGOS[indiceSegmento]]
    const realizado = somaReal(calc, prefixos)
    const remunerado = somaRemunerado(calc, prefixos)
    return { orcado: null, remunerado, realizado, dispersao: null, receitaRealizada }
  }

  // 159/036/056/074/069: Orçado × Remunerado × Realizado, igual BlocoGapOrcamentoMensal/BlocoPacote já fazem pra uma unidade só.
  const prefixosBase = PACOTES[chave].prefixos
  const prefixos = indiceSegmento === undefined ? prefixosBase : [prefixosBase[indiceSegmento]]
  const realizado = somaReal(calc, prefixos)
  const remunerado = somaRemunerado(calc, prefixos)
  const orcado = orcadoAcumulado(rowsCons, orcamentosCons, { unidade: codigoUnidade, ano, codigo: chave }, mes, indiceSegmento)
  return { orcado, remunerado, realizado, dispersao: null, receitaRealizada }
}

export interface LinhaComparativoUnidade {
  unidade: string
  nomeUnidade: string
  /** Orçado acumulado até o mês — null sem Orçamento cadastrado pra esse pacote (Encargos/Vales) ou faltando o código bespoke (ex: Gastos Contratação/Demissão nas unidades antigas). */
  orcado: number | null
  /** Remunerado (referência do GInfo) — sempre disponível, mesmo sem Orçamento. */
  remunerado: number
  realizado: number
  /** Só não-null pra Vales — campo `diferenca` bruto, a fonte de verdade da Dispersão (não é `remunerado-realizado`, as duas divergem). */
  dispersao: number | null
  receitaRealizada: number
}

/**
 * Uma linha por unidade (sem AMBEV — `unidades` já vem filtrada pelo
 * chamador), pro pacote `chave`, acumulado de Jan até `mes`. `rowsCons`/
 * `orcamentosCons` já devem vir filtrados por `negocio === 'CONS'` (Corporativo
 * é sempre consolidado) — só o `ano` é filtrado aqui dentro por unidade.
 * Unidade sem nenhum dado no período entra com `realizado: 0`, `orcado`/
 * `dispersao`: null — nunca some da lista. `indiceSegmento` — ver
 * `calcularParaUnidade`.
 */
export function calcularComparativoPorUnidade(
  chave: ChavePacoteGente,
  rowsCons: DreLongoRow[],
  orcamentosCons: OrcamentoLinha[],
  unidades: Unidade[],
  ano: number,
  mes: number,
  indiceSegmento?: number,
): LinhaComparativoUnidade[] {
  return unidades.map(u => {
    const dados = calcularParaUnidade(chave, u.codigo, rowsCons, orcamentosCons, ano, mes, indiceSegmento)
    return { unidade: u.codigo, nomeUnidade: u.nome, ...dados }
  })
}

/** Base (Orçado ou Remunerado, conforme `tipo`) de uma linha/total — estrutural, funciona tanto pra `LinhaComparativoUnidade` quanto `TotalComparativo`. null quando `tipo === 'orcado'` e não há Orçado cadastrado (Encargos/Vales, ou falta o código bespoke). */
export function baseDe(x: { orcado: number | null; remunerado: number }, tipo: TipoBase): number | null {
  return tipo === 'remunerado' ? x.remunerado : x.orcado
}

export function desvioDe(x: { orcado: number | null; remunerado: number; realizado: number }, tipo: TipoBase): number | null {
  const base = baseDe(x, tipo)
  return base === null ? null : base - x.realizado
}

export function desvioPercentDe(x: { orcado: number | null; remunerado: number; realizado: number }, tipo: TipoBase): number | null {
  const base = baseDe(x, tipo)
  const desvio = desvioDe(x, tipo)
  return base === null || base === 0 || desvio === null ? null : (desvio / base) * 100
}

/** `valor / receita * 100` — null-safe, usado pra "% orçado"/"% atual" dos cards consolidados (pondera pela MASSA de receita somada, nunca pela média dos % de cada unidade — mesmo cuidado já tomado na Curva de Captura). */
export function percentualDeReceita(valor: number | null, receita: number | null): number | null {
  return valor === null || receita === null || receita === 0 ? null : (valor / receita) * 100
}

export interface TotalComparativo {
  orcado: number | null
  remunerado: number
  realizado: number
  /** Só não-null quando TODAS as linhas somadas são de Vales (único pacote com Dispersão) — ver `LinhaComparativoUnidade.dispersao`. */
  dispersao: number | null
  receitaRealizada: number
}

/**
 * Soma todas as linhas — `realizado`/`remunerado`/`receitaRealizada` sempre
 * somam TODAS as unidades (completo, bate com o que você somaria
 * manualmente). `orcado`/`dispersao` somam só as unidades que têm esse dado
 * (uma unidade sem Orçamento cadastrado não entra na primeira; `dispersao`
 * só existe pra Vales, nunca pros demais pacotes). Usado tanto pelos cards
 * consolidados do topo quanto pra conferir que os totais batem com a soma
 * das linhas da tabela.
 */
export function somarLinhas(linhas: LinhaComparativoUnidade[]): TotalComparativo {
  const realizado = linhas.reduce((acc, l) => acc + l.realizado, 0)
  const remunerado = linhas.reduce((acc, l) => acc + l.remunerado, 0)
  const receitaRealizada = linhas.reduce((acc, l) => acc + l.receitaRealizada, 0)
  const comOrcado = linhas.filter((l): l is LinhaComparativoUnidade & { orcado: number } => l.orcado !== null)
  const orcado = comOrcado.length === 0 ? null : comOrcado.reduce((acc, l) => acc + l.orcado, 0)
  const comDispersao = linhas.filter((l): l is LinhaComparativoUnidade & { dispersao: number } => l.dispersao !== null)
  const dispersao = comDispersao.length === 0 ? null : comDispersao.reduce((acc, l) => acc + l.dispersao, 0)
  return { orcado, remunerado, realizado, dispersao, receitaRealizada }
}
