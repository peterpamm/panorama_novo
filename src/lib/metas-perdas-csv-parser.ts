import { parseNumeroPtBr } from '@/lib/utils'

export interface ParsedMetaPerdasCsvRow {
  unidade: string
  ano: number
  meta_pct: number
  meta_anual: number
}

export interface ParseMetasPerdasCsvResultado {
  linhas: ParsedMetaPerdasCsvRow[]
  erros: string[]
}

const COLUNAS_ESPERADAS = ['unidade', 'ano', 'meta', 'financeiro']

/**
 * Lê o metas_perdas.csv no mesmo formato usado como referência no painel
 * antigo: `unidade;ano;meta;financeiro` (decimal com vírgula) — sem negócio
 * nem mês, porque a meta de Perdas é só por unidade/ano (sempre
 * consolidado).
 */
export function parseMetasPerdasCsv(texto: string): ParseMetasPerdasCsvResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }

  const header = linhasTexto[0].split(';').map(h => h.trim().toLowerCase())
  const indices = COLUNAS_ESPERADAS.map(c => header.indexOf(c))
  if (indices.some(i => i === -1)) {
    return { linhas: [], erros: [`Cabeçalho inválido — esperado: ${COLUNAS_ESPERADAS.join(';')}`] }
  }
  const [iUnidade, iAno, iMeta, iFinanceiro] = indices

  const linhas: ParsedMetaPerdasCsvRow[] = []
  const erros: string[] = []

  for (let i = 1; i < linhasTexto.length; i++) {
    const cols = linhasTexto[i].split(';')
    if (cols.length < COLUNAS_ESPERADAS.length) {
      erros.push(`Linha ${i + 1}: número de colunas inválido`)
      continue
    }
    const unidade = cols[iUnidade].trim().toUpperCase()
    const ano = Number(cols[iAno].trim())
    const meta_pct = parseNumeroPtBr(cols[iMeta])
    const meta_anual = parseNumeroPtBr(cols[iFinanceiro])

    if (!unidade || Number.isNaN(ano)) {
      erros.push(`Linha ${i + 1}: dado inválido`)
      continue
    }
    linhas.push({ unidade, ano, meta_pct, meta_anual })
  }

  return { linhas, erros }
}
