import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'

/** Linha da planilha do Termômetro: unidade + a pontuação do mês (0 a 110, já pronta — sem meta) + a posição opcional no Ranking Ambev do setor. */
export interface ParsedTermometroRow {
  unidade: string
  valor: number
  /** Posição da unidade no Ranking Ambev do setor (1º, 2º...) — mesmo valor que hoje é lançado à mão no Resumo Geral. `undefined` quando a planilha não tem essa coluna, ou a unidade não tem posição lançada nesse mês (não confundir com posição zerada). */
  posicao?: number
}

export interface ParseTermometroResultado {
  linhas: ParsedTermometroRow[]
  erros: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/**
 * `parseNumeroPtBr` devolve 0 pra texto que não é número (não NaN) — aqui
 * precisamos distinguir "não é número" de erro real, porque o valor vira
 * pontuação direta (uma unidade não pode ganhar 0 ponto por causa de um erro
 * de digitação silencioso), então valida o formato antes de converter.
 */
function parseValor(raw: unknown): number | null {
  if (typeof raw === 'number') return raw
  const str = toStr(raw)
  if (str === '') return null
  if (!/^-?[\d.,]+$/.test(str)) return null
  return parseNumeroPtBr(str)
}

/** Posição no Ranking Ambev — inteiro positivo (1º, 2º...); essa importação é o único jeito de lançar essa posição hoje (Resumo Geral só lê, sem input manual — ver `useResumoGeralRanking.ts`). */
function parsePosicao(raw: unknown): number | null {
  const valor = parseValor(raw)
  if (valor === null || !Number.isInteger(valor) || valor <= 0) return null
  return valor
}

/**
 * Planilha do Termômetro: Unidade + a pontuação do mês, e opcionalmente uma
 * 3ª coluna "Posição" — a colocação da unidade no Ranking Ambev do setor
 * daquele mês (hoje lançada à mão no Resumo Geral, ver
 * `resumo_geral_ranking_ambev`). A coluna da pontuação não tem nome fixo (o
 * cabeçalho é o próprio nome do mês, ex: "Junho"), então é identificada por
 * posição — a primeira coluna que não é Unidade nem Posição — nunca pelo
 * texto do cabeçalho. "Posição" já tem nome fixo, procurada por nome (não
 * precisa estar em nenhuma ordem específica) — arquivo sem essa coluna
 * continua funcionando igual antes, só sem posição nenhuma. O mês/ano de
 * destino vêm do seletor da tela de Importação, não da planilha.
 */
function parseMatriz(matriz: unknown[][]): ParseTermometroResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iUnidade = header.findIndex(h => h === 'UNIDADE')
  const iPosicao = header.findIndex(h => h === 'POSICAO' || h === 'POSICAO NO RANKING AMBEV')
  const iValor = header.findIndex((h, i) => i !== iUnidade && i !== iPosicao && h !== '')

  if (iUnidade === -1 || iValor === -1) {
    return { linhas: [], erros: ['Cabeçalho inválido — esperado colunas: Unidade e a pontuação do mês (Posição é opcional)'] }
  }

  const linhas: ParsedTermometroRow[] = []
  const erros: string[] = []

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const unidade = toStr(cols[iUnidade]).toUpperCase()
    if (!unidade) continue

    if (toStr(cols[iValor]) === '') continue // unidade ainda sem nota lançada nesse mês

    const valor = parseValor(cols[iValor])
    if (valor === null) {
      erros.push(`Linha ${i + 1}: pontuação inválida para "${unidade}"`)
      continue
    }

    let posicao: number | undefined
    if (iPosicao !== -1 && toStr(cols[iPosicao]) !== '') {
      const posicaoParseada = parsePosicao(cols[iPosicao])
      if (posicaoParseada === null) {
        erros.push(`Linha ${i + 1}: posição inválida para "${unidade}" (precisa ser um número inteiro maior que 0)`)
        continue
      }
      posicao = posicaoParseada
    }

    linhas.push({ unidade, valor, posicao })
  }

  return { linhas, erros }
}

/** Lê o CSV (separador ; ou tab). */
export function parseTermometroCsv(texto: string): ParseTermometroResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/** Lê a planilha Excel (.xlsx/.xls) — usa a primeira aba. */
export async function parseTermometroXlsx(file: File): Promise<ParseTermometroResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { linhas: [], erros: ['Arquivo Excel sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseTermometroFile(file: File): Promise<ParseTermometroResultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseTermometroXlsx(file)
  return parseTermometroCsv(await file.text())
}
