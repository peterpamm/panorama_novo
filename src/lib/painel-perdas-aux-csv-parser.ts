import { parseNumeroPtBr } from '@/lib/utils'
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

/**
 * Lê o painel_de_perdas.csv no formato herdado do painel antigo:
 * `INDICADOR;NEGOCIO;ANO;MES;UNIDADE;VALOR` (decimal com vírgula).
 * A coluna NEGOCIO é ignorada — sempre CONS.
 * Indicadores reconhecidos: "Indisponibilidade" e "Devolução" (case-insensitive).
 */
export function parsePainelPerdasAuxCsv(texto: string): ParsePainelPerdasAuxResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }

  const header = linhasTexto[0].split(';').map(h => h.trim().toLowerCase())
  const indices = COLUNAS_ESPERADAS.map(c => header.indexOf(c))
  if (indices.some(i => i === -1)) {
    return { linhas: [], erros: [`Cabeçalho inválido — esperado: ${COLUNAS_ESPERADAS.join(';').toUpperCase()}`] }
  }
  const [iIndicador, , iAno, iMes, iUnidade, iValor] = indices

  const linhas: ParsedPainelPerdasAuxRow[] = []
  const erros: string[] = []

  for (let i = 1; i < linhasTexto.length; i++) {
    const cols = linhasTexto[i].split(';')
    if (cols.length < COLUNAS_ESPERADAS.length) {
      erros.push(`Linha ${i + 1}: número de colunas inválido`)
      continue
    }

    const indicadorRaw = cols[iIndicador].trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    const indicador = MAPA_INDICADOR[indicadorRaw]
    if (!indicador) {
      erros.push(`Linha ${i + 1}: indicador desconhecido "${cols[iIndicador].trim()}"`)
      continue
    }

    const unidade = cols[iUnidade].trim().toUpperCase()
    const ano = Number(cols[iAno].trim())
    const mes = Number(cols[iMes].trim())
    const valor = parseNumeroPtBr(cols[iValor])

    if (!unidade || Number.isNaN(ano) || Number.isNaN(mes) || mes < 1 || mes > 12) {
      erros.push(`Linha ${i + 1}: dado inválido`)
      continue
    }

    linhas.push({ unidade, ano, mes, indicador, valor })
  }

  return { linhas, erros }
}
