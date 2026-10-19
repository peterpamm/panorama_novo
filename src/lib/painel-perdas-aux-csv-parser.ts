import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'
import { negocioPorPrefixo } from '@/lib/unidade-resolver'
import type { PainelPerdasAux } from '@/types'

export type ParsedPainelPerdasAuxRow = Omit<PainelPerdasAux, 'id'>

export interface ParsePainelPerdasAuxResultado {
  linhas: ParsedPainelPerdasAuxRow[]
  erros: string[]
}

const MAPA_INDICADOR: Record<string, PainelPerdasAux['indicador']> = {
  indisponibilidade: 'indisponibilidade',
  devolucao: 'devolucao',
  'devolução': 'devolucao',
}

const COLUNAS_ESPERADAS = ['indicador', 'negocio', 'ano', 'mes', 'unidade', 'valor']

function toStr(v: string | number | undefined): string {
  return String(v ?? '').trim()
}

/**
 * Núcleo do parser, já com as linhas quebradas em células — usado tanto
 * pelo .csv (cada célula é sempre string, vindo do split por `;`) quanto
 * pelo .xlsx (célula numérica chega como `number` de verdade, sem passar
 * por texto — importante pro VALOR: o SheetJS exportaria número em texto
 * com PONTO decimal, não vírgula, e quebraria o `parseNumeroPtBr`; vindo
 * como number já bate direto no primeiro `if` dele).
 */
function parsePainelPerdasAuxLinhas(linhas: (string | number)[][]): ParsePainelPerdasAuxResultado {
  if (linhas.length === 0) return { linhas: [], erros: [] }

  const header = linhas[0].map(h => toStr(h).toLowerCase())
  const indices = COLUNAS_ESPERADAS.map(c => header.indexOf(c))
  if (indices.some(i => i === -1)) {
    return { linhas: [], erros: [`Cabeçalho inválido — esperado: ${COLUNAS_ESPERADAS.join(';').toUpperCase()}`] }
  }
  const [iIndicador, iNegocio, iAno, iMes, iUnidade, iValor] = indices

  const resultado: ParsedPainelPerdasAuxRow[] = []
  const erros: string[] = []

  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i]
    if (cols.length < COLUNAS_ESPERADAS.length) {
      erros.push(`Linha ${i + 1}: número de colunas inválido`)
      continue
    }

    const indicadorRaw = toStr(cols[iIndicador]).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    const indicador = MAPA_INDICADOR[indicadorRaw]
    if (!indicador) {
      erros.push(`Linha ${i + 1}: indicador desconhecido "${toStr(cols[iIndicador])}"`)
      continue
    }

    const unidade = toStr(cols[iUnidade]).toUpperCase()
    const negocio = negocioPorPrefixo(toStr(cols[iNegocio]))
    const ano = Number(toStr(cols[iAno]))
    const mes = Number(toStr(cols[iMes]))
    const valor = parseNumeroPtBr(cols[iValor])

    if (!unidade || Number.isNaN(ano) || Number.isNaN(mes) || mes < 1 || mes > 12) {
      erros.push(`Linha ${i + 1}: dado inválido`)
      continue
    }

    resultado.push({ unidade, negocio, ano, mes, indicador, valor })
  }

  return { linhas: resultado, erros }
}

/**
 * Lê o painel_de_perdas.csv no formato herdado do painel antigo:
 * `INDICADOR;NEGOCIO;ANO;MES;UNIDADE;VALOR` (decimal com vírgula).
 * NEGOCIO resolvido via `negocioPorPrefixo` (mesma convenção CDL=ROTA/
 * CDR=ARM de outros importadores; qualquer outro valor vira CONS) — migration_131.
 * Indicadores reconhecidos: "Indisponibilidade" e "Devolução" (case-insensitive).
 */
export function parsePainelPerdasAuxCsv(texto: string): ParsePainelPerdasAuxResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  return parsePainelPerdasAuxLinhas(linhasTexto.map(l => l.split(';')))
}

/** Mesmo parser de `parsePainelPerdasAuxCsv`, só que a partir de uma planilha .xlsx (lê sempre a 1ª aba). */
export async function parsePainelPerdasAuxXlsx(file: File): Promise<ParsePainelPerdasAuxResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const linhas: (string | number)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  return parsePainelPerdasAuxLinhas(linhas.filter(l => l.some(c => toStr(c) !== '')))
}
