import { calcularSemaforo } from '@/lib/farol-calculations'
import { formatCurrencyInteiro, formatNumeroPtBr, formatPercent, parseNumeroPtBr } from '@/lib/utils'
import { formatarMinutosComoDuracao, parseDuracaoParaMinutos } from '@/lib/duracao'
import { normalizarNomeUnidade } from '@/lib/unidade-resolver'
import { PACOTES } from '@/lib/constants'
import type { Natureza, ReuniaoFonte, ReuniaoFormato, ReuniaoSetor, Unidade } from '@/types'

/** Formata um resultado/meta conforme o `formato` cadastrado do indicador. */
export function formatarResultado(valor: number | null, formato: ReuniaoFormato): string {
  if (valor === null) return '—'
  switch (formato) {
    case 'percentual': return formatPercent(valor)
    case 'monetario': return formatCurrencyInteiro(valor)
    case 'duracao': return formatarMinutosComoDuracao(valor)
    case 'numero': return formatNumeroPtBr(valor)
  }
}

/**
 * Pontuação é tudo-ou-nada: bateu a meta (mesma direção de comparação do
 * Farol — `calcularSemaforo`, custo é "menor é melhor") ganha os pontos
 * cheios do indicador; não bateu, ganha 0. `null` = ainda sem resultado
 * lançado, ou sem meta disponível pro período (ex: indicador de fonte
 * automática sem linha de Orçamento/Metas de Perdas pra aquele mês) — não
 * pontua, mas também não conta como "não bateu".
 *
 * Exceção 1: fonte 'termometro' não tem meta — a pontuação ganha é o próprio
 * `resultado` (a planilha importada já entrega o valor final), só limitado
 * ao `pontos` cadastrado (o máximo daquele indicador), sem comparação nenhuma.
 *
 * Exceção 2: fonte 'importado' já traz a pontuação pronta da planilha padrão
 * de Reunião Resultados (`reuniao_resultados_mensais.pontos`, ver
 * `reuniao-planilha-parser.ts`) — o app nunca calcula, só repassa
 * `pontosImportados` (resultado/meta/natureza ficam só pra exibição).
 */
export function calcularPontosGanhos(resultado: number | null, meta: number | null, natureza: Natureza, pontos: number, fonte: ReuniaoFonte = 'manual', pontosImportados: number | null = null): number | null {
  if (fonte === 'importado') return pontosImportados
  if (resultado === null) return null
  if (fonte === 'termometro') return Math.max(0, Math.min(resultado, pontos))
  if (meta === null) return null
  const bateu = calcularSemaforo(resultado, meta, natureza).corClasse === 'positivo'
  return bateu ? pontos : 0
}

/**
 * Termômetro não tem meta (`calcularPontosGanhos` já pontua = resultado
 * capado), então o único número mostrado na tela é a própria pontuação — sem
 * uma segunda linha de "resultado" redundante. O verde/vermelho não é uma
 * meta de verdade, só uma referência visual do mínimo esperado, definida
 * pelo usuário.
 */
export const TERMOMETRO_LIMIAR_BOM = 80

/**
 * Natureza/formato de um indicador de fonte automática — sempre derivados
 * da fonte, nunca cadastrados à mão. `null` pra fonte 'manual' (usa o que
 * foi cadastrado no formulário) — e também pra 'importado' (cai no `return
 * null` do fim): a pontuação nunca usa natureza/formato pra esse fonte (vem
 * pronta da planilha), então não faz sentido travar um valor automático —
 * o usuário escolhe livremente na hora de cadastrar, só pra exibição.
 *
 * 'perdas' é sempre `performance` (maior é melhor), não `custo` — parece
 * contraintuitivo (é uma métrica de perda!), mas o valor vem da mesma
 * convenção de sinal do DRE (`diferenca` = REAL − REMUNERADO): negativo =
 * estouro, positivo = sobrou dinheiro, e quanto MENOS negativo (ou mais
 * positivo), melhor. A meta (`metas_perdas_indicadores.meta_anual`) é o
 * estouro MÁXIMO permitido, também negativo (ex: -300) — bater a meta é
 * `resultado >= meta` (ex: -250 bate -300; -400 não bate), exatamente a
 * regra de "maior é melhor" do `calcularSemaforo`. Mesma convenção já usada
 * no Consolidado do Painel de Perdas (`classeCelula`, `painel-perdas-calculations.ts`).
 */
export function naturezaEFormatoAutomaticos(fonte: ReuniaoFonte, fonteChave: string | null): { natureza: Natureza; formato: ReuniaoFormato } | null {
  if (fonte === 'perdas') return { natureza: 'performance', formato: 'monetario' }
  if (fonte === 'rotinas') return { natureza: 'performance', formato: 'percentual' }
  if (fonte === 'termometro') return { natureza: 'performance', formato: 'numero' }
  if (fonte === 'farol_pacote' && fonteChave && PACOTES[fonteChave]) {
    return { natureza: PACOTES[fonteChave].natureza, formato: 'percentual' }
  }
  return null
}

/**
 * Natureza/formato EFETIVOS de um indicador — sempre recalculados pra fonte
 * automática (nunca confia na coluna salva no banco, que pode ter sido
 * gravada antes de um ajuste na regra de cálculo), com fallback pro que foi
 * cadastrado se `fonte_chave` for inválido; usa o que foi cadastrado direto
 * pra fonte manual.
 */
