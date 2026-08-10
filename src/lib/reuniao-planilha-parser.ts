import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'
import { parseDuracaoParaMinutos } from '@/lib/duracao'
import type { ReuniaoFormato } from '@/types'

/**
 * Linha da planilha padrão de Reunião Resultados — meta/resultado/pontos já
 * prontos, o app só guarda. `meta`/`resultado` ficam com o valor BRUTO da
 * célula (número ou texto) — a conversão final pro número guardado só
 * acontece depois de resolver o indicador (ver `resolverValorImportado`),
 * porque uma célula de duração (ex: "01:30" ou a fração de dia que o Excel
 * guarda por trás) só faz sentido convertida sabendo que o formato do
 * indicador é "duracao"; convertida como número puro, vira um valor sem
 * nexo (0,6 em vez de 90 minutos).
 */
export interface ParsedPlanilhaRow {
  unidade: string
  indicador: string
  meta: unknown
  resultado: unknown
  pontos: number
}

export interface ParsePlanilhaResultado {
  linhas: ParsedPlanilhaRow[]
  erros: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/** `parseNumeroPtBr` devolve 0 pra texto que não é número — aqui precisamos distinguir "não é número" de erro real, então valida o formato antes de converter. */
function parseValor(raw: unknown): number | null {
  if (typeof raw === 'number') return raw
  const str = toStr(raw)
  if (str === '') return null
  if (!/^-?[\d.,]+$/.test(str)) return null
  return parseNumeroPtBr(str)
}

/**
 * Converte o valor bruto de uma célula (META ou RESULT) pro número guardado,
 * já sabendo o formato do indicador resolvido — "duracao" usa
 * `parseDuracaoParaMinutos` (célula Excel de duração vem como fração do dia,
 * ex: 0,0625 = 1h30; ou texto "01:30"), os demais formatos usam o parser
 * numérico genérico. Retorna null pra valor vazio/inválido.
 */
export function resolverValorImportado(raw: unknown, formato: ReuniaoFormato): number | null {
  if (formato === 'duracao') return parseDuracaoParaMinutos(raw)
  return parseValor(raw)
}

/**
 * Planilha padrão de Reunião Resultados (`Import_RR - Arm&DU.xlsx` e afins,
 * uma aba por setor) — colunas UNIDADE/INDICADOR/META/PESO/RESULT/PTS, meta
 * e pontuação já prontos (o app nunca calcula, só guarda). A planilha real
 * tem uma linha de título (o mês) acima do cabeçalho de verdade, então
 * escaneia as primeiras linhas procurando a que tem "UNIDADE" em vez de
 * assumir que é a linha 0. PESO é só informativo (já está cadastrado como
 * `pontos` do indicador) — não é lido. Pula linhas sem RESULT ou PTS
 * preenchido (ainda não apurado nesse mês); META pode ficar em branco
 * (unidade sem meta cadastrada nesse indicador).
 */
export function parsePlanilhaReuniaoMatriz(matriz: unknown[][]): ParsePlanilhaResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const iHeader = matriz.findIndex(row => row.some(c => normalizar(toStr(c)) === 'UNIDADE'))
  if (iHeader === -1) return { linhas: [], erros: ['Cabeçalho não encontrado — esperado uma coluna "Unidade"'] }

  const header = matriz[iHeader].map(c => normalizar(toStr(c)))
  const iUnidade = header.findIndex(h => h === 'UNIDADE')
  const iIndicador = header.findIndex(h => h === 'INDICADOR')
  const iMeta = header.findIndex(h => h === 'META')
  const iResult = header.findIndex(h => h === 'RESULT')
  const iPts = header.findIndex(h => h === 'PTS')

  if (iIndicador === -1 || iResult === -1 || iPts === -1) {
    return { linhas: [], erros: ['Cabeçalho inválido — esperado colunas Unidade, Indicador, Meta, Result e Pts'] }
  }

  const linhas: ParsedPlanilhaRow[] = []
  const erros: string[] = []

  for (let i = iHeader + 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const unidade = toStr(cols[iUnidade]).toUpperCase()
    const indicador = toStr(cols[iIndicador]).toUpperCase()
    if (!unidade || !indicador) continue

    if (toStr(cols[iResult]) === '' || toStr(cols[iPts]) === '') continue // ainda não apurado nesse mês

    const pontos = parseValor(cols[iPts])
    if (pontos === null) {
      erros.push(`Linha ${i + 1}: pontos inválido para "${unidade}" / "${indicador}"`)
      continue
    }
    const resultado = cols[iResult]
    const meta = iMeta !== -1 && toStr(cols[iMeta]) !== '' ? cols[iMeta] : null

    linhas.push({ unidade, indicador, meta, resultado, pontos })
  }

  return { linhas, erros }
}

/** Lê a planilha Excel (.xlsx/.xls) — a aba é escolhida por nome (uma por setor, ex: "Import RR_DU"). */
export async function parsePlanilhaReuniaoXlsx(file: File, nomeAba: string): Promise<ParsePlanilhaResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[nomeAba]
  if (!sheet) return { linhas: [], erros: [`Aba "${nomeAba}" não encontrada no arquivo — abas disponíveis: ${wb.SheetNames.join(', ')}`] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parsePlanilhaReuniaoMatriz(matriz)
}
