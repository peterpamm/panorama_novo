import { normalizarNomeUnidade } from '@/lib/unidade-resolver'
import { opcoesNegocioSplit, unidadeSplitNegocio } from '@/lib/rv-gente'
import { PACOTES } from '@/lib/constants'
import { calcularRankingIndicador, type RankingLinhaIndicador } from '@/lib/ranking-calculations'
import { calcularMatrizPerdas } from '@/lib/painel-perdas-calculations'
import { formatPercent } from '@/lib/utils'
import type {
  DisponibilidadeArmazemAcumulada, DisponibilidadeEmpurradaAcumulada, DisponibilidadeRotaAcumulada, DreLongoRow,
  MetaPerdaIndicador, Natureza, OrcamentoLinha, PainelPerdasAux, ResultadoTri, Unidade,
} from '@/types'

export type StatusFarolGerente = 'bateu' | 'perdeu' | 'pendente'

export interface LinhaFarolGerente {
  indicador: string
  meta: string
  real: string
  status: StatusFarolGerente
}

/** Linha ainda sem fonte de dado ligada — mostra "—"/pendente até entrarmos indicador a indicador. */
export function linhaPendente(indicador: string): LinhaFarolGerente {
  return { indicador, meta: '—', real: '—', status: 'pendente' }
}

export type DisponibilidadeTipo = 'ARM' | 'ROTA' | 'EMP'

/**
 * Quais linhas de Disponibilidade aparecem no Semestre de cada unidade —
 * mesma regra do Farol Gerentes antigo (06_Farol_Gerentes.py, painel
 * Streamlit): a maioria tem ARM+ROTA; Ponta Grossa e Estância são ARM+EMP
 * (operação de empurrada, não têm ROTA), Rio de Janeiro é só ROTA (não tem
 * ARM), Carambeí (ex-"VIDROS") não participa de Disponibilidade nenhuma.
 * Casa por nome normalizado, não por código, pra não depender do código
 * exato cadastrado.
 */
export function disponibilidadesDaUnidade(nomeUnidade: string): DisponibilidadeTipo[] {
  const norm = normalizarNomeUnidade(nomeUnidade)
  if (norm.includes('PONTA GROSSA') || norm.includes('ESTANCIA')) return ['ARM', 'EMP']
  if (norm.includes('RIO DE JANEIRO') || norm === 'RIO') return ['ROTA']
  if (norm.includes('CARAMBE')) return []
  return ['ARM', 'ROTA']
}

/** Carambeí (ex-"VIDROS") fica fora da contagem de "unidades que bateram EBITDA" — mesma regra do painel antigo. */
export function participaContagemEbitda(nomeUnidade: string): boolean {
  return !normalizarNomeUnidade(nomeUnidade).includes('CARAMBE')
}

/** Um "card" do Farol Gerentes — uma unidade consolidada, ou um negócio específico de uma unidade com split (ver `unidadesCardsFarol`). */
export interface UnidadeCardFarol {
  chave: string
  titulo: string
  unidadeCodigo: string
  /** null = card consolidado (unidade sem split); senão o negócio desse card (ROTA/ARM/EMP). */
  negocio: string | null
  /**
   * Negócios da unidade — geram tanto as linhas de Disponibilidade
   * (Semestre) quanto as de Scorecard (Anual), uma por negócio.
   */
  disponibilidades: DisponibilidadeTipo[]
}

/**
 * Monta a lista de cards do Farol Gerentes a partir das unidades reais —
 * Camaçari e Ponta Grossa (unidades com 2 gerentes, ver `unidadeSplitNegocio`)
 * não têm card consolidado: viram 2 cards, um por negócio (Camaçari — Rota /
 * Camaçari — Armazém; Ponta Grossa — Empurrada / Ponta Grossa — Armazém),
 * cada um só com a Disponibilidade do próprio negócio — os resultados de um
 * gerente não aparecem no card do outro (mesma trava que RV > Painel Geral já
 * usa pra isso). As demais unidades continuam com um card só, consolidado.
 */
export function unidadesCardsFarol(unidades: Unidade[]): UnidadeCardFarol[] {
  const cards: UnidadeCardFarol[] = []
  for (const u of unidades) {
    if (u.codigo === 'AMBEV') continue
    if (unidadeSplitNegocio(u.codigo, u.nome)) {
      for (const opcao of opcoesNegocioSplit(u.codigo, u.nome)) {
        cards.push({
          chave: `${u.codigo}-${opcao.valor}`,
          titulo: `${u.nome} — ${opcao.label}`,
          unidadeCodigo: u.codigo,
          negocio: opcao.valor,
          disponibilidades: [opcao.valor as DisponibilidadeTipo],
        })
      }
    } else {
      cards.push({
        chave: u.codigo,
        titulo: u.nome,
        unidadeCodigo: u.codigo,
        negocio: null,
        disponibilidades: disponibilidadesDaUnidade(u.nome),
      })
    }
  }
  return cards
}

