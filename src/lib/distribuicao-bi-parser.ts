import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'
import { negocioPorPrefixo } from '@/lib/unidade-resolver'

export type DistribuicaoBiIndicador = 'aderencia_logon_du' | 'devolucao_pdv' | 'presenteismo_du'

/** Lista dos indicadores reconhecidos nessa planilha compartilhada — novos indicadores entram aqui + em `identificarIndicador`. */
export const DISTRIBUICAO_BI_INDICADORES: { key: DistribuicaoBiIndicador; nome: string }[] = [
  { key: 'aderencia_logon_du', nome: 'LogOn DU' },
  { key: 'devolucao_pdv', nome: 'Devolução' },
  { key: 'presenteismo_du', nome: 'Presenteísmo DU' },
]

/** Linha da planilha: indicador (já identificado) + unidade + resultado (%). */
export interface ParsedDistribuicaoBiRow {
  indicador: DistribuicaoBiIndicador
  /** Nome da unidade, já sem o código numérico do BI (ex: "143 - CDD Beltrao" → "CDD BELTRAO"). */
  unidade: string
  /** ROTA (prefixo CDL) / ARM (prefixo CDR) / CONS nas demais. */
  negocio: string
  valor: number
}

export interface ParseDistribuicaoBiResultado {
  linhas: ParsedDistribuicaoBiRow[]
  erros: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/** "96%" → 96; número do Excel formatado como percentual vem em fração (0,96) — nesse caso multiplica por 100. */
function parsePercentual(raw: unknown): number | null {
  if (typeof raw === 'number') return raw <= 1 ? raw * 100 : raw
  const str = toStr(raw).replace('%', '').trim()
  if (str === '') return null
  const n = parseNumeroPtBr(str)
  return Number.isNaN(n) ? null : n
}

/** Identifica o indicador pelo rótulo da coluna INDICADOR — por prefixo normalizado, tolera variação de acento/ortografia. */
function identificarIndicador(label: string): DistribuicaoBiIndicador | null {
  const norm = normalizar(label)
  if (norm.startsWith('ADERENCIA LOGON')) return 'aderencia_logon_du'
  if (norm.startsWith('DEVOLUCAO')) return 'devolucao_pdv'
  if (norm.startsWith('PRESENTEISMO')) return 'presenteismo_du'
  return null
}

/** "143 - CDD Beltrao" → "CDD BELTRAO" — algumas linhas trazem o código numérico do BI na frente do nome. */
function semCodigoNumerico(unidade: string): string {
  return unidade.replace(/^\d+\s*-\s*/, '').trim()
}

function parseMatriz(matriz: unknown[][]): ParseDistribuicaoBiResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iIndicador = header.findIndex(h => h === 'INDICADOR')
  const iUnidade = header.findIndex(h => h === 'UNIDADE')
  const iResultado = header.findIndex(h => h === 'RESULTADO')

  if (iIndicador === -1 || iUnidade === -1 || iResultado === -1) {
    return { linhas: [], erros: ['Cabeçalho inválido — esperado colunas INDICADOR, UNIDADE e RESULTADO'] }
  }

  const linhas: ParsedDistribuicaoBiRow[] = []
  const erros: string[] = []

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const indicador = identificarIndicador(toStr(cols[iIndicador]))
    if (!indicador) continue // linha de um indicador que essa tela ainda não trata — ignora sem erro

    const unidade = semCodigoNumerico(toStr(cols[iUnidade])).toUpperCase()
    if (!unidade) continue

    const valor = parsePercentual(cols[iResultado])
    if (valor === null) {
      erros.push(`Linha ${i + 1}: resultado inválido para "${unidade}"`)
      continue
    }

    linhas.push({ indicador, unidade, negocio: negocioPorPrefixo(unidade), valor })
  }

  return { linhas, erros }
}

/** Lê o CSV (separador ; ou tab). */
export function parseDistribuicaoBiCsv(texto: string): ParseDistribuicaoBiResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/** Lê a planilha Excel (.xlsx/.xls) — usa a primeira aba. */
export async function parseDistribuicaoBiXlsx(file: File): Promise<ParseDistribuicaoBiResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { linhas: [], erros: ['Arquivo Excel sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseDistribuicaoBiFile(file: File): Promise<ParseDistribuicaoBiResultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseDistribuicaoBiXlsx(file)
  return parseDistribuicaoBiCsv(await file.text())
}
