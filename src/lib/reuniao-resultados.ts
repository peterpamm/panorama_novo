import { calcularSemaforo } from '@/lib/farol-calculations'
import { formatCurrencyInteiro, formatNumeroPtBr, formatPercent, parseNumeroPtBr } from '@/lib/utils'
import { formatarMinutosComoDuracao, parseDuracaoParaMinutos } from '@/lib/duracao'
import { PACOTES } from '@/lib/constants'
import type { Natureza, ReuniaoFonte, ReuniaoFormato } from '@/types'

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
 */
export function calcularPontosGanhos(resultado: number | null, meta: number | null, natureza: Natureza, pontos: number): number | null {
  if (resultado === null || meta === null) return null
  const bateu = calcularSemaforo(resultado, meta, natureza).corClasse === 'positivo'
  return bateu ? pontos : 0
}

/**
 * Natureza/formato de um indicador de fonte automática — sempre derivados
 * da fonte, nunca cadastrados à mão. `null` pra fonte 'manual' (usa o que
 * foi cadastrado no formulário).
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
