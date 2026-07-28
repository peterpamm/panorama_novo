import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'
import { negocioPorPrefixo } from '@/lib/unidade-resolver'
import { parseDuracaoParaMinutos } from '@/lib/duracao'

export type ArmazemT1BiIndicador = 'tma' | 'disponibilidade_gente' | 'presenteismo_al'

/** Só ESTÂNCIA e CDR BAHIA se enquadram no Armazém T1 — mesma restrição do DTO T1. */
export const OPERACOES_ARMAZEM_T1 = ['ESTÂNCIA', 'CDR BAHIA']

/** Lista dos indicadores reconhecidos nessa planilha compartilhada — novos indicadores entram aqui + em `identificarIndicador`. */
export const ARMAZEM_T1_BI_INDICADORES: { key: ArmazemT1BiIndicador; nome: string }[] = [
  { key: 'tma', nome: 'TMA' },
  { key: 'disponibilidade_gente', nome: 'Disponibilidade de Gente' },
  { key: 'presenteismo_al', nome: 'Presenteísmo AL' },
]

const MESES_HEADER = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

/** Linha da planilha: indicador (já identificado) + unidade + resultado. */
export interface ParsedArmazemT1BiRow {
  indicador: ArmazemT1BiIndicador
  /** Nome da unidade, já sem o código numérico do BI (ex: "143 - CDR Bahia" → "CDR BAHIA"). */
  unidade: string
  /** ROTA (prefixo CDL) / ARM (prefixo CDR) / CONS nas demais. */
  negocio: string
  valor: number
  /** Só no formato histórico (colunas de mês, ex: JAN/FEV/MAR) — mês desse valor. Ausente no formato RESULTADO, que usa o mês escolhido na tela. */
  mes?: number
}

export interface ParseArmazemT1BiResultado {
  linhas: ParsedArmazemT1BiRow[]
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
function identificarIndicador(label: string): ArmazemT1BiIndicador | null {
  const norm = normalizar(label)
  if (norm.startsWith('TMA')) return 'tma'
  if (norm.startsWith('DISPONIBILIDADE')) return 'disponibilidade_gente'
  if (norm.startsWith('PRESENTEISMO')) return 'presenteismo_al'
  return null
}

/** "143 - CDR Bahia" → "CDR BAHIA" — algumas linhas trazem o código numérico do BI na frente do nome. */
function semCodigoNumerico(unidade: string): string {
  return unidade.replace(/^\d+\s*-\s*/, '').trim()
}

/** TMA é duração (HH:MM → minutos, ver src/lib/duracao.ts); os demais indicadores são percentuais. */
function parseValor(raw: unknown, indicador: ArmazemT1BiIndicador): number | null {
  return indicador === 'tma' ? parseDuracaoParaMinutos(raw) : parsePercentual(raw)
}

/**
 * Aceita dois formatos de planilha:
 * - INDICADOR · UNIDADE · RESULTADO — resultado de um único mês (escolhido na tela).
 * - INDICADOR · UNIDADE · JAN · FEV · ... — histórico, um valor por mês presente na planilha
 *   (usado só na primeira importação, pra trazer os meses já fechados de uma vez).
 */
function parseMatriz(matriz: unknown[][]): ParseArmazemT1BiResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iIndicador = header.findIndex(h => h === 'INDICADOR')
  const iUnidade = header.findIndex(h => h === 'UNIDADE')
  const iResultado = header.findIndex(h => h === 'RESULTADO')
  const colunasMes = MESES_HEADER
    .map((label, idx) => ({ mes: idx + 1, i: header.findIndex(h => h === label) }))
    .filter(c => c.i !== -1)

  if (iIndicador === -1 || iUnidade === -1 || (iResultado === -1 && colunasMes.length === 0)) {
    return { linhas: [], erros: ['Cabeçalho inválido — esperado colunas INDICADOR, UNIDADE e RESULTADO (ou colunas de mês: JAN, FEV, ...)'] }
  }

  const linhas: ParsedArmazemT1BiRow[] = []
  const erros: string[] = []

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const indicador = identificarIndicador(toStr(cols[iIndicador]))
    if (!indicador) continue // linha de um indicador que essa tela ainda não trata — ignora sem erro

    const unidade = semCodigoNumerico(toStr(cols[iUnidade])).toUpperCase()
    if (!unidade) continue

    const negocio = negocioPorPrefixo(unidade)

    if (iResultado !== -1) {
      const valor = parseValor(cols[iResultado], indicador)
      if (valor === null) {
        erros.push(`Linha ${i + 1}: resultado inválido para "${unidade}"`)
        continue
      }
      linhas.push({ indicador, unidade, negocio, valor })
    } else {
      for (const { mes, i: iCol } of colunasMes) {
        if (toStr(cols[iCol]) === '') continue // mês ainda sem valor (ex: meses futuros em branco na planilha histórica)
        const valor = parseValor(cols[iCol], indicador)
        if (valor === null) {
          erros.push(`Linha ${i + 1}: valor inválido em ${MESES_HEADER[mes - 1]} para "${unidade}"`)
          continue
        }
        linhas.push({ indicador, unidade, negocio, valor, mes })
      }
    }
  }

  return { linhas, erros }
}

/** Lê o CSV (separador ; ou tab). */
export function parseArmazemT1BiCsv(texto: string): ParseArmazemT1BiResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/** Lê a planilha Excel (.xlsx/.xls) — usa a primeira aba. */
export async function parseArmazemT1BiXlsx(file: File): Promise<ParseArmazemT1BiResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { linhas: [], erros: ['Arquivo Excel sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseArmazemT1BiFile(file: File): Promise<ParseArmazemT1BiResultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseArmazemT1BiXlsx(file)
  return parseArmazemT1BiCsv(await file.text())
}
