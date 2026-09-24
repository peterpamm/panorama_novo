import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'
import type { FinanceiroDreAjuste, FinanceiroDreAjusteIndicador } from '@/types'

/**
 * Ajustes manuais TEMPORÁRIOS de Multas/Vales do Financeiro (ver
 * `FinanceiroDreAjuste`, types/index.ts) — usado pela Reunião Resultados
 * (useReuniaoDados) e pela Remuneração Variável (useRvApuracao/
 * RvFinanceiroPage/PainelGeralRvPage/MatrizRvPage) do Financeiro.
 *
 * RLS (migration 113) deixa QUALQUER admin ler — precisa refletir em quem
 * quer que acesse essas telas, não só em quem lançou o ajuste (antes só o
 * dono lia, e o resto da equipe via a tela "furada" mesmo depois do ajuste
 * feito). Escrever (lançar/editar/remover) continua só do dono — os botões
 * de edição no app já são todos `souDono &&` (AcompanhamentoReuniaoTab.tsx,
 * RvApuracao.tsx), então a RLS de escrita só é uma segunda trava.
 *
 * `ativo` só existe pra não gerar request à toa em contexto que nunca usa
 * isso (ex: os outros 5 setores da Reunião Resultados) — não é mais um
 * controle de permissão (isso ficou só com a RLS).
 *
 * Sem filtro de ano na busca — tabela pequena (poucos meses/ajustes
 * enquanto o bug do DRE durar), não compensa a complexidade de refazer a
 * busca a cada troca de ano na tela.
 */
export function useFinanceiroDreAjustes(ativo: boolean) {
  const { toast } = useToast()
  const [ajustes, setAjustes] = useState<FinanceiroDreAjuste[]>([])
  const [carregando, setCarregando] = useState(ativo)

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase.from('financeiro_dre_ajustes_manuais').select('*')
    if (error) {
      toast({ title: 'Erro ao carregar ajustes de Multas/Vales', description: error.message, variant: 'destructive' })
      setCarregando(false)
      return
    }
    setAjustes((data as FinanceiroDreAjuste[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    if (ativo) carregar()
    else setCarregando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo])

  async function salvar(unidade: string, ano: number, mes: number, indicador: FinanceiroDreAjusteIndicador, valor: number, observacao: string): Promise<boolean> {
    const { error } = await supabase
      .from('financeiro_dre_ajustes_manuais')
      .upsert({ unidade, ano, mes, indicador, valor, observacao: observacao.trim() || null }, { onConflict: 'unidade,ano,mes,indicador' })
    if (error) {
      toast({ title: 'Erro ao salvar ajuste', description: error.message, variant: 'destructive' })
      return false
    }
    toast({ title: 'Ajuste salvo' })
    await carregar()
    return true
  }

  async function remover(id: string): Promise<boolean> {
    const { error } = await supabase.from('financeiro_dre_ajustes_manuais').delete().eq('id', id)
    if (error) {
      toast({ title: 'Erro ao remover ajuste', description: error.message, variant: 'destructive' })
      return false
    }
    toast({ title: 'Ajuste removido — voltou a usar o valor automático do DRE' })
    await carregar()
    return true
  }

  return { ajustes, carregando, salvar, remover }
}
