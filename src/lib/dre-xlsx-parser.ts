import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'

export interface ParsedDreRow {
  conta_codigo: string
  campos: Record<string, number>
}

export interface ParseDreResult {
  linhas: ParsedDreRow[]
  blocosDetectados: string[] // ex: ['jan','fev','mar','total']
  fileName: string
}

const MESES: Record<string, string> = {
  JANEIRO: 'jan', FEVEREIRO: 'fev', MARCO: 'mar', 'MARÇO': 'mar', ABRIL: 'abr',
  MAIO: 'mai', JUNHO: 'jun', JULHO: 'jul', AGOSTO: 'ago', SETEMBRO: 'set',
  OUTUBRO: 'out', NOVEMBRO: 'nov', DEZEMBRO: 'dez',
}

// Mapeia o subcabeçalho (linha abaixo do mês) para o sufixo de coluna no banco.
// O GInfo já variou o número de colunas por bloco (4 ou 5 — com AVO, a meta
// mensal por conta, antes do AVR) — por isso lemos pelo NOME da coluna, nunca
// por posição fixa.
const SUBCABECALHOS: Record<string, string> = {
  REMUNERADO: 'remunerado',
  REALIZADO: 'realizado',
  DIFERENCA: 'diferenca',
  'DIFERENÇA': 'diferenca',
  DIF: 'diferenca',
  AVO: 'avo',
  'AVO (%)': 'avo',
  AVR: 'avr',
  'AVR (%)': 'avr',
}

function blockKey(label: string): string | null {
  const upper = String(label).trim().toUpperCase()
  if (upper.startsWith('TOTAL')) return 'total'
  for (const [nome, key] of Object.entries(MESES)) {
    if (upper.startsWith(nome)) return key
  }
  return null
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

function subcabecalhoKey(label: unknown): string | null {
  const upper = toStr(label).toUpperCase().replace(/\s*\(%\)\s*$/, '').trim()
  return SUBCABECALHOS[upper] ?? SUBCABECALHOS[`${upper} (%)`] ?? null
}

/**
 * Parser do relatório DRE do GInfo: aba única, linha com "CONTA" na coluna A
 * marca o cabeçalho dos blocos de mês (que crescem conforme o ano avança, de
 * 1 a 12 blocos + bloco TOTAL final). Cada bloco tem largura variável (visto
 * tanto com 4 colunas — REMUNERADO/REALIZADO/DIFERENCA/AVR — quanto com 5,
 * incluindo AVO, a meta mensal por conta) — a largura real de cada bloco é
 * descoberta lendo a linha de subcabeçalho, não assumida por posição fixa.
 * As linhas seguintes são as ~280 contas fixas do plano de contas, no
 * formato "NNN | DESCRIÇÃO".
 */
export async function parseDreXlsx(file: File): Promise<ParseDreResult> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

  const headerRowIdx = raw.findIndex(row => toStr(row?.[0]).toUpperCase() === 'CONTA')
  if (headerRowIdx === -1) {
    throw new Error('Não encontrei a linha de cabeçalho ("CONTA") no arquivo. Verifique se é o relatório DRE do GInfo.')
  }
  const headerRow = raw[headerRowIdx]
  const subHeaderRow = raw[headerRowIdx + 1] ?? []
  const dataStartIdx = headerRowIdx + 2

  const inicios: { col: number; chave: string }[] = []
  for (let c = 1; c < headerRow.length; c++) {
    const valor = headerRow[c]
    if (valor === null || valor === undefined || toStr(valor) === '') continue
    const chave = blockKey(toStr(valor))
    if (chave) inicios.push({ col: c, chave })
  }
  if (inicios.length === 0) {
    throw new Error('Não encontrei nenhum bloco de mês/total no cabeçalho do arquivo.')
  }

  // Para cada bloco, mapeia {sufixo: coluna} lendo a linha de subcabeçalho
  // entre o início deste bloco e o início do próximo (ou fim da linha).
  const blocos = inicios.map(({ col, chave }, idx) => {
    const fimExclusivo = idx + 1 < inicios.length ? inicios[idx + 1].col : subHeaderRow.length
    const colunasPorSufixo: Record<string, number> = {}
    for (let c = col; c < fimExclusivo; c++) {
      const sufixo = subcabecalhoKey(subHeaderRow[c])
      if (sufixo) colunasPorSufixo[sufixo] = c
    }
    return { chave, colunasPorSufixo }
  })

  const linhas: ParsedDreRow[] = []
  for (let r = dataStartIdx; r < raw.length; r++) {
    const row = raw[r]
    if (!row) continue
    const primeiraColuna = toStr(row[0])
    const match = primeiraColuna.match(/^(\d{3})\s*\|\s*(.*)$/)
    if (!match || match[2].trim() === '') continue // ignora separadores sem descrição (ex: "273 | "), ausentes em `contas`
    const conta_codigo = match[1]

    const campos: Record<string, number> = {}
    for (const { chave, colunasPorSufixo } of blocos) {
      for (const [sufixo, col] of Object.entries(colunasPorSufixo)) {
        campos[`${chave}_${sufixo}`] = parseNumeroPtBr(row[col])
      }
    }
    linhas.push({ conta_codigo, campos })
  }

  return {
    linhas,
    blocosDetectados: blocos.map(b => b.chave),
    fileName: file.name,
  }
}
