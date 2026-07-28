import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'

/** Linha da planilha de resultado da Frota: unidade + Desconto CIVF (R$) + Desconto Stress Test (R$) do mês. */
export interface ParsedDescontoFrotaRow {
  unidade: string
  civf: number | null
  stressTest: number | null
}

export interface ParseDescontoFrotaResultado {
  linhas: ParsedDescontoFrotaRow[]
  erros: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/** "1.500,00" → 1500; "-", "NA" e vazio viram null (sem resultado, não zero). */
function parseValor(raw: unknown): number | null {
  if (typeof raw === 'number') return raw
  const str = toStr(raw)
  if (str === '' || str === '-' || normalizar(str) === 'na') return null
  const n = parseNumeroPtBr(str)
  return n === 0 && !/^0[,.]?0*$/.test(str) ? null : n
}

/**
 * Planilha de Resultado da Frota — unidade pela coluna CDD GINFO, Desconto
 * CIVF pela coluna CIVF, Desconto Stress Test pela coluna TT STRESS TEST.
 */
function parseMatriz(matriz: unknown[][]): ParseDescontoFrotaResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iUnidade = header.findIndex(h => h === 'CDD GINFO')
  const iCivf = header.findIndex(h => h === 'CIVF')
  const iStressTest = header.findIndex(h => h === 'TT STRESS TEST')

  if (iUnidade === -1 || iCivf === -1 || iStressTest === -1) {
    return { linhas: [], erros: ['Cabeçalho inválido — esperado colunas CDD GINFO, CIVF e TT STRESS TEST'] }
  }

  const linhas: ParsedDescontoFrotaRow[] = []

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const unidade = toStr(cols[iUnidade]).toUpperCase()
    if (!unidade) continue

    linhas.push({
      unidade,
      civf: parseValor(cols[iCivf]),
      stressTest: parseValor(cols[iStressTest]),
    })
  }

  return { linhas, erros: [] }
}

/** Lê o CSV (separador ; ou tab) — sem conceito de aba, lê o conteúdo todo. */
export function parseDescontoFrotaCsv(texto: string): ParseDescontoFrotaResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/** Lê a planilha Excel (.xlsx/.xls) — usa especificamente a aba "Resultado", não a primeira. */
export async function parseDescontoFrotaXlsx(file: File): Promise<ParseDescontoFrotaResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const nomeAba = wb.SheetNames.find(n => normalizar(n) === 'RESULTADO')
  if (!nomeAba) {
    return { linhas: [], erros: [`Aba "Resultado" não encontrada no arquivo (abas disponíveis: ${wb.SheetNames.join(', ')})`] }
  }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeAba], { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseDescontoFrotaFile(file: File): Promise<ParseDescontoFrotaResultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseDescontoFrotaXlsx(file)
  return parseDescontoFrotaCsv(await file.text())
}