// ─── Indicadores ligados a dado real ─────────────────────────────────────────

/**
 * Gastos Totais (e outros indicadores % do DRE, mesmo pacote usado no
 * Farol/SDG Corporativo) acumulado no ano (YTD — mesma régua de
 * `calcularRankingIndicador`), calculado SEPARADO por negócio — Camaçari
 * (Rota/Armazém) e Ponta Grossa (Empurrada/Armazém) têm resultado próprio
 * por gerente, não o consolidado da unidade. Chave do mapa:
 * `${unidade}|${negocio}` (negócio de verdade, ex: "CONS"/"ROTA"/"ARM"/"EMP").
 */
export function calcularIndicadorPorNegocio(
  rows: DreLongoRow[],
  orcamentos: OrcamentoLinha[],
  codigo: string,
  ano: number,
): Map<string, RankingLinhaIndicador> {
  const pacote = PACOTES[codigo]
  const mapa = new Map<string, RankingLinhaIndicador>()
  if (!pacote) return mapa

  const rowsAno = rows.filter(r => r.ano === ano)
  const orcamentoAno = orcamentos.filter(o => o.ano === ano)
  const negocios = Array.from(new Set(rowsAno.map(r => r.negocio)))

  for (const negocio of negocios) {
    const linhas = calcularRankingIndicador(
      rowsAno.filter(r => r.negocio === negocio),
      orcamentoAno.filter(o => o.negocio === negocio),
      pacote,
      codigo,
      { negocio, ano, periodo: 'ytd', mes: 0 },
    )
    for (const l of linhas) mapa.set(`${l.unidade}|${negocio}`, l)
  }
  return mapa
}

/** Linha do Farol Gerentes a partir de um resultado de `calcularIndicadorPorNegocio` — "—"/pendente se a unidade/negócio não tem dado. */
export function linhaIndicadorDre(indicador: string, linha: RankingLinhaIndicador | undefined): LinhaFarolGerente {
  if (!linha) return linhaPendente(indicador)
  return {
    indicador,
    meta: formatPercent(linha.meta, 1),
    real: formatPercent(linha.avr, 1),
    status: linha.delta === null ? 'pendente' : linha.delta >= 0 ? 'bateu' : 'perdeu',
  }
}

/** Um degrau da rampa de bônus: a partir de quanto % do indicador foi atingido, quanto % do valor do bônus fica garantido. */
export interface DegrauRampaBonus {
  atingiu: number
  levou: number
}

/**
 * Rampa de bônus por indicador (fixa no código por enquanto — sem cadastro,
 * ver conversa do SDG Gerentes > Metas Bônus). EBITDA (performance): quanto
 * MAIS alto o % atingido (realizado ÷ meta), melhor — 100% ou mais garante o
 * bônus cheio. Gastos Totais (custo): quanto MAIS BAIXO o % atingido
 * (realizado ÷ meta — "quanto do orçamento foi consumido"), melhor — 100%
 * ou menos garante o bônus cheio; acima de 110% não garante nada.
 */
export const RAMPA_BONUS_EBITDA: DegrauRampaBonus[] = [
  { atingiu: 100, levou: 100 },
  { atingiu: 95, levou: 75 },
  { atingiu: 90, levou: 50 },
]
export const RAMPA_BONUS_CUSTOS: DegrauRampaBonus[] = [
  { atingiu: 100, levou: 100 },
  { atingiu: 105, levou: 75 },
  { atingiu: 110, levou: 50 },
]

export interface ResultadoRampaBonus {
  /** % do indicador atingido (realizado ÷ meta × 100) — mesmo pra custo e performance, só muda o sentido de "melhor". */
  percentualAtingido: number
  /** % do valor do bônus garantido nesse patamar — 0 quando não bate nem o pior degrau da rampa. */
  bonusPercent: number
}

/**
 * Calcula o degrau da rampa de bônus batido por um indicador, a partir do
 * realizado/meta brutos (mesmos números de `RankingLinhaIndicador`, antes de
 * formatar pra `LinhaFarolGerente`). null sem meta cadastrada (nada pra
 * comparar) ou meta zero (divisão inválida).
 */
