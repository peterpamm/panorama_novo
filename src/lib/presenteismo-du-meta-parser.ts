import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'

const MESES_HEADER = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

/** Linha da planilha de meta do Presenteísmo (DU ou AL): unidade + meta (%) do mês. */
export interface ParsedPresenteismoDuMetaRow {
  unidade: string
  valor: number
  /** Só no formato histórico (colunas de mês, ex: JAN/FEV/MAR) — mês desse valor. Ausente no formato simples (Unidade + Meta), que usa o mês escolhido na tela. */
  mes?: number
}

export interface ParsePresenteismoDuMetaResultado {
  linhas: ParsedPresenteismoDuMetaRow[]
  erros: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/** "3%" → 3; número do Excel formatado como percentual vem em fração (0,03) — nesse caso multiplica por 100. */
function parsePercentual(raw: unknown): number | null {
  if (typeof raw === 'number') return raw <= 1 ? raw * 100 : raw
  const str = toStr(raw).replace('%', '').trim()
  if (str === '') return null
  const n = parseNumeroPtBr(str)
  return Number.isNaN(n) ? null : n
}

/**
 * Aceita dois formatos:
 * - Unidade · Meta — meta de um único mês/ano, escolhido no formulário de importação.
 * - [Indicador ·] Unidade · Jan · Fev · ... — formato histórico, um valor por mês
 *   presente na planilha (usado só na primeira importação, pra trazer os meses já
 *   fechados de uma vez). Se existir, a coluna Indicador só filtra linhas que
 *   comecem com "PRESENTEÍSMO" — não muda o formato simples, que não tem essa coluna.
 */
function parseMatriz(matriz: unknown[][]): ParsePresenteismoDuMetaResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iIndicador = header.findIndex(h => h === 'INDICADOR')
  const iUnidade = header.findIndex(h => h === 'UNIDADE')
  const iMeta = header.findIndex(h => h === 'META')
  const colunasMes = MESES_HEADER
    .map((label, idx) => ({ mes: idx + 1, i: header.findIndex(h => h === label) }))
    .filter(c => c.i !== -1)

  if (iUnidade === -1 || (iMeta === -1 && colunasMes.length === 0)) {
    return { linhas: [], erros: ['Cabeçalho inválido — esperado colunas Unidade e Meta (ou colunas de mês: Jan, Fev, ...)'] }
  }

  const linhas: ParsedPresenteismoDuMetaRow[] = []
  const erros: string[] = []

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    if (iIndicador !== -1 && !normalizar(toStr(cols[iIndicador])).startsWith('PRESENTEISMO')) continue

    const unidade = toStr(cols[iUnidade]).toUpperCase()
    if (!unidade) continue

    if (iMeta !== -1) {
      const valor = parsePercentual(cols[iMeta])
      if (valor === null) {
        erros.push(`Linha ${i + 1}: valor de Meta inválido para "${unidade}"`)
        continue
      }
      linhas.push({ unidade, valor })
    } else {
      for (const { mes, i: iCol } of colunasMes) {
        if (toStr(cols[iCol]) === '') continue // mês ainda sem valor (ex: meses futuros em branco na planilha histórica)
        const valor = parsePercentual(cols[iCol])
        if (valor === null) {
          erros.push(`Linha ${i + 1}: valor inválido em ${MESES_HEADER[mes - 1]} para "${unidade}"`)
          continue
        }
        linhas.push({ unidade, valor, mes })
      }
    }
  }

  return { linhas, erros }
}

/** Lê o CSV (separador ; ou tab). */
export function parsePresenteismoDuMetaCsv(texto: string): ParsePresenteismoDuMetaResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/**
 * Lê a planilha Excel (.xlsx/.xls). `aba` é obrigatória na prática quando o
 * arquivo tem mais de uma: a planilha de metas do Armazém traz T1 e T2 lado a
 * lado ("RV ARM _T1" / "RV ARM _T2"), e cair sempre na primeira importava as
 * metas do T1 achando que eram do T2 — as unidades do T2 ficavam sem meta
 * nenhuma. Sem `aba`, mantém o comportamento antigo (primeira aba).
 */
export async function parsePresenteismoDuMetaXlsx(file: File, aba?: string): Promise<ParsePresenteismoDuMetaResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const nome = aba && wb.SheetNames.includes(aba) ? aba : wb.SheetNames[0]
  const sheet = wb.Sheets[nome]
  if (!sheet) return { linhas: [], erros: ['Arquivo Excel sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parsePresenteismoDuMetaFile(file: File, aba?: string): Promise<ParsePresenteismoDuMetaResultado> {
  if (/\.xlsx?$/i.test(file.name)) return parsePresenteismoDuMetaXlsx(file, aba)
  return parsePresenteismoDuMetaCsv(await file.text())
}
