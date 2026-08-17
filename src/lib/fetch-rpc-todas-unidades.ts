import { supabase } from '@/lib/supabase'

const PAGE = 10000
const CONCURRENT = 5

/**
 * Busca uma RPC "sem restrição de unidade" (SECURITY DEFINER, ver
 * migrations 093/094 — usadas pelo Ranking e pelo Farol Gerentes, as duas
 * páginas do app que mostram todas as unidades pra qualquer usuário
 * logado), unidade por unidade — mesmo padrão/motivo de `fetchPorUnidade`
 * em DataContext.tsx (`.range()` sem `.order()` não tem ordem garantida
 * entre duas chamadas separadas, então pagina de forma determinística por
 * unidade, em vez de OFFSET numérico crescente).
 */
export async function fetchRpcPorUnidade<T>(
  funcao: string,
  params: Record<string, unknown> | undefined,
  codigosUnidades: string[],
  colunasOrdem: string[],
): Promise<T[]> {
  async function buscarUnidade(codigo: string): Promise<T[]> {
    const linhasUnidade: T[] = []
    let pagina = 0
    let acabou = false
    while (!acabou) {
      let query = supabase.rpc(funcao, params).eq('unidade', codigo)
      for (const coluna of colunasOrdem) query = query.order(coluna, { ascending: true })
      const { data, error } = await query.range(pagina * PAGE, (pagina + 1) * PAGE - 1)
      if (error) throw error
      const dados = data as T[]
      linhasUnidade.push(...dados)
      if (dados.length < PAGE) acabou = true
      pagina++
    }
    return linhasUnidade
  }

  const linhas: T[] = []
  for (let i = 0; i < codigosUnidades.length; i += CONCURRENT) {
    const resultados = await Promise.all(codigosUnidades.slice(i, i + CONCURRENT).map(buscarUnidade))
    for (const r of resultados) linhas.push(...r)
  }
  return linhas
}
