import * as XLSX from 'xlsx'
import { negocioPorPrefixo } from '@/lib/unidade-resolver'

/** Contagem agregada de uma unidade a partir da planilha de GSD, colaborador por colaborador. */
export interface GsdUnidadeAgregado {
  /** Texto de "Filial" como veio na planilha (ex: "CDD ARACAJU"). */
  filial: string
  /** ROTA (prefixo CDL) / ARM (prefixo CDR) / CONS nas demais — Camaçari abre CDL e CDR como filiais separadas. */
  negocio: string
  totalColaboradores: number
  /** Colaboradores com Status "FORA DO PRAZO". */
  foraDoPrazo: number
  /** (total − fora do prazo) / total × 100. */
  pctDentroPrazo: number
}

export interface ParseGsdResultado {
  agregados: GsdUnidadeAgregado[]
  erros: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/**
 * Planilha de GSD por colaborador (colunas Filial, Colaborador, Função,
 * Admissão, Data Último, Data Limite, Status, Dias Falta) — usamos só Filial
 * (pra agrupar) e Status ("FORA DO PRAZO" = atrasado). Cada linha é um
 * colaborador; agregamos por unidade. Diferente do DTO T1, aqui todas as
 * unidades da planilha entram (sem restrição de operação).
 */
function parseMatriz(matriz: unknown[][]): ParseGsdResultado {
  if (matriz.length === 0) return { agregados: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iFilial = header.findIndex(h => h === 'FILIAL')
  const iStatus = header.findIndex(h => h === 'STATUS')

  if (iFilial === -1 || iStatus === -1) {
    return { agregados: [], erros: ['Cabeçalho inválido — esperado colunas Filial e Status'] }
  }

  const porFilial = new Map<string, { total: number; foraDoPrazo: number }>()

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const filial = toStr(cols[iFilial]).toUpperCase()
    if (!filial) continue

    const atual = porFilial.get(filial) ?? { total: 0, foraDoPrazo: 0 }
    atual.total += 1
    if (normalizar(toStr(cols[iStatus])) === 'FORA DO PRAZO') atual.foraDoPrazo += 1
    porFilial.set(filial, atual)
  }

  const agregados: GsdUnidadeAgregado[] = Array.from(porFilial.entries()).map(([filial, { total, foraDoPrazo }]) => ({
    filial,
    negocio: negocioPorPrefixo(filial),
    totalColaboradores: total,
    foraDoPrazo,
    pctDentroPrazo: total > 0 ? ((total - foraDoPrazo) / total) * 100 : 0,
  }))

  return { agregados, erros: [] }
}

/** Lê o CSV (separador ; ou tab). */
export function parseGsdCsv(texto: string): ParseGsdResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { agregados: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/** Lê a planilha Excel (.xlsx/.xls) — usa a primeira aba. */
export async function parseGsdXlsx(file: File): Promise<ParseGsdResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { agregados: [], erros: ['Arquivo Excel sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseGsdFile(file: File): Promise<ParseGsdResultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseGsdXlsx(file)
  return parseGsdCsv(await file.text())
}
