import * as XLSX from 'xlsx'

/**
 * Modelos de planilha das telas de importação — o arquivo que o usuário baixa
 * quando tem dúvida do formato esperado.
 *
 * O modelo é MONTADO NA HORA, no navegador, com o mesmo SheetJS que lê os
 * arquivos importados: nada é guardado no Supabase nem em nuvem nenhuma. A
 * vantagem sobre hospedar um .xlsx fixo (Drive etc) é que o modelo mora ao
 * lado do parser — mudou a coluna que o parser espera, muda aqui junto, sem
 * um arquivo velho circulando por aí ensinando um formato que o código não
 * aceita mais.
 */
export interface AbaModelo {
  nome: string
  /** Primeira linha = cabeçalho; as demais são exemplos preenchidos. */
  linhas: (string | number)[][]
}

/** Monta o workbook do modelo (separado do download pra poder testar). */
export function montarWorkbookModelo(abas: AbaModelo[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  for (const aba of abas) {
    const sheet = XLSX.utils.aoa_to_sheet(aba.linhas)
    // Largura fixa e generosa: sem isso o Excel abre tudo com ~8 caracteres e
    // o cabeçalho fica cortado, que é justamente o que o modelo quer mostrar.
    sheet['!cols'] = (aba.linhas[0] ?? []).map(() => ({ wch: 22 }))
    // Nome de aba no Excel: máximo 31 caracteres, sem : \ / ? * [ ]
    XLSX.utils.book_append_sheet(wb, sheet, aba.nome.replace(/[:\\/?*[\]]/g, '').slice(0, 31))
  }
  return wb
}

/** Monta e baixa o modelo. `nomeArquivo` sem extensão. */
export function baixarModeloXlsx(nomeArquivo: string, abas: AbaModelo[]): void {
  XLSX.writeFile(montarWorkbookModelo(abas), `${nomeArquivo}.xlsx`)
}

/**
 * Monta e baixa o modelo como .csv (telas que importam .csv em vez de
 * .xlsx — ex: Indisponibilidade/Devolução) — não tem conceito de "aba",
 * então recebe uma única `AbaModelo` e ignora o campo `nome`. `separador`
 * default `;` (padrão dos .csv herdados do painel antigo nesse app).
 */
export function baixarModeloCsv(nomeArquivo: string, aba: AbaModelo, separador = ';'): void {
  const texto = aba.linhas.map(linha => linha.join(separador)).join('\r\n')
  const blob = new Blob([texto], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${nomeArquivo}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
