import * as XLSX from 'xlsx'

export interface PlanilhaExportacao {
  /** Nome da aba no Excel — máximo 31 caracteres, sem : \ / ? * [ ] (mesma regra de `modelo-planilha.ts`). */
  nome: string
  /** Uma linha = um objeto; a chave de cada campo vira o cabeçalho da coluna. */
  linhas: Record<string, string | number>[]
}

/**
 * Exporta uma tela do SDG Corporativo de Frota pra Excel, podendo ter várias
 * abas (Indicadores/Pareto/Comparativo/Detalhe) — diferente do padrão de
 * hoje no resto do app (cada página monta seu próprio `exportarExcel` só com
 * uma aba, ex: `MatrizRvPage.tsx`), aqui um helper único evita repetir o
 * boilerplate do `xlsx` pra cada uma das até 4 abas de cada uma das 4 telas.
 * `nomeArquivo` sem extensão.
 */
export function exportarSlideFrotaExcel(nomeArquivo: string, planilhas: PlanilhaExportacao[]): void {
  const wb = XLSX.utils.book_new()
  for (const p of planilhas) {
    if (p.linhas.length === 0) continue
    const sheet = XLSX.utils.json_to_sheet(p.linhas)
    XLSX.utils.book_append_sheet(wb, sheet, p.nome.replace(/[:\\/?*[\]]/g, '').slice(0, 31))
  }
  XLSX.writeFile(wb, `${nomeArquivo}.xlsx`)
}
