import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'
import type { ReuniaoSetor } from '@/types'

/** Linha da planilha de histórico do Resumo Geral — acumulado da unidade em cada setor até o mês de corte escolhido na tela (Ano + Mês final não vêm da planilha). */
export interface ParsedHistoricoRow {
  unidade: string
  porSetor: Record<ReuniaoSetor, number>
}

export interface ParseHistoricoResultado {
  linhas: ParsedHistoricoRow[]
  erros: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

function parseValor(raw: unknown): number | null {
  if (typeof raw === 'number') return raw
  const str = toStr(raw)
  if (str === '') return null
  if (!/^-?[\d.,]+$/.test(str)) return null
  return parseNumeroPtBr(str)
}

/** Aceita "FILIAL" (nome usado na planilha real) ou "UNIDADE" (padrão dos outros importadores). */
const HEADERS_UNIDADE = ['FILIAL', 'UNIDADE']

/** Uma coluna por setor — nomes normalizados (sem acento) batem com os cabeçalhos reais (GENTE, FROTA, SEGURANÇA, FINANCEIRO, DISTRIBUIÇÃO, ARMAZÉM). */
const COLUNAS_SETOR: { setor: ReuniaoSetor; header: string }[] = [
  { setor: 'financeiro', header: 'FINANCEIRO' },
  { setor: 'gente', header: 'GENTE' },
  { setor: 'frota', header: 'FROTA' },
  { setor: 'seguranca', header: 'SEGURANCA' },
  { setor: 'distribuicao', header: 'DISTRIBUICAO' },
  { setor: 'armazem', header: 'ARMAZEM' },
]

/**
 * Planilha de Importação de Histórico do Resumo Geral — Filial/Unidade +
 * uma coluna por setor (Gente/Frota/Segurança/Financeiro/Distribuição/
 * Armazém), o acumulado de pontos de cada setor até um mês de corte. A
 * coluna Total (se existir na planilha) é só informativa — não é lida, o
 * app recalcula como a soma dos 6 setores. Ano e mês de corte são
 * escolhidos na tela (Importação de Histórico), não vêm por linha.
 */
export function parseHistoricoMatriz(matriz: unknown[][]): ParseHistoricoResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const iHeader = matriz.findIndex(row => row.some(c => HEADERS_UNIDADE.includes(normalizar(toStr(c)))))
  if (iHeader === -1) return { linhas: [], erros: ['Cabeçalho não encontrado — esperado uma coluna "Filial" ou "Unidade"'] }

  const header = matriz[iHeader].map(c => normalizar(toStr(c)))
  const iUnidade = header.findIndex(h => HEADERS_UNIDADE.includes(h))
  const indicesSetor = COLUNAS_SETOR.map(c => ({ setor: c.setor, i: header.findIndex(h => h === c.header) }))
  const faltando = indicesSetor.filter(c => c.i === -1)
  if (iUnidade === -1 || faltando.length > 0) {
    return { linhas: [], erros: [`Cabeçalho inválido — esperado colunas Filial/Unidade e ${COLUNAS_SETOR.map(c => c.header).join(', ')}`] }
  }

  const linhas: ParsedHistoricoRow[] = []
  const erros: string[] = []

  for (let i = iHeader + 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const unidade = toStr(cols[iUnidade]).toUpperCase()
    if (!unidade) continue

    const porSetor = {} as Record<ReuniaoSetor, number>
    let linhaValida = true
    for (const { setor, i: iCol } of indicesSetor) {
      const valor = parseValor(cols[iCol])
      if (valor === null) {
        erros.push(`Linha ${i + 1}: valor inválido em "${COLUNAS_SETOR.find(c => c.setor === setor)?.header}" para "${unidade}"`)
        linhaValida = false
        break
      }
      porSetor[setor] = valor
    }
    if (!linhaValida) continue

    linhas.push({ unidade, porSetor })
  }

  return { linhas, erros }
}

/** Lê a planilha Excel/CSV do histórico — a aba é sempre a primeira. */
export async function parseHistoricoFile(file: File): Promise<ParseHistoricoResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { linhas: [], erros: ['Arquivo sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseHistoricoMatriz(matriz)
}
