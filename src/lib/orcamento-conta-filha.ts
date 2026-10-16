import { CONTA_FILHA_ORCAMENTO_BESPOKE } from '@/lib/constants'
import { ajustarSinal, paraCodigoTtDeslocado, usaNumeracaoDreNativa, usaOrcamentoTtDeslocado } from '@/lib/orcamento-farol'
import type { OrcamentoLinha } from '@/types'

export { CONTA_FILHA_ORCAMENTO_BESPOKE }

/**
 * Orçado (R$) de uma conta-FILHA específica (não um pacote inteiro — ver
 * `buscarMetaOrcamento`/`buscarOrcadoRs` em orcamento-farol.ts pra isso).
 * Mesmo padrão dual-path de sempre: unidade nova (numeração nativa do DRE)
 * busca direto pelo `codigoNativo`, já que o Orçamento dela bate 1:1 com o
 * DRE; unidade antiga traduz via `CONTA_FILHA_ORCAMENTO_BESPOKE`
 * (constants.ts, sem entrada = conta nunca detalhada no formato antigo,
 * retorna null — quem chama decide se isso vira 0 na tela). `codigoNativo`
 * já zero-padded de 3 dígitos (ex: "161"), igual `conta_codigo` no banco.
 */
export function buscarOrcadoContaFilha(
  orcamentos: OrcamentoLinha[],
  params: { unidade: string; negocio: string; ano: number; mes: number },
  codigoNativo: string,
): number | null {
  if (usaNumeracaoDreNativa(orcamentos, params.unidade, params.negocio, params.ano)) {
    const linhas = orcamentos.filter(o =>
      o.unidade === params.unidade && o.negocio === params.negocio && o.ano === params.ano && o.mes === params.mes
      && o.conta_codigo === codigoNativo,
    )
    if (linhas.length === 0) return null
    return ajustarSinal(codigoNativo, linhas.reduce((acc, l) => acc + l.orcado, 0))
  }

  const codigoBespoke = CONTA_FILHA_ORCAMENTO_BESPOKE[codigoNativo]
  if (!codigoBespoke) return null
  const codigoFinal = usaOrcamentoTtDeslocado(orcamentos, params.unidade, params.negocio, params.ano)
    ? paraCodigoTtDeslocado(codigoBespoke)
    : codigoBespoke
  const linhas = orcamentos.filter(o =>
    o.unidade === params.unidade && o.negocio === params.negocio && o.ano === params.ano && o.mes === params.mes
    && o.conta_codigo === codigoFinal,
  )
  if (linhas.length === 0) return null
  return ajustarSinal(codigoNativo, linhas.reduce((acc, l) => acc + l.orcado, 0))
}
