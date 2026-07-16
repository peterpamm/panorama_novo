import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'
import type { RvLideranca } from '@/types'

export type ParsedRvLiderancaRow = Omit<RvLideranca, 'id'>

export interface ParseRvLiderancasResultado {
  linhas: ParsedRvLiderancaRow[]
  erros: string[]
}

const COLUNAS_ESPERADAS = ['operacao', 'negocio', 'setor', 'funcao', 'nome', 'valor']

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** "R$ 1.000,00" → 1000; aceita número puro do Excel ou string com vírgula. */
function parseValorRv(raw: unknown): number {
  if (typeof raw === 'number') return raw
  return parseNumeroPtBr(String(raw ?? '').replace(/R\$\s*/gi, ''))
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/**
 * Núcleo do parse: recebe a planilha como matriz (linha 0 = cabeçalho
 * OPERAÇÃO/SETOR/FUNÇÃO/NOME/VALOR, casado sem acentos/caixa). Linhas
 * duplicadas pelo mesmo NOME ficam com a última ocorrência (o upsert usa o
 * nome como chave).
 */
function parseMatriz(matriz: unknown[][]): ParseRvLiderancasResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const indices = COLUNAS_ESPERADAS.map(c => header.indexOf(c))
  if (indices.some(i => i === -1)) {
    return { linhas: [], erros: ['Cabeçalho inválido — esperado: OPERAÇÃO;NEGOCIO;SETOR;FUNÇÃO;NOME;VALOR'] }
  }
  const [iOperacao, iNegocio, iSetor, iFuncao, iNome, iValor] = indices

  const porNome = new Map<string, ParsedRvLiderancaRow>()
  const erros: string[] = []

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    // Pula linhas totalmente vazias (comum em export de Excel)
    if (cols.every(c => toStr(c) === '')) continue

    const operacao = toStr(cols[iOperacao]).toUpperCase()
    const negocio = toStr(cols[iNegocio]).toUpperCase()
    const setor = toStr(cols[iSetor]).toUpperCase()
    const funcao = toStr(cols[iFuncao]).toUpperCase()
    const nome = toStr(cols[iNome]).toUpperCase()
    const valor = parseValorRv(cols[iValor])

    if (!operacao || !nome) {
      erros.push(`Linha ${i + 1}: operação ou nome vazio`)
      continue
    }
    if (valor <= 0) {
      erros.push(`Linha ${i + 1}: valor inválido "${toStr(cols[iValor])}"`)
      continue
    }

    porNome.set(nome, { operacao, negocio, setor, funcao, nome, valor })
  }

  return { linhas: Array.from(porNome.values()), erros }
}

/** Lê o CSV (separador ; ou tab — cópia direta do Excel usa tab). */
export function parseRvLiderancasCsv(texto: string): ParseRvLiderancasResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/** Lê a planilha Excel (.xlsx/.xls) — usa a primeira aba. */
export async function parseRvLiderancasXlsx(file: File): Promise<ParseRvLiderancasResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { linhas: [], erros: ['Arquivo Excel sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseRvLiderancasFile(file: File): Promise<ParseRvLiderancasResultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseRvLiderancasXlsx(file)
  return parseRvLiderancasCsv(await file.text())
}