export function calcularRampaBonus(avr: number, meta: number | null, natureza: Natureza): ResultadoRampaBonus | null {
  if (meta === null || meta === 0) return null
  const percentualAtingido = (avr / meta) * 100
  const bonusPercent = natureza === 'performance'
    ? RAMPA_BONUS_EBITDA.find(d => percentualAtingido >= d.atingiu)?.levou ?? 0
    : [...RAMPA_BONUS_CUSTOS].sort((a, b) => a.atingiu - b.atingiu).find(d => percentualAtingido <= d.atingiu)?.levou ?? 0
  return { percentualAtingido, bonusPercent }
}

/**
 * Acidentes TRI (acidente grave) acumulado no ano, por unidade — soma de
 * `resultados_tri` (registro manual, RV de Segurança > Importação); mês/unidade
 * sem registro conta como zero, então uma unidade sem NENHUM registro no
 * ano ainda entra no mapa com 0 (não fica de fora). Meta é sempre 0 (fixa,
 * não vem de tabela nenhuma) — mesma regra do painel antigo.
 */
export function calcularAcidentesTriPorUnidade(resultadosTri: ResultadoTri[], ano: number, codigosUnidade: string[]): Map<string, number> {
  const mapa = new Map<string, number>(codigosUnidade.map(c => [c, 0]))
  for (const r of resultadosTri) {
    if (r.ano !== ano) continue
    mapa.set(r.unidade, (mapa.get(r.unidade) ?? 0) + r.valor)
  }
  return mapa
}

/** Linha de Acidentes TRI — meta sempre 0, bate quando o total do ano é 0. */
export function linhaAcidentesTri(totalAno: number | undefined): LinhaFarolGerente {
  const valor = totalAno ?? 0
  return {
    indicador: 'Acidentes TRI',
    meta: '0',
    real: String(valor),
    status: valor <= 0 ? 'bateu' : 'perdeu',
  }
}

export interface PacotePerdasItem {
  realPct: number | null
  metaPct: number | null
}

/**
 * Pacote de Perdas (% de perdas acumuladas sobre o faturamento, mesmo
 * cálculo do Painel de Perdas — `calcularMatrizPerdas`) acumulado do ano
 * (todos os meses com dado, igual a aba Consolidado sem filtro de mês) —
 * sempre CONS, nunca quebra por negócio (Vales/Multas/Indisponibilidade
 * etc. não são apurados por gerente), então as duas metades de uma unidade
 * com split mostram o mesmo valor. Chave do mapa: código da unidade.
 */
export function calcularPacotePerdasPorUnidade(
  rowsDre: DreLongoRow[],
  rowsAux: PainelPerdasAux[],
  metasPerdasIndicadores: MetaPerdaIndicador[],
  ano: number,
  dataEntradaPorUnidade: Map<string, string | null> = new Map(),
): Map<string, PacotePerdasItem> {
  const meses = Array.from(new Set(
    rowsDre.filter(r => r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === ano).map(r => r.mes),
  )).sort((a, b) => a - b)

  const mapa = new Map<string, PacotePerdasItem>()
  if (meses.length === 0) return mapa

  const matriz = calcularMatrizPerdas(rowsDre, rowsAux, metasPerdasIndicadores.filter(m => m.ano === ano), ano, meses, dataEntradaPorUnidade)
  const linhaReal = matriz.linhas.find(l => l.tipo === 'perdas_pct')
  const linhaMeta = matriz.linhas.find(l => l.tipo === 'meta_pct')
  for (const u of matriz.unidades) {
    mapa.set(u, { realPct: linhaReal?.valores[u] ?? null, metaPct: linhaMeta?.valores[u] ?? null })
  }
  return mapa
}

/** Linha de Pacote de Perdas — % de perdas vs meta (quanto maior/menos negativo, melhor, igual o Painel de Perdas). */
export function linhaPacotePerdas(item: PacotePerdasItem | undefined): LinhaFarolGerente {
  if (!item || item.realPct === null) return linhaPendente('Pacote de Perdas')
  const { realPct, metaPct } = item
  return {
    indicador: 'Pacote de Perdas',
    meta: metaPct === null ? '—' : formatPercent(metaPct * 100, 2),
    real: formatPercent(realPct * 100, 2),
    status: metaPct === null ? 'pendente' : realPct >= metaPct ? 'bateu' : 'perdeu',
  }
}

