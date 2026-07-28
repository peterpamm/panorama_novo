import { CODIGOS_PERFORMANCE, PACOTE_CONTA_ORCAMENTO } from '@/lib/constants'
import type { OrcamentoLinha } from '@/types'

/**
 * A planilha de orçamento guarda contas de custo com o mesmo sinal negativo
 * do GInfo (ex: Custo Operacional = -71,40% da receita) — igual
 * normalizarParaCalculo faz pro AVR do DRE, invertemos o sinal pra todo
 * pacote que não seja EBITDA/Geração de Caixa, pra bater com a convenção do
 * resto do Farol (custo sempre positivo, "quanto menor melhor").
 */
function ajustarSinal(codigo: string, valor: number): number {
  return CODIGOS_PERFORMANCE.includes(codigo) ? valor : -valor
}

/**
 * Meta (%) direto do orçamento pra um pacote do Farol — soma o AV das linhas
 * do orçamento cujo código (numeração própria da planilha, ver
 * PACOTE_CONTA_ORCAMENTO) bate com o(s) código(s) configurado(s) pro pacote.
 * `mes` é 0 pro anual (bloco TOTAL da planilha), 1-12 pro mês, ou 13/14 pro
 * 1º/2º semestre (blocos recalculados — ver orcamento-semestre.ts, tela
 * Administração > Orçamento). Retorna null quando o pacote não tem
 * mapeamento configurado ou não há linha correspondente importada/calculada
 * — nesses casos o chamador deve manter a meta calculada normalmente
 * (tabela `metas`/AVO do DRE).
 */
export function buscarMetaOrcamento(
  orcamentos: OrcamentoLinha[],
  params: { unidade: string; negocio: string; ano: number; codigo: string; mes: number },
): number | null {
  const codigosAlvo = PACOTE_CONTA_ORCAMENTO[params.codigo]
  if (!codigosAlvo) return null

  const linhas = orcamentos.filter(o =>
    o.unidade === params.unidade && o.negocio === params.negocio && o.ano === params.ano && o.mes === params.mes
    && codigosAlvo.includes(o.conta_codigo),
  )
  if (linhas.length === 0) return null
  return ajustarSinal(params.codigo, linhas.reduce((acc, l) => acc + l.av, 0))
}
