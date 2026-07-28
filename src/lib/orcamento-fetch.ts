import type { OrcamentoLinha } from '@/types'

const PAGE_SIZE = 1000

/**
 * Busca todas as linhas de `orcamentos` que passam pelo filtro dado,
 * paginando em blocos de 1000 (limite do Supabase por request) — uma única
 * unidade/negócio/ano já passa de 1000 linhas (155 contas × até 15 "meses"
 * contando os blocos de semestre e o total), e um ano inteiro com todas as
 * unidades passa de 50 mil.
 */
export async function fetchOrcamentoPaginado(
  montarPagina: (from: number, to: number) => PromiseLike<{ data: OrcamentoLinha[] | null; error: { message: string } | null }>,
): Promise<OrcamentoLinha[]> {
  const linhas: OrcamentoLinha[] = []
  let from = 0
  for (;;) {
    const { data, error } = await montarPagina(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    linhas.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return linhas
}