export function resolverNaturezaFormato(indicador: { fonte: ReuniaoFonte; fonte_chave: string | null; natureza: Natureza; formato: ReuniaoFormato }): { natureza: Natureza; formato: ReuniaoFormato } {
  if (indicador.fonte === 'manual') return { natureza: indicador.natureza, formato: indicador.formato }
  return naturezaEFormatoAutomaticos(indicador.fonte, indicador.fonte_chave) ?? { natureza: indicador.natureza, formato: indicador.formato }
}

/** Texto editável (não a versão bonita de exibição) pra um input de resultado — vazio quando ainda não lançado. */
export function valorParaInputEditavel(valor: number | null, formato: ReuniaoFormato): string {
  if (valor === null) return ''
  if (formato === 'duracao') return formatarMinutosComoDuracao(valor)
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/** Converte o texto digitado num input de resultado pro número guardado — vazio = null (ainda não lançado, não é zero). */
export function parseValorInput(texto: string, formato: ReuniaoFormato): number | null {
  const t = texto.trim()
  if (t === '') return null
  if (formato === 'duracao') return parseDuracaoParaMinutos(t)
  return parseNumeroPtBr(t)
}

function ehCamacari(u: Unidade): boolean {
  const alvo = 'CAMACARI'
  return normalizarNomeUnidade(u.codigo).includes(alvo)
    || normalizarNomeUnidade(u.nome).includes(alvo)
    || (u.apelidos ?? []).some(a => normalizarNomeUnidade(a).includes(alvo))
}

export interface ReuniaoParticipavel {
  unidade: string
  negocio: string
  /** Rótulo pra exibir — igual ao nome da unidade, exceto Camaçari fora do Financeiro, que abre em "· Rota"/"· Armazém". */
  nome: string
}

/**
 * Linhas participáveis de um setor da Reunião Resultados. Decisão do
 * usuário: só Camaçari abre em 2 lideranças (ROTA/ARMAZÉM — dois gerentes
 * diferentes), nunca Ponta Grossa (ao contrário da RV, que trata as duas
 * como split); e só fora do Financeiro, que fica sempre consolidado (uma
 * linha só, negocio 'CONS' — já cadastrado assim). Todas as outras unidades
 * são sempre 1 linha, negocio 'CONS'.
 */
export function unidadesParticipaveis(unidades: Unidade[], setor: ReuniaoSetor): ReuniaoParticipavel[] {
  if (setor === 'financeiro') return unidades.map(u => ({ unidade: u.codigo, negocio: 'CONS', nome: u.nome }))

  const linhas: ReuniaoParticipavel[] = []
  for (const u of unidades) {
    if (ehCamacari(u)) {
      linhas.push({ unidade: u.codigo, negocio: 'ROTA', nome: `${u.nome} · Rota` })
      linhas.push({ unidade: u.codigo, negocio: 'ARM', nome: `${u.nome} · Armazém` })
    } else {
      linhas.push({ unidade: u.codigo, negocio: 'CONS', nome: u.nome })
    }
  }
  return linhas
}

/**
 * Negócio efetivo pra uma linha importada de planilha (ex: Termômetro) —
 * `negocioSugerido` vem do texto bruto da unidade na planilha (ver
 * `negocioPorPrefixo`, `@/lib/unidade-resolver.ts` — "CDL ..." → ROTA, "CDR
 * ..." → ARM). Só respeita esse sugerido se a unidade resolvida for Camaçari
 * fora do Financeiro (mesma regra de `unidadesParticipaveis`); qualquer outra
 * unidade cai sempre em 'CONS', mesmo que o nome bruto comece coincidentemente
 * com CDL/CDR.
 */
export function negocioParaImportacao(unidadeResolvida: Unidade, negocioSugerido: string, setor: ReuniaoSetor): string {
  if (setor === 'financeiro' || !ehCamacari(unidadeResolvida)) return 'CONS'
  return negocioSugerido === 'ROTA' || negocioSugerido === 'ARM' ? negocioSugerido : 'CONS'
}

/**
 * Ranking com desempate: ordena por `chave` (desc, null sempre por último);
 * quando empatam, desempata por `desempate` (desc, null por último). Usado no
 * "Resultado do Mês" da Reunião Resultados — quando duas unidades batem a
 * mesma pontuação total, a com melhor % de EBITDA do mês fica na frente.
 * Diferente de `atribuirRank` (`ranking-calculations.ts`), não trata AMBEV
 * como caso especial — participantes da Reunião Resultados nunca incluem
 * AMBEV (vêm de `useUnidades()`, a tabela `unidades` pura).
 */
export function atribuirRankComDesempate<T extends { rank: number | null }>(
  linhas: T[],
  chave: (l: T) => number | null,
  desempate: (l: T) => number | null,
): T[] {
  const ordenado = [...linhas].sort((a, b) => {
    const va = chave(a)
    const vb = chave(b)
    if (va === null && vb === null) return 0
    if (va === null) return 1
    if (vb === null) return -1
    if (va !== vb) return vb - va
    const da = desempate(a)
    const db = desempate(b)
    if (da === null && db === null) return 0
    if (da === null) return 1
    if (db === null) return -1
    return db - da
  })
  ordenado.forEach((l, i) => { l.rank = i + 1 })
  return ordenado
}
