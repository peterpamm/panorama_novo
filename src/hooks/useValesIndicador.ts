import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { mesesAtivosNoAno } from '@/lib/farol-calculations'
import { unidadeSplitNegocio } from '@/lib/rv-gente'
import type { CelulaIndicador, LinhaIndicador } from '@/components/rv/TabelaIndicadorGenerica'
import type { MetaPerdaIndicador } from '@/types'

const PREFIXOS_VALES = ['052', '053']

interface ValesMeta {
  peso: number
  pct_meta: number
}

function fmtValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Indicador Vales — dispersão do DRE (contas 052/053, mesma conta do
 * indicador Vales do Painel de Perdas) vs % da Meta de Perdas de Vales
 * (metas_perdas_indicadores, anual/12) — mesma regra e mesmos números usados
 * na apuração da RV (`useRvApuracao.ts`, prop `valesPerdasTabela`).
 * Reaproveitado pelo seletor único de RV de Distribuição e do Financeiro,
 * cada uma com sua própria tabela de peso/% (`tabelaMeta`).
 *
 * Distribuição (DU) só responde pela Rota — nunca pelo Armazém (outra
 * liderança, sem ação sobre isso). Em unidade com split de verdade
 * (Camaçari: CDL = Rota, CDR = Armazém — ver `unidadeSplitNegocio`), usa
 * direto o DRE de ROTA quando `tabelaMeta` é Distribuição; Financeiro (e
 * unidade sem split) continua no consolidado (CONS) normal — mesma regra do
 * cálculo de pagamento, só que aqui é exibição (`AcompanhamentoFinanceiroTab`/
 * `AcompanhamentoDistribuicaoTab`, sem afetar quanto a liderança recebe).
 */
export function useValesIndicador(tabelaMeta: 'rv_vales_distribuicao_meta' | 'rv_vales_financeiro_meta', ano: number | null) {
  const { unidades } = useUnidades()
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])
  const dataEntradaPorUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.data_entrada])), [unidades])
  const { rows: rowsDre, loading: loadingDre } = useDreLongoTodasUnidades()

  const [metasPerdasVales, setMetasPerdasVales] = useState<MetaPerdaIndicador[]>([])
  const [valesMeta, setValesMeta] = useState<ValesMeta | null>(null)
  const [carregandoMeta, setCarregandoMeta] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregandoMeta(true)
      const [mp, vm] = await Promise.all([
        supabase.from('metas_perdas_indicadores').select('*').eq('indicador', 'vales'),
        supabase.from(tabelaMeta).select('*').maybeSingle(),
      ])
      setMetasPerdasVales((mp.data as MetaPerdaIndicador[]) ?? [])
      setValesMeta(vm.data as ValesMeta | null)
      setCarregandoMeta(false)
    }
    carregar()
  }, [tabelaMeta])

  const anosDisponiveis = useMemo(
    () => Array.from(new Set(rowsDre.filter(r => r.tipo_periodo === 'MENSAL').map(r => r.ano))).sort((a, b) => b - a),
    [rowsDre],
  )

  const linhas = useMemo<LinhaIndicador[]>(() => {
    if (ano === null) return []
    const mensalTodos = rowsDre.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === ano)
    if (mensalTodos.length === 0) return []

    // Enumera as unidades pelo CONS (toda unidade tem uma linha consolidada
    // importada, split ou não) — a escolha de qual negócio usar pra cada uma
    // vem depois, por unidade.
    const codigosUnidades = Array.from(new Set(mensalTodos.filter(r => r.negocio === 'CONS').map(r => r.unidade)))
      .sort((a, b) => {
        if (a === 'AMBEV') return 1
        if (b === 'AMBEV') return -1
        return (nomesUnidades.get(a) ?? a).localeCompare(nomesUnidades.get(b) ?? b)
      })

    return codigosUnidades.map(unidade => {
      const nome = nomesUnidades.get(unidade) ?? unidade
      const negocioAlvo = tabelaMeta === 'rv_vales_distribuicao_meta' && unidadeSplitNegocio(unidade, nome) ? 'ROTA' : 'CONS'
      const rowsUnidade = mensalTodos.filter(r => r.unidade === unidade && r.negocio === negocioAlvo)
      const metaPerdas = metasPerdasVales.find(m => m.unidade === unidade && m.ano === ano)
      const mesesAtivos = mesesAtivosNoAno(dataEntradaPorUnidade.get(unidade) ?? null, ano)
      const meses: (CelulaIndicador | null)[] = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1
        const rowsMes = rowsUnidade.filter(r => r.mes === mes)
        if (rowsMes.length === 0) return null
        const resultado = rowsMes
          .filter(r => PREFIXOS_VALES.some(p => r.conta_codigo.startsWith(p)))
          .reduce((acc, r) => acc + (r.diferenca ?? 0), 0)
        const meta = metaPerdas && valesMeta ? (metaPerdas.meta_anual / mesesAtivos) * (valesMeta.pct_meta / 100) : null
        return {
          texto: fmtValor(resultado),
          tooltip: meta !== null ? `Meta: R$ ${fmtValor(meta)}` : 'Sem Meta de Perdas de Vales cadastrada',
          bateu: meta !== null ? resultado >= meta : null,
        }
      })
      return { key: unidade, nome, destaque: unidade === 'AMBEV', meses }
    })
  }, [rowsDre, metasPerdasVales, valesMeta, ano, nomesUnidades, dataEntradaPorUnidade, tabelaMeta])

  return { linhas, carregando: loadingDre || carregandoMeta, anosDisponiveis }
}
