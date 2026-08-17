import { normalizarNomeUnidade } from '@/lib/unidade-resolver'
import { opcoesNegocioSplit, unidadeSplitNegocio } from '@/lib/rv-gente'
import { PACOTES } from '@/lib/constants'
import { calcularRankingIndicador, type RankingLinhaIndicador } from '@/lib/ranking-calculations'
import { calcularMatrizPerdas } from '@/lib/painel-perdas-calculations'
import { formatPercent } from '@/lib/utils'
import type {
  DisponibilidadeArmazemAcumulada, DisponibilidadeRotaAcumulada, DreLongoRow, MetaPerdaIndicador, OrcamentoLinha,
  PainelPerdasAux, ResultadoTri, ScorecardAcumulado, Unidade,
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

export const NOME_DISPONIBILIDADE: Record<DisponibilidadeTipo, string> = {
  ARM: 'Armazém',
  ROTA: 'Rota',
  EMP: 'Empurrada',
}

/** Nome curto do negócio, usado nas linhas de Scorecard (uma por negócio) pra não estourar a largura do card. */
export const NOME_NEGOCIO_CURTO: Record<DisponibilidadeTipo, string> = {
  ARM: 'Arm.',
  ROTA: 'Rota.',
  EMP: 'Empur.',
}

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

/**
 * Acidentes TRI (acidente grave) acumulado no ano, por unidade — soma de
 * `resultados_tri` (registro manual, Importação > Segurança); mês/unidade
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
): Map<string, PacotePerdasItem> {
  const meses = Array.from(new Set(
    rowsDre.filter(r => r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === ano).map(r => r.mes),
  )).sort((a, b) => a - b)

  const mapa = new Map<string, PacotePerdasItem>()
  if (meses.length === 0) return mapa

  const matriz = calcularMatrizPerdas(rowsDre, rowsAux, metasPerdasIndicadores.filter(m => m.ano === ano), ano, meses)
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

/** Meta do Scorecard — fixa em 80% pra todo negócio/unidade, não vem da planilha nem de cadastro. */
export const META_SCORECARD = 80

/**
 * Scorecard de um negócio (Rota/Arm./Empur.) — snapshot único importado
 * (Importação > Financeiro > Scorecard, ver `scorecard-parser.ts`), já em
 * escala de percentual. Bate com 80% ou mais (`META_SCORECARD`).
 */
export function linhaScorecard(negocio: DisponibilidadeTipo, item: ScorecardAcumulado | undefined): LinhaFarolGerente {
  const indicador = `Scorecard ${NOME_NEGOCIO_CURTO[negocio]}`
  if (!item) return linhaPendente(indicador)
  return {
    indicador,
    meta: formatPercent(META_SCORECARD, 1),
    real: formatPercent(item.score, 1),
    status: item.score >= META_SCORECARD ? 'bateu' : 'perdeu',
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
