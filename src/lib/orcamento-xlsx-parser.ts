import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'

/** Uma linha de conta×mês dentro de uma aba de orçamento. */
export interface ParsedOrcamentoConta {
  conta_codigo: string
  /** Nome da conta como vem na planilha de orçamento — numeração própria, não necessariamente igual à tabela `contas` do DRE. */
  conta_nome: string
  mes: number // 0 = anual (bloco TOTAL), 1-12 = mensal
  orcado: number
  av: number
  ah: number
}

/** Uma aba do workbook já resolvida pra unidade×negócio (via aba INPUTS). */
export interface ParsedOrcamentoSheet {
  sheetName: string
  /** Nome da unidade como está na aba INPUTS — ainda não resolvido pra unidade cadastrada. */
  unidadeNome: string
  /** ROTA / ARM / EMP / CONS. */
  negocio: string
  linhas: ParsedOrcamentoConta[]
}

export interface ParseOrcamentoResultado {
  sheets: ParsedOrcamentoSheet[]
  /** Abas no padrão ORÇ_XXX_SUFIXO cujo código de 3 letras não está na aba INPUTS. */
  codigosNaoMapeados: string[]
  /** Abas cujo nome não segue o padrão ORÇ_XXX_(RT|AR|EM|TT) — ignoradas (ex: a própria "INPUTS"). */
  abasForaDoPadrao: string[]
  erros: string[]
}

const SUFIXO_PARA_NEGOCIO: Record<string, string> = { RT: 'ROTA', AR: 'ARM', EM: 'EMP', TT: 'CONS' }

const MESES_NUM: Record<string, number> = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
  JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

