import type { ParsedDreRow } from '@/lib/dre-xlsx-parser'

export interface AlteracaoDetectada {
  conta_codigo: string
  campo: string
  valorAntigo: number
  valorNovo: number
}

const CAMPOS = ['remunerado', 'realizado', 'diferenca', 'avo', 'avr']

export const MES_BLOCO_LABEL: Record<string, string> = {
  jan: 'Janeiro', fev: 'Fevereiro', mar: 'Março', abr: 'Abril', mai: 'Maio', jun: 'Junho',
  jul: 'Julho', ago: 'Agosto', set: 'Setembro', out: 'Outubro', nov: 'Novembro', dez: 'Dezembro',
  total: 'Total (acumulado)',
}

/** Blocos de mês de um arquivo, exceto 'total' (que é só o acumulado, não um mês comparável). */
export function mesesParaComparar(blocosDetectados: string[]): string[] {
  return blocosDetectados.filter(b => b !== 'total')
}

/**
 * Compara os meses do arquivo novo contra o que já estava gravado
 * (`existentesPorConta`, ex: a própria linha de dre_lancamentos), pra
 * flagrar ajustes retroativos da matriz (mês que já tinha sido importado e
 * mudou de valor). Não precisa excluir "o mês mais recente" manualmente: se
 * for um mês novo (nunca importado pra essa conta), o campo correspondente
 * ainda não existe no lado `existente` e a comparação é pulada sozinha —
 * mas se for um mês que JÁ tinha dado antes (ex: reimportação do mesmo
 * período, com ou sem ajuste retroativo real), ele é comparado normalmente.
 * Arredonda a 2 casas antes de comparar, pra não confundir ruído de ponto
 * flutuante com alteração real.
 */
export function detectarAlteracoes(
  linhasNovas: ParsedDreRow[],
  existentesPorConta: Map<string, Record<string, number>>,
  mesesParaComparar: string[],
): AlteracaoDetectada[] {
  const alteracoes: AlteracaoDetectada[] = []

  for (const linha of linhasNovas) {
    const existente = existentesPorConta.get(linha.conta_codigo)
    if (!existente) continue

    for (const mes of mesesParaComparar) {
      for (const campoBase of CAMPOS) {
        const campo = `${mes}_${campoBase}`
        const novo = linha.campos[campo]
        const antigo = existente[campo]
        if (novo === undefined || antigo === undefined || antigo === null) continue
        if (Math.round(novo * 100) !== Math.round(antigo * 100)) {
          alteracoes.push({ conta_codigo: linha.conta_codigo, campo, valorAntigo: antigo, valorNovo: novo })
        }
      }
    }
  }

  return alteracoes
}
