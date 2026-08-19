import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'
import { parseDuracaoParaMinutos } from '@/lib/duracao'
import { tierDaLinha, type ArmazemTier } from '@/lib/armazem-tiers'
import { lerAbaBrutaEFormatada } from '@/lib/xlsx-abas'

export type ArmazemT1MetaIndicador = 'tma' | 'disponibilidade_gente' | 'presenteismo_al'

/** Lista dos indicadores reconhecidos nessa planilha compartilhada — novos indicadores entram aqui + em `identificarIndicador`. */
export const ARMAZEM_T1_META_INDICADORES: { key: ArmazemT1MetaIndicador; nome: string }[] = [
  { key: 'tma', nome: 'TMA' },
  { key: 'disponibilidade_gente', nome: 'Disponibilidade de Gente' },
  { key: 'presenteismo_al', nome: 'Presenteísmo AL' },
]

const MESES_HEADER = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

/** Linha da planilha: indicador (já identificado) + unidade + meta. */
export interface ParsedArmazemT1MetaRow {
  indicador: ArmazemT1MetaIndicador
  /** Nome da unidade, já sem o código numérico do BI (ex: "143 - CDR Bahia" → "CDR BAHIA"). */
  unidade: string
  valor: number
  /** Só no formato histórico (colunas de mês, ex: JAN/FEV/MAR) — mês desse valor. Ausente no formato simples (Meta), que usa o mês escolhido na tela. */
  mes?: number
}

export interface ParseArmazemT1MetaResultado {
  linhas: ParsedArmazemT1MetaRow[]
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
function identificarIndicador(label: string): ArmazemT1MetaIndicador | null {
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
function parseValor(raw: unknown, indicador: ArmazemT1MetaIndicador): number | null {
  return indicador === 'tma' ? parseDuracaoParaMinutos(raw) : parsePercentual(raw)
}

/**
 * Planilha única de meta do Armazém T1 — TMA, Disponibilidade de Gente e
 * Presenteísmo AL empilhados no mesmo arquivo, coluna INDICADOR diz qual é
 * qual. Aceita dois formatos:
 * - INDICADOR · UNIDADE · META — meta de um único mês (escolhido na tela).
 * - INDICADOR · UNIDADE · JAN · FEV · ... — histórico, um valor por mês presente
 *   na planilha (usado só na primeira importação).
 *
 * `matrizFormatada` é a mesma aba lida com `raw:false` (ver
 * `lerAbaBrutaEFormatada`) — usada só pra TMA, porque a planilha real mistura
 * duas codificações numéricas pra "duração" na mesma coluna/mês a mês (uma
 * fração do dia, outra um inteiro tipo HHMM com formato customizado "00:00")
 * e o valor bruto sozinho não dá pra distinguir uma da outra sem adivinhar.
 */
function parseMatriz(matriz: unknown[][], matrizFormatada: unknown[][]): ParseArmazemT1MetaResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iIndicador = header.findIndex(h => h === 'INDICADOR')
  const iUnidade = header.findIndex(h => h === 'UNIDADE')
  const iMeta = header.findIndex(h => h === 'META')
  const colunasMes = MESES_HEADER
    .map((label, idx) => ({ mes: idx + 1, i: header.findIndex(h => h === label) }))
    .filter(c => c.i !== -1)

  if (iIndicador === -1 || iUnidade === -1 || (iMeta === -1 && colunasMes.length === 0)) {
    return { linhas: [], erros: ['Cabeçalho inválido — esperado colunas INDICADOR, UNIDADE e META (ou colunas de mês: JAN, FEV, ...)'] }
  }

  const linhas: ParsedArmazemT1MetaRow[] = []
  const erros: string[] = []

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    const colsFormatadas = matrizFormatada[i] ?? []
    if (cols.every(c => toStr(c) === '')) continue

    const indicador = identificarIndicador(toStr(cols[iIndicador]))
    if (!indicador) continue // linha de um indicador que essa tela ainda não trata — ignora sem erro

    const unidade = semCodigoNumerico(toStr(cols[iUnidade])).toUpperCase()
    if (!unidade) continue

    // TMA lê o texto formatado da célula (o que a planilha mostra), não o
    // número bruto — ver o comentário da função.
    const celula = (col: number): unknown => (indicador === 'tma' ? colsFormatadas[col] : cols[col])

    if (iMeta !== -1) {
      const valor = parseValor(celula(iMeta), indicador)
      if (valor === null) {
        erros.push(`Linha ${i + 1}: valor de Meta inválido para "${unidade}"`)
        continue
      }
      linhas.push({ indicador, unidade, valor })
    } else {
      for (const { mes, i: iCol } of colunasMes) {
        if (toStr(cols[iCol]) === '') continue // mês ainda sem valor (ex: meses futuros em branco na planilha histórica)
        const valor = parseValor(celula(iCol), indicador)
        if (valor === null) {
          erros.push(`Linha ${i + 1}: valor inválido em ${MESES_HEADER[mes - 1]} para "${unidade}"`)
          continue
        }
        linhas.push({ indicador, unidade, valor, mes })
      }
    }
  }

