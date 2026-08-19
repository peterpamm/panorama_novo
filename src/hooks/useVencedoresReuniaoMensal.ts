import { useMemo } from 'react'
import { useReuniaoDados, deltaFarolPacoteUnidadeMes } from '@/hooks/useReuniaoDados'
import { atribuirRankComDesempate } from '@/lib/reuniao-resultados'
import { ORDEM_SETORES, type VencedorSetorMes } from '@/lib/reuniao-pagamento'

/**
 * Vencedor do mês de cada um dos 6 setores da Reunião Resultados — mesmo
 * cálculo de "Ranking do Mês" que cada setor já mostra na própria aba
 * (`ResultadoMesReuniaoTab.tsx`: pontos do mês, desempate por Δ EBITDA),
 * só que pros 6 de uma vez, pra alimentar o relatório de pagamento.
 *
 * Setor sem NENHUMA unidade com pontos lançados naquele mês não entra na
 * lista (não existe "vencedor com 0 pontos" — ninguém bateu nada, então não
 * há prêmio a pagar por esse setor no mês).
 */
export function useVencedoresReuniaoMensal(ano: string, mes: number) {
  const financeiro = useReuniaoDados('financeiro', ano)
  const gente = useReuniaoDados('gente', ano)
  const frota = useReuniaoDados('frota', ano)
  const seguranca = useReuniaoDados('seguranca', ano)
  const distribuicao = useReuniaoDados('distribuicao', ano)
  const armazem = useReuniaoDados('armazem', ano)

  const porSetor = useMemo(() => ({
    financeiro, gente, frota, seguranca, distribuicao, armazem,
  }), [financeiro, gente, frota, seguranca, distribuicao, armazem])

  const carregando = ORDEM_SETORES.some(s => porSetor[s].carregando)

  const vencedores = useMemo<VencedorSetorMes[]>(() => {
    const lista: VencedorSetorMes[] = []
    for (const setor of ORDEM_SETORES) {
      const dados = porSetor[setor]
      const base = dados.unidadesDoTotal.map(({ unidade, negocio }) => ({
        unidade: `${unidade}|${negocio}`,
        pontos: dados.totalPorUnidadeMes[`${unidade}|${negocio}|${mes}`] ?? null,
        ebitdaDelta: deltaFarolPacoteUnidadeMes(dados.rowsDre, dados.orcamentos, '232', unidade, Number(ano), mes, negocio),
        rank: null as number | null,
      }))
      const ranking = atribuirRankComDesempate(base, l => l.pontos, l => l.ebitdaDelta)
      const vencedor = ranking.find(r => r.rank === 1 && r.pontos !== null && r.pontos > 0)
      if (!vencedor) continue
      const [unidade, negocio] = vencedor.unidade.split('|')
      lista.push({
        setor, unidade, negocio,
        nomeUnidade: dados.nomesParticipaveis[vencedor.unidade] ?? unidade,
      })
    }
    return lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porSetor, ano, mes])

  return { carregando, vencedores }
}
