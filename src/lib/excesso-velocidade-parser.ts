import * as XLSX from 'xlsx'

/** Contagem agregada de excessos de velocidade de uma unidade (UO), linha por linha (cada linha = 1 veículo/evento). */
export interface ExcessoVelocidadeUnidadeAgregado {
  /** Texto de "UO" como veio na planilha (ex: "CD FRANCISCO BELTRÃO - LOG20"). */
  uo: string
  /** Quantidade de linhas cujo TIPO é exatamente "EXCESSO_VELOCIDADE". */
  totalExcessos: number
}

export interface ParseExcessoVelocidadeResultado {
  agregados: ExcessoVelocidadeUnidadeAgregado[]
  erros: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/** TIPO que conta como excesso — comparação EXATA, ver `parseMatriz`. */
const TIPO_EXCESSO = 'EXCESSO_VELOCIDADE'

/**
 * Planilha de excessos de velocidade (várias colunas — placa, prefixo,
 * motorista, CPF etc — usamos só UO e TIPO). Cada linha é um evento; conta
 * como excesso quando TIPO é EXATAMENTE "EXCESSO_VELOCIDADE".
 *
 * A comparação é exata de propósito: a planilha tem outros tipos que começam
 * igual (ex: "EXCESSO_VELOCIDADE_VIA"), e esses NÃO entram na contagem —
 * antes, com `includes`, entravam. Agregamos a contagem por unidade (UO) —
 * a exclusão de ESTÂNCIA/Camaçari ARM é feita depois, na importação (que
 * resolve a UO pra unidade de verdade e sabe o negócio).
 */
function parseMatriz(matriz: unknown[][]): ParseExcessoVelocidadeResultado {
  if (matriz.length === 0) return { agregados: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iUo = header.findIndex(h => h === 'UO')
  const iTipo = header.findIndex(h => h === 'TIPO')

  if (iUo === -1 || iTipo === -1) {
    return { agregados: [], erros: ['Cabeçalho inválido — esperado colunas UO e TIPO'] }
  }

  const porUo = new Map<string, number>()

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const uo = toStr(cols[iUo]).toUpperCase()
    if (!uo) continue

    if (normalizar(toStr(cols[iTipo])) === TIPO_EXCESSO) porUo.set(uo, (porUo.get(uo) ?? 0) + 1)
  }

  const agregados: ExcessoVelocidadeUnidadeAgregado[] = Array.from(porUo.entries())
    .map(([uo, totalExcessos]) => ({ uo, totalExcessos }))

  return { agregados, erros: [] }
}

/** Lê o CSV (separador ; ou tab). */
export function parseExcessoVelocidadeCsv(texto: string): ParseExcessoVelocidadeResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { agregados: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/** Lê a planilha Excel (.xlsx/.xls) — usa a primeira aba. */
export async function parseExcessoVelocidadeXlsx(file: File): Promise<ParseExcessoVelocidadeResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { agregados: [], erros: ['Arquivo Excel sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseExcessoVelocidadeFile(file: File): Promise<ParseExcessoVelocidadeResultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseExcessoVelocidadeXlsx(file)
  return parseExcessoVelocidadeCsv(await file.text())
}