  return { linhas, erros }
}

/** Lê o CSV (separador ; ou tab) — sem aba, "bruto" e "formatado" são a mesma coisa (é tudo texto). */
export function parseArmazemT1MetaCsv(texto: string): ParseArmazemT1MetaResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  const matriz = linhasTexto.map(l => l.split(separador))
  return parseMatriz(matriz, matriz)
}

export interface ParsedArmazemMetaRow extends ParsedArmazemT1MetaRow {
  tier: ArmazemTier
  /** Aba de onde a linha veio — só pra mensagem na tela. */
  aba: string
}

/**
 * Lê a planilha inteira — TODAS as abas — e marca cada linha com o tier.
 * A planilha oficial traz T1 e T2 em abas separadas ("RV ARM _T1" /
 * "RV ARM _T2") e as duas são importadas de uma vez, numa tela só: eram dois
 * campos pedindo exatamente o mesmo arquivo, e escolher a aba errada
 * importava as metas do tier errado em silêncio.
 */
export async function parseArmazemMetasXlsx(file: File): Promise<{ linhas: ParsedArmazemMetaRow[]; erros: string[] }> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const linhas: ParsedArmazemMetaRow[] = []
  const erros: string[] = []

  for (const nomeAba of wb.SheetNames) {
    const { bruta, formatada } = lerAbaBrutaEFormatada(wb.Sheets[nomeAba])
    const resultado = parseMatriz(bruta, formatada)
    // Aba sem o cabeçalho esperado (ex: uma aba de apoio da planilha) é
    // ignorada em silêncio — só as abas de meta interessam.
    if (resultado.linhas.length === 0) continue
    for (const linha of resultado.linhas) {
      linhas.push({ ...linha, tier: tierDaLinha(nomeAba, linha.unidade), aba: nomeAba })
    }
    erros.push(...resultado.erros.map(e => `${nomeAba} — ${e}`))
  }

  return { linhas, erros }
}

/** Mesma leitura, pra CSV (que não tem aba) — o tier sai da unidade. */
export function parseArmazemMetasCsv(texto: string): { linhas: ParsedArmazemMetaRow[]; erros: string[] } {
  const { linhas, erros } = parseArmazemT1MetaCsv(texto)
  return { linhas: linhas.map(l => ({ ...l, tier: tierDaLinha('', l.unidade), aba: 'CSV' })), erros }
}

/** Detecta o formato pela extensão e lê o arquivo inteiro (todas as abas). */
export async function parseArmazemMetasFile(file: File): Promise<{ linhas: ParsedArmazemMetaRow[]; erros: string[] }> {
  if (/\.xlsx?$/i.test(file.name)) return parseArmazemMetasXlsx(file)
  return parseArmazemMetasCsv(await file.text())
}

/**
 * Lê a planilha Excel (.xlsx/.xls) de uma aba só. Mantido pra quem precisa de
 * uma aba específica; a tela de metas usa `parseArmazemMetasFile`, que lê
 * todas de uma vez.
 */
export async function parseArmazemT1MetaXlsx(file: File, aba?: string): Promise<ParseArmazemT1MetaResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const nome = aba && wb.SheetNames.includes(aba) ? aba : wb.SheetNames[0]
  const sheet = wb.Sheets[nome]
  if (!sheet) return { linhas: [], erros: ['Arquivo Excel sem abas'] }
  const { bruta, formatada } = lerAbaBrutaEFormatada(sheet)
  return parseMatriz(bruta, formatada)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseArmazemT1MetaFile(file: File, aba?: string): Promise<ParseArmazemT1MetaResultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseArmazemT1MetaXlsx(file, aba)
  return parseArmazemT1MetaCsv(await file.text())
}
