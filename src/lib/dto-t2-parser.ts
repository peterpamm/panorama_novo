import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'

/** Linha do arquivo do BI: operação (nome da unidade) + % Realizado do indicador DTO T2. */
export interface ParsedDtoT2Row {
  operacao: string
  /** % Realizado, 0-100. */
  valor: number
}

export interface ParseDtoT2Resultado {
  linhas: ParsedDtoT2Row[]
  erros: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/**
 * "52,17 %" → 52.17; número puro do Excel formatado como percentual vem em
 * fração (0.5217) — nesse caso multiplica por 100. Acima de 1 assume que já
 * veio em pontos percentuais (ex: 52.17 direto).
 */
function parsePercentual(raw: unknown): number | null {
  if (typeof raw === 'number') return raw <= 1 ? raw * 100 : raw
  const str = toStr(raw).replace('%', '').trim()
  if (str === '') return null
  const n = parseNumeroPtBr(str)
  return Number.isNaN(n) ? null : n
}

/**
 * A planilha do BI tem colunas repetidas (várias métricas com "Realizado" e
 * "% Realizado"); a que usamos é a do indicador DTO T2, identificada pelo
 * cabeçalho "% Realizado_" (com underscore, como exportado pelo BI) — a
 * primeira ocorrência de "% REALIZADO..." depois da coluna Operação.
 */
function parseMatriz(matriz: unknown[][]): ParseDtoT2Resultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iOperacao = header.findIndex(h => h === 'OPERACAO')
  const iRealizado = header.findIndex((h, i) => i > iOperacao && h.startsWith('% REALIZADO'))

  if (iOperacao === -1 || iRealizado === -1) {
    return { linhas: [], erros: ['Cabeçalho inválido — esperado colunas OPERAÇÃO e % REALIZADO_'] }
  }

  const linhas: ParsedDtoT2Row[] = []
  const erros: string[] = []

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const operacao = toStr(cols[iOperacao]).toUpperCase()
    if (!operacao) continue

    const valor = parsePercentual(cols[iRealizado])
    if (valor === null) {
      erros.push(`Linha ${i + 1}: valor de % Realizado inválido para "${operacao}"`)
      continue
    }
    linhas.push({ operacao, valor })
  }

  return { linhas, erros }
}

/** Lê o CSV (separador ; ou tab). */
export function parseDtoT2Csv(texto: string): ParseDtoT2Resultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/** Lê a planilha Excel (.xlsx/.xls) — usa a primeira aba. */
export async function parseDtoT2Xlsx(file: File): Promise<ParseDtoT2Resultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { linhas: [], erros: ['Arquivo Excel sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseDtoT2File(file: File): Promise<ParseDtoT2Resultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseDtoT2Xlsx(file)
  return parseDtoT2Csv(await file.text())
}
