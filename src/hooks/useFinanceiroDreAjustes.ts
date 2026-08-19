import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'
import type { FinanceiroDreAjuste, FinanceiroDreAjusteIndicador } from '@/types'

/**
 * Ajustes manuais TEMPORÁRIOS de Multas/Vales do Financeiro (ver
 * `FinanceiroDreAjuste`, types/index.ts) — usado pela Reunião Resultados
 * (useReuniaoDados) e pela Remuneração Variável (useRvApuracao) do
 * Financeiro. RLS já restringe leitura/escrita ao dono (`auth_dono()`), então
 * pra qualquer outro usuário isso só busca uma lista vazia, sem erro — ainda
 * assim só busca quando `ativo` (setor === 'financeiro'), pra não gerar
 * request à toa nos outros 5 setores da Reunião Resultados/RV.
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