/**
 * Disp. Rota — snapshot único importado (Importação > Financeiro >
 * Disponibilidade Rota Acumulada, ver `disponibilidade-rota-parser.ts`),
 * já em escala de percentual. Quanto maior/mais próximo da meta, melhor.
 */
export function linhaDisponibilidadeRota(item: DisponibilidadeRotaAcumulada | undefined): LinhaFarolGerente {
  if (!item) return linhaPendente('Disp. Rota')
  return {
    indicador: 'Disp. Rota',
    meta: formatPercent(item.meta, 1),
    real: formatPercent(item.real, 1),
    status: item.real >= item.meta ? 'bateu' : 'perdeu',
  }
}

/**
 * Disp. Empurrada — snapshot único importado (Importação > Financeiro >
 * Disponibilidade Empurrada Acumulada, ver
 * `disponibilidade-empurrada-parser.ts`), já em escala de percentual.
 * Quanto maior/mais próximo da meta, melhor. Na prática só Ponta Grossa e
 * Estância têm esse indicador (únicas unidades com negócio Empurrada).
 */
export function linhaDisponibilidadeEmpurrada(item: DisponibilidadeEmpurradaAcumulada | undefined): LinhaFarolGerente {
  if (!item) return linhaPendente('Disp. Empurrada')
  return {
    indicador: 'Disp. Empurrada',
    meta: formatPercent(item.meta, 1),
    real: formatPercent(item.real, 1),
    status: item.real >= item.meta ? 'bateu' : 'perdeu',
  }
}

/** Meta da Posição LOG20 — fixa em "top 5" (faixa 1-5), não vem de cadastro. */
export const META_POSICAO_LOG20 = '1-5'

/**
 * Posição da LOG20 (empresa toda, não por unidade) no ranking de operadores
 * da Ambev — substitui o antigo Scorecard por unidade. Mesmo valor em todo
 * card (como `linhaEbitdaGlobal`), preenchido manualmente em Importação >
 * Financeiro > Dados auxiliares (1 por ano, ver `log20_posicao_ambev`,
 * migration 127). `faixa` é texto livre (ex: "1-5", "6-10") — bate quando o
 * PIOR número da faixa (o maior) ainda está dentro do top 5 (ex: "1-5" bate,
 * "3-7" não, porque no pior caso a LOG20 ficaria em 7º). Sem número nenhum
 * no texto, ou sem faixa cadastrada ainda, fica pendente.
 */
export function linhaPosicaoLog20(faixa: string | null): LinhaFarolGerente {
  if (!faixa) return linhaPendente('Posição LOG20')
  const numeros = faixa.match(/\d+/g)?.map(Number) ?? []
  if (numeros.length === 0) return { indicador: 'Posição LOG20', meta: META_POSICAO_LOG20, real: faixa, status: 'pendente' }
  const piorCaso = Math.max(...numeros)
  return {
    indicador: 'Posição LOG20',
    meta: META_POSICAO_LOG20,
    real: faixa,
    status: piorCaso <= 5 ? 'bateu' : 'perdeu',
  }
}

/**
 * Disp. Armazém — snapshot único importado (Importação > Financeiro >
 * Disponibilidade Armazém, ver `disponibilidade-armazem-parser.ts`). A
 * meta pode ser `null` (planilha sem coluna de meta ainda não importada
 * com meta nenhuma vez) — nesse caso fica pendente mesmo tendo realizado.
 */
export function linhaDisponibilidadeArmazem(item: DisponibilidadeArmazemAcumulada | undefined): LinhaFarolGerente {
  if (!item) return linhaPendente('Disp. Armazém')
  if (item.meta === null) {
    return { indicador: 'Disp. Armazém', meta: '—', real: formatPercent(item.real, 1), status: 'pendente' }
  }
  return {
    indicador: 'Disp. Armazém',
    meta: formatPercent(item.meta, 1),
    real: formatPercent(item.real, 1),
    status: item.real >= item.meta ? 'bateu' : 'perdeu',
  }
}

export interface CardFarolGerenteComputado {
  card: UnidadeCardFarol
  semestre: LinhaFarolGerente[]
  ano: LinhaFarolGerente[]
  /** Dado bruto (realizado/meta, antes de formatar) de Gastos Totais e EBITDA Unidade desse card — usado pra calcular a Rampa de Bônus (ver `calcularRampaBonus`), que precisa do número, não da string já arredondada em `LinhaFarolGerente`. undefined = sem dado pra essa unidade/negócio. */
  gastosTotais: RankingLinhaIndicador | undefined
  ebitdaUnidade: RankingLinhaIndicador | undefined
}

