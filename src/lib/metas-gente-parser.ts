import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'

/** Linha do arquivo: um indicador × operação com os 12 meses (null = sem dado: "-", "NA" ou vazio). */
export interface ParsedMetaGenteRow {
  indicador: string
  /** Nome da operação como veio no arquivo (ainda não resolvido pra unidade). */
  operacao: string
  /** Índice 0 = JAN ... 11 = DEZ. */
  valores: (number | null)[]
}

export interface ParseMetasGenteResultado {
  linhas: ParsedMetaGenteRow[]
  erros: string[]
}

const MESES_HEADER = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/** "96,75" → 96.75; número do Excel passa direto; "-", "NA" e vazio viram null. */
function parseValorMes(raw: unknown): number | null {
  if (typeof raw === 'number') return raw
  const str = toStr(raw)
  if (str === '' || str === '-' || normalizar(str) === 'na') return null
  const n = parseNumeroPtBr(str)
  return n === 0 && !/^0[,.]?0*$/.test(str) ? null : n
}

function parseMatriz(matriz: unknown[][]): ParseMetasGenteResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iIndicador = header.indexOf('indicador')
  const iOperacao = header.findIndex(h => h === 'operacao' || h === 'unidade')
  const indicesMeses = MESES_HEADER.map(m => header.findIndex(h => h.startsWith(m)))

  if (iIndicador === -1 || iOperacao === -1 || indicesMeses.some(i => i === -1)) {
    return { linhas: [], erros: ['Cabeçalho inválido — esperado: INDICADOR | OPERAÇÃO | JAN | FEV | ... | DEZ'] }
  }

  const linhas: ParsedMetaGenteRow[] = []
  const erros: string[] = []

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const indicador = toStr(cols[iIndicador]).toUpperCase()
    const operacao = toStr(cols[iOperacao]).toUpperCase()
    if (!indicador || !operacao) {
      erros.push(`Linha ${i + 1}: indicador ou operação vazio`)
      continue
    }

    linhas.push({
      indicador,
      operacao,
      valores: indicesMeses.map(idx => parseValorMes(cols[idx])),
    })
  }

  return { linhas, erros }
}

/** Lê o CSV (separador ; ou tab). */
export function parseMetasGenteCsv(texto: string): ParseMetasGenteResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/** Lê a planilha Excel (.xlsx/.xls) — usa a primeira aba. */
export async function parseMetasGenteXlsx(file: File): Promise<ParseMetasGenteResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { linhas: [], erros: ['Arquivo Excel sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseMetasGenteFile(file: File): Promise<ParseMetasGenteResultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseMetasGenteXlsx(file)
  return parseMetasGenteCsv(await file.text())
}
