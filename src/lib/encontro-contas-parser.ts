import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'

/** Linha da planilha de Encontro de Contas — Data/Descrição/Valor; chamado e solicitante extraídos da Descrição. */
export interface ParsedEncontroContasRow {
  data: string // 'YYYY-MM-DD'
  descricaoOriginal: string
  numeroChamado: string
  solicitante: string
  valor: number
}

export interface ParseEncontroContasResultado {
  linhas: ParsedEncontroContasRow[]
  erros: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/** "EC - R14602322 - Vinicius Etges Silveira" → { numeroChamado: "R14602322", solicitante: "Vinicius Etges Silveira" }. */
const PADRAO_DESCRICAO = /^EC\s*-\s*(R\d+)\s*-\s*(.+)$/i

function parseValor(raw: unknown): number | null {
  if (typeof raw === 'number') return raw
  const str = toStr(raw)
  if (str === '') return null
  if (!/^-?[\d.,]+$/.test(str)) return null
  return parseNumeroPtBr(str)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Célula Excel formatada como data já vem como `Date` (lida com `cellDates: true`) — usa as partes locais, nunca `toISOString()` (desloca fuso). Também aceita texto "DD/MM/AAAA" ou "AAAA-MM-DD". */
function parseData(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return `${raw.getFullYear()}-${pad2(raw.getMonth() + 1)}-${pad2(raw.getDate())}`
  }
  const str = toStr(raw)
  if (str === '') return null
  const br = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) return validarData(Number(br[3]), Number(br[2]), Number(br[1]))
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return validarData(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  return null
}

function validarData(ano: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return `${ano}-${pad2(mes)}-${pad2(dia)}`
}

const HEADERS = ['DATA', 'DESCRICAO', 'VALOR']

/**
 * Planilha de Importação do Encontro de Contas — colunas Data/Descrição/
 * Valor. A unidade NÃO vem da planilha (é atribuída depois, na aba
 * Tratativas — um EC pode ser de mais de uma unidade, aí se desmembra).
 * Descrição segue o padrão "EC - R14602322 - Nome do solicitante".
 */
export function parseEncontroContasMatriz(matriz: unknown[][]): ParseEncontroContasResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const iHeader = matriz.findIndex(row => row.some(c => normalizar(toStr(c)) === 'DESCRICAO'))
  if (iHeader === -1) return { linhas: [], erros: ['Cabeçalho não encontrado — esperado colunas Data, Descrição e Valor'] }

  const header = matriz[iHeader].map(c => normalizar(toStr(c)))
  const iData = header.findIndex(h => h === 'DATA')
  const iDescricao = header.findIndex(h => h === 'DESCRICAO')
  const iValor = header.findIndex(h => h === 'VALOR')
  if (iData === -1 || iDescricao === -1 || iValor === -1) {
    return { linhas: [], erros: [`Cabeçalho inválido — esperado colunas: ${HEADERS.join(', ')}`] }
  }

  const linhas: ParsedEncontroContasRow[] = []
  const erros: string[] = []

  for (let i = iHeader + 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const descricaoOriginal = toStr(cols[iDescricao])
    if (!descricaoOriginal) continue

    const data = parseData(cols[iData])
    const valor = parseValor(cols[iValor])
    const match = descricaoOriginal.match(PADRAO_DESCRICAO)

    if (data === null) { erros.push(`Linha ${i + 1}: data inválida ("${toStr(cols[iData])}")`); continue }
    if (valor === null) { erros.push(`Linha ${i + 1}: valor inválido ("${toStr(cols[iValor])}")`); continue }
    if (!match) { erros.push(`Linha ${i + 1}: descrição fora do padrão "EC - <chamado> - <nome>" ("${descricaoOriginal}")`); continue }

    linhas.push({ data, descricaoOriginal, numeroChamado: match[1].toUpperCase(), solicitante: match[2].trim(), valor })
  }

  return { linhas, erros }
}

/** Lê a planilha Excel/CSV — a aba é sempre a primeira. `cellDates: true` faz o XLSX já entregar a coluna Data como `Date`, em vez do serial numérico do Excel. */
export async function parseEncontroContasFile(file: File): Promise<ParseEncontroContasResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { linhas: [], erros: ['Arquivo sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseEncontroContasMatriz(matriz)
}
