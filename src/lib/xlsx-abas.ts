import * as XLSX from 'xlsx'

/**
 * Utilitários de aba de planilha, compartilhados pelos importadores que
 * recebem arquivos com mais de uma aba — hoje a planilha de metas do Armazém,
 * que traz T1 e T2 lado a lado ("RV ARM _T1" / "RV ARM _T2"). Ler sempre a
 * primeira aba, como era antes, importava as metas do tier errado em silêncio.
 */

/** Nomes das abas do arquivo — vazio pra CSV, que não tem aba. Lê só o índice (`bookSheets`), sem carregar as células. */
export async function listarAbasXlsx(file: File): Promise<string[]> {
  if (!/\.xlsx?$/i.test(file.name)) return []
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', bookSheets: true })
  return wb.SheetNames
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '')
}

/**
 * Aba que melhor casa com uma pista (ex: "T2" casa com "RV ARM _T2"),
 * caindo na primeira quando nada casa. É só o palpite que pré-seleciona o
 * campo — quem manda é a escolha feita na tela.
 */
export function abaSugerida(abas: string[], pista: string): string | undefined {
  const alvo = normalizar(pista)
  return abas.find(a => normalizar(a).includes(alvo)) ?? abas[0]
}

/**
 * Lê uma aba em dois formatos alinhados por posição: valores brutos (número
 * ou texto original da célula) e o texto formatado — o que aparece na tela
 * do Excel (SheetJS já resolve o número segundo o formato da célula, `.w`).
 *
 * Existe pra colunas de duração (TMA): a mesma coluna pode trazer meses com
 * mais de uma codificação numérica — fração do dia (0,0625 = 1h30) num mês,
 * um inteiro com formato customizado tipo "00:00" (que embute HHMM: 131 →
 * "01:31") no mês seguinte, na mesma planilha. O valor bruto sozinho não dá
 * pra saber qual das duas é sem adivinhar; o texto formatado sempre bate com
 * o que a planilha mostra, então elimina a ambiguidade — ver
 * `armazem-resultado-parser.ts`/`armazem-t1-meta-parser.ts`.
 */
export function lerAbaBrutaEFormatada(sheet: XLSX.WorkSheet): { bruta: unknown[][]; formatada: unknown[][] } {
  return {
    bruta: XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }),
    formatada: XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false }),
  }
}