function normalizarCabecalho(v: unknown): string {
  return toStr(v).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Extrai o código de 3 letras e o negócio do nome da aba (ex: "ORÇ_DDM_RT" → { codigo: "DDM", negocio: "ROTA" }). */
function parseNomeAba(sheetName: string): { codigo: string; negocio: string } | null {
  const match = sheetName.trim().match(/^OR[ÇC]_(.+)_(RT|AR|EM|TT)$/i)
  if (!match) return null
  const negocio = SUFIXO_PARA_NEGOCIO[match[2].toUpperCase()]
  if (!negocio) return null
  return { codigo: match[1].toUpperCase(), negocio }
}

/**
 * Lê a aba INPUTS e monta código de 3 letras → nome da unidade, a partir da
 * primeira tabela com cabeçalho "UNIDADE" ("TABELA DADOS ORÇADO"): cada linha
 * tem o nome da unidade e os nomes das abas ORÇ_XXX_* pra cada negócio — todas
 * compartilham o mesmo código de 3 letras, então basta a primeira célula
 * preenchida da linha pra extrair o código (cobre casos como a AMBEV, que no
 * arquivo real tem abas RT/AR criadas mas só a coluna TOTAL preenchida nessa
 * tabela).
 */
function parseCodigosInputs(matriz: unknown[][]): Map<string, string> {
  const codigoParaNome = new Map<string, string>()
  const headerRowIdx = matriz.findIndex(row => normalizarCabecalho(row[1]) === 'UNIDADE')
  if (headerRowIdx === -1) return codigoParaNome

  for (let r = headerRowIdx + 1; r < matriz.length; r++) {
    const row = matriz[r]
    const nome = toStr(row[1])
    if (nome === '') break // linha em branco encerra a tabela
    for (let c = 2; c <= 6; c++) {
      const info = parseNomeAba(toStr(row[c]))
      if (info) { codigoParaNome.set(info.codigo, nome.toUpperCase()); break }
    }
  }
  return codigoParaNome
}

/**
 * Parser de uma aba de orçamento — mesmo esqueleto de blocos do parser de DRE
 * (parseDreXlsx: linha "CONTA" marca o cabeçalho, blocos de largura variável
 * lidos pelo subcabeçalho), mas com sub-colunas ORCADO/AV/AH. Considera os
 * blocos de mês (Jan-Dez) e o bloco TOTAL final (a meta do ano, mes=0) —
 * ignora só o bloco anual "Ano: XXXX" (comparação com o ano anterior, sem AV/AH).
 */
function parseAbaOrcamento(raw: unknown[][]): ParsedOrcamentoConta[] {
  const headerRowIdx = raw.findIndex(row => toStr(row?.[0]).toUpperCase() === 'CONTA')
  if (headerRowIdx === -1) return []
  const headerRow = raw[headerRowIdx]
  const subHeaderRow = raw[headerRowIdx + 1] ?? []
  const dataStartIdx = headerRowIdx + 2

  const inicios: { col: number; mes: number }[] = []
  for (let c = 1; c < headerRow.length; c++) {
    const valor = normalizarCabecalho(headerRow[c])
    if (valor === '') continue
    if (valor.startsWith('TOTAL')) { inicios.push({ col: c, mes: 0 }); continue }
    const entry = Object.entries(MESES_NUM).find(([nome]) => valor.startsWith(nome))
    if (entry) inicios.push({ col: c, mes: entry[1] })
  }
  if (inicios.length === 0) return []

  const blocos = inicios.map(({ col, mes }, idx) => {
    const fimExclusivo = idx + 1 < inicios.length ? inicios[idx + 1].col : subHeaderRow.length
    let colOrcado = -1, colAv = -1, colAh = -1
    for (let c = col; c < fimExclusivo; c++) {
      const sub = normalizarCabecalho(subHeaderRow[c])
      if (sub === 'ORCADO') colOrcado = c
      else if (sub === 'AV') colAv = c
      else if (sub === 'AH') colAh = c
    }
    return { mes, colOrcado, colAv, colAh }
  })

  const linhas: ParsedOrcamentoConta[] = []
  for (let r = dataStartIdx; r < raw.length; r++) {
    const row = raw[r]
    if (!row) continue
    const match = toStr(row[0]).match(/^(\d{3})\s*\|\s*(.*)$/)
    if (!match || match[2].trim() === '') continue
    const conta_codigo = match[1]
    const conta_nome = match[2].trim()

    for (const { mes, colOrcado, colAv, colAh } of blocos) {
      if (colOrcado === -1) continue
      linhas.push({
        conta_codigo,
        conta_nome,
        mes,
        orcado: parseNumeroPtBr(row[colOrcado]),
        av: colAv === -1 ? 0 : parseNumeroPtBr(row[colAv]),
        ah: colAh === -1 ? 0 : parseNumeroPtBr(row[colAh]),
      })
    }
  }
  return linhas
}

/**
 * Lê o workbook inteiro de orçamento: uma aba INPUTS com os códigos de 3
 * letras por unidade, e uma aba ORÇ_XXX_SUFIXO por unidade×negócio — só
 * aceita .xlsx (o arquivo tem várias abas, não dá pra representar em CSV).
 */
export async function parseOrcamentoWorkbook(file: File): Promise<ParseOrcamentoResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })

  const inputsSheet = wb.Sheets['INPUTS']
  if (!inputsSheet) {
    return { sheets: [], codigosNaoMapeados: [], abasForaDoPadrao: [], erros: ['Aba "INPUTS" não encontrada no arquivo.'] }
  }
  const inputsMatriz = XLSX.utils.sheet_to_json<unknown[]>(inputsSheet, { header: 1, defval: '' })
  const codigoParaNome = parseCodigosInputs(inputsMatriz)

  const sheets: ParsedOrcamentoSheet[] = []
  const codigosNaoMapeados = new Set<string>()
  const abasForaDoPadrao: string[] = []
  const erros: string[] = []

  for (const sheetName of wb.SheetNames) {
    if (sheetName === 'INPUTS') continue
    const info = parseNomeAba(sheetName)
    if (!info) { abasForaDoPadrao.push(sheetName); continue }
    const nome = codigoParaNome.get(info.codigo)
    if (!nome) { codigosNaoMapeados.add(info.codigo); continue }

    const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: null })
    const linhas = parseAbaOrcamento(raw)
    if (linhas.length === 0) {
      erros.push(`Aba "${sheetName}": não encontrei a linha de cabeçalho ("CONTA") ou nenhum bloco de mês.`)
      continue
    }

    sheets.push({ sheetName, unidadeNome: nome, negocio: info.negocio, linhas })
  }

  return { sheets, codigosNaoMapeados: Array.from(codigosNaoMapeados), abasForaDoPadrao, erros }
}