/**
 * Monta as linhas Semestre/Ano de todos os cards do Farol Gerentes (um por
 * unidade, ou 2 pras unidades com split de negócio — ver
 * `unidadesCardsFarol`) — extraído de `FarolGerentesPage.tsx` (linhas
 * ~53-111) pra reaproveitar no SDG Gerentes (slide "Metas Bônus"), sem
 * duplicar a lógica de quais indicadores entram em cada seção. `ano` é o
 * ano-calendário de referência das metas (Farol Gerentes usa sempre o ano
 * atual; quem chama decide — no SDG Gerentes normalmente é o mesmo ano
 * selecionado no cabeçalho da apresentação).
 */
export function montarCardsFarolGerentes(params: {
  unidades: Unidade[]
  rows: DreLongoRow[]
  orcamentos: OrcamentoLinha[]
  resultadosTri: ResultadoTri[]
  rowsAux: PainelPerdasAux[]
  metasPerdasIndicadores: MetaPerdaIndicador[]
  disponibilidadeRota: DisponibilidadeRotaAcumulada[]
  disponibilidadeArmazem: DisponibilidadeArmazemAcumulada[]
  disponibilidadeEmpurrada: DisponibilidadeEmpurradaAcumulada[]
  /** Faixa da Posição LOG20 pro `ano` de referência (ver `linhaPosicaoLog20`) — null sem registro ainda. */
  posicaoLog20: string | null
  ano: number
}): { cards: CardFarolGerenteComputado[]; linhaEbitdaGlobal: LinhaFarolGerente } {
  const {
    unidades, rows, orcamentos, resultadosTri, rowsAux, metasPerdasIndicadores, disponibilidadeRota,
    disponibilidadeArmazem, disponibilidadeEmpurrada, posicaoLog20, ano,
  } = params
  const dataEntradaPorUnidade = new Map(unidades.map(u => [u.codigo, u.data_entrada]))

  const mapaGastos = calcularIndicadorPorNegocio(rows, orcamentos, '900', ano)
  const mapaEbitda = calcularIndicadorPorNegocio(rows, orcamentos, '233', ano)
  const mapaTri = calcularAcidentesTriPorUnidade(resultadosTri, ano, unidades.map(u => u.codigo))
  const mapaPerdas = calcularPacotePerdasPorUnidade(rows, rowsAux, metasPerdasIndicadores, ano, dataEntradaPorUnidade)
  const mapaDispRota = new Map(disponibilidadeRota.map(d => [d.unidade, d]))
  const mapaDispArmazem = new Map(disponibilidadeArmazem.map(d => [d.unidade, d]))
  const mapaDispEmpurrada = new Map(disponibilidadeEmpurrada.map(d => [d.unidade, d]))

  const linhaEbitdaGlobal = linhaIndicadorDre('EBITDA Global', mapaEbitda.get('AMBEV|CONS'))
  // Mesmo objeto em todo card, igual `linhaEbitdaGlobal` — a Posição LOG20 é
  // da empresa toda, não calculada por unidade.
  const linhaPosicaoLog20Global = linhaPosicaoLog20(posicaoLog20)

  const cards = unidadesCardsFarol(unidades).map(card => {
    const chaveNegocio = `${card.unidadeCodigo}|${card.negocio ?? 'CONS'}`
    return {
      card,
      gastosTotais: mapaGastos.get(chaveNegocio),
      ebitdaUnidade: mapaEbitda.get(chaveNegocio),
      semestre: [
        linhaIndicadorDre('Gastos Totais', mapaGastos.get(chaveNegocio)),
        linhaAcidentesTri(mapaTri.get(card.unidadeCodigo)),
        ...card.disponibilidades.map(d => {
          if (d === 'ROTA') return linhaDisponibilidadeRota(mapaDispRota.get(card.unidadeCodigo))
          if (d === 'ARM') return linhaDisponibilidadeArmazem(mapaDispArmazem.get(card.unidadeCodigo))
          return linhaDisponibilidadeEmpurrada(mapaDispEmpurrada.get(card.unidadeCodigo))
        }),
      ],
      ano: [
        linhaPosicaoLog20Global,
        linhaPacotePerdas(mapaPerdas.get(card.unidadeCodigo)),
        linhaIndicadorDre('EBITDA Unidade', mapaEbitda.get(chaveNegocio)),
        linhaEbitdaGlobal,
      ],
    }
  })

  return { cards, linhaEbitdaGlobal }
}
