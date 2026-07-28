import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'
import { normalizarNomeUnidade } from '@/lib/unidade-resolver'

/**
 * Só ESTÂNCIA e CDR BAHIA se enquadram no indicador DTO T1 — qualquer outra
 * unidade que apareça no relatório de inspeções é ignorada.
 */
export const OPERACOES_DTO_T1 = ['ESTÂNCIA', 'CDR BAHIA']

const OPERACOES_DTO_T1_NORM = new Set(OPERACOES_DTO_T1.map(normalizarNomeUnidade))

/** Contagem agregada de uma unidade a partir da planilha de inspeções, colaborador por colaborador. */
export interface DtoT1UnidadeAgregado {
  /** Texto de "Operação" como veio na planilha (ex: "ESTÂNCIA", "CDR BAHIA"). */
  operacao: string
  totalColaboradores: number
  /** Colaboradores com "Dias Para Realizar Inspeção" negativo — prazo estourado. */
  atrasados: number
  /** (total − atrasados) / total × 100. */
  pctDentroPrazo: number
}

export interface ParseDtoT1Resultado {
  agregados: DtoT1UnidadeAgregado[]
  erros: string[]
}

function normalizarHeader(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/**
 * Planilha de inspeção por colaborador (colunas Matrícula, Colaborador, Data
 * Admissão, Operação, Função, Data Última Inspeção, Data Limite Inspeção,
 * Dias Para Realizar Inspeção, Dias Sem Inspeção) — usamos só Operação
 * (pra filtrar/agrupar) e Dias Para Realizar Inspeção (negativo = atrasado).
 * Cada linha é um colaborador; agregamos por unidade.
 */
function parseMatriz(matriz: unknown[][]): ParseDtoT1Resultado {
  if (matriz.length === 0) return { agregados: [], erros: [] }

  const header = matriz[0].map(c => normalizarHeader(toStr(c)))
  const iOperacao = header.findIndex(h => h === 'OPERACAO')
  const iDias = header.findIndex(h => h === 'DIAS PARA REALIZAR INSPECAO')

  if (iOperacao === -1 || iDias === -1) {
    return { agregados: [], erros: ['Cabeçalho inválido — esperado colunas Operação e Dias Para Realizar Inspeção'] }
  }

  const porOperacao = new Map<string, { total: number; atrasados: number }>()

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const operacao = toStr(cols[iOperacao]).toUpperCase()
    if (!operacao || !OPERACOES_DTO_T1_NORM.has(normalizarNomeUnidade(operacao))) continue

    const atual = porOperacao.get(operacao) ?? { total: 0, atrasados: 0 }
    atual.total += 1
    if (parseNumeroPtBr(cols[iDias]) < 0) atual.atrasados += 1
    porOperacao.set(operacao, atual)
  }

  const agregados: DtoT1UnidadeAgregado[] = Array.from(porOperacao.entries()).map(([operacao, { total, atrasados }]) => ({
    operacao,
    totalColaboradores: total,
    atrasados,
    pctDentroPrazo: total > 0 ? ((total - atrasados) / total) * 100 : 0,
  }))

  return { agregados, erros: [] }
}

/** Lê o CSV (separador ; ou tab). */
export function parseDtoT1Csv(texto: string): ParseDtoT1Resultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { agregados: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/** Lê a planilha Excel (.xlsx/.xls) — usa a primeira aba. */
export async function parseDtoT1Xlsx(file: File): Promise<ParseDtoT1Resultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { agregados: [], erros: ['Arquivo Excel sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseDtoT1File(file: File): Promise<ParseDtoT1Resultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseDtoT1Xlsx(file)
  return parseDtoT1Csv(await file.text())
}
