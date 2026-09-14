/**
 * Checagens de consistência do SDG Corporativo de Frota — o painel avisa
 * quando os dados não fecham, em vez de esconder o problema (pedido
 * explícito: já existe uma diferença de R$ 7.484,10 entre a conta-mãe de
 * Frota e a soma dos seus 3 grupos, numa prévia real — é esse tipo de coisa
 * que precisa aparecer). Funções puras — quem chama já traz os números
 * agregados (reaproveitando `normalizarParaCalculo`/`avrPorPrefixo`/`somaReal`
 * de farol-calculations.ts), essas funções só comparam.
 */

export interface ResultadoConsistencia {
  ok: boolean
  valorA: number
  valorB: number
  diferenca: number
}

/** Abaixo disso é arredondamento de centavo, não inconsistência de verdade. */
const TOLERANCIA_REAIS = 0.01
/** % costuma vir com arredondamento mais grosseiro que R$ — tolerância maior. */
const TOLERANCIA_PONTOS_PERCENTUAIS = 0.05

function comparar(valorA: number, valorB: number, tolerancia: number): ResultadoConsistencia {
  const diferenca = valorA - valorB
  return { ok: Math.abs(diferenca) <= tolerancia, valorA, valorB, diferenca }
}

/** Regra 1: a soma das contas filhas bate com a conta-mãe? (ex: 114 "Custos Gerais com Frota" vs. 115+140+144). */
export function verificarSomaFilhas(valorMae: number, valoresFilhas: number[]): ResultadoConsistencia {
  return comparar(valorMae, valoresFilhas.reduce((acc, v) => acc + v, 0), TOLERANCIA_REAIS)
}

/** Regra 2: a soma das unidades bate com o consolidado (AMBEV)? */
export function verificarSomaUnidades(valorConsolidado: number, valoresPorUnidade: number[]): ResultadoConsistencia {
  return comparar(valorConsolidado, valoresPorUnidade.reduce((acc, v) => acc + v, 0), TOLERANCIA_REAIS)
}

/** Regra 3: o percentual recalculado bate com o que já veio pronto no arquivo (ex: AVR bruto do GInfo vs. `avrPorPrefixo` recalculado das mesmas linhas)? */
export function verificarPercentualRecalculado(percentualArquivo: number, percentualRecalculado: number): ResultadoConsistencia {
  return comparar(percentualArquivo, percentualRecalculado, TOLERANCIA_PONTOS_PERCENTUAIS)
}
