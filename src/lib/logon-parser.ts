import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'
import { negocioPorPrefixo } from '@/lib/unidade-resolver'

/** Linha da planilha do LogOn: unidade + % de Aderência Total da Trilha. */
export interface ParsedLogonRow {
  unidade: string
  /** ROTA (prefixo CDL) / ARM (prefixo CDR) / CONS nas demais. */
  negocio: string
  /** Aderência Total da Trilha, 0-100. */
  valor: number
}

export interface ParseLogonResultado {
  linhas: ParsedLogonRow[]
  erros: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/**
 * "90%" → 90; número puro do Excel formatado como percentual vem em fração
 * (0.9) — nesse caso multiplica por 100. Acima de 1 assume que já veio em
 * pontos percentuais (ex: 90 direto).
 */
function parsePercentual(raw: unknown): number | null {
  if (typeof raw === 'number') return raw <= 1 ? raw * 100 : raw
  const str = toStr(raw).replace('%', '').trim()
  if (str === '') return null
  const n = parseNumeroPtBr(str)
  return Number.isNaN(n) ? null : n
}

/**
 * Planilha do LogOn (Unidade, Participantes Únicos, Não Entregou todos os
 * Cursos, Entregou todos os Cursos, Aderência Total da Trilha) — já vem
 * agregada por unidade, então usamos só Unidade e Aderência Total da Trilha,
 * sem precisar calcular colaborador por colaborador (diferente do GSD/DTO T1).
 */
function parseMatriz(matriz: unknown[][]): ParseLogonResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iUnidade = header.findIndex(h => h === 'UNIDADE')
  const iAderencia = header.findIndex(h => h === 'ADERENCIA TOTAL DA TRILHA')

  if (iUnidade === -1 || iAderencia === -1) {
    return { linhas: [], erros: ['Cabeçalho inválido — esperado colunas Unidade e Aderência Total da Trilha'] }
  }

  const linhas: ParsedLogonRow[] = []
  const erros: string[] = []

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const unidade = toStr(cols[iUnidade]).toUpperCase()
    if (!unidade) continue

    const valor = parsePercentual(cols[iAderencia])
    if (valor === null) {
      erros.push(`Linha ${i + 1}: valor de Aderência Total da Trilha inválido para "${unidade}"`)
      continue
    }
    linhas.push({ unidade, negocio: negocioPorPrefixo(unidade), valor })
  }

  return { linhas, erros }
}

/** Lê o CSV (separador ; ou tab). */
export function parseLogonCsv(texto: string): ParseLogonResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/** Lê a planilha Excel (.xlsx/.xls) — usa a primeira aba. */
export async function parseLogonXlsx(file: File): Promise<ParseLogonResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { linhas: [], erros: ['Arquivo Excel sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseLogonFile(file: File): Promise<ParseLogonResultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseLogonXlsx(file)
  return parseLogonCsv(await file.text())
}
