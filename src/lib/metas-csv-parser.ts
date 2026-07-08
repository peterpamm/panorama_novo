import { parseNumeroPtBr } from '@/lib/utils'

export interface ParsedMetaCsvRow {
  unidade: string
  negocio: string
  ano: number
  codigo: string
  mes: number
  meta_avr: number
}

export interface ParseMetasCsvResultado {
  linhas: ParsedMetaCsvRow[]
  erros: string[]
}

const COLUNAS_ESPERADAS = ['unidade', 'negocio', 'ano', 'codigo', 'meta_avr', 'mes']

/**
 * Lê o metas.csv no mesmo formato usado como referência no painel antigo:
 * `unidade;negocio;ano;codigo;meta_avr;mes` (decimal com vírgula, mês 0 =
 * meta anual). O código da conta vem sem zero à esquerda quando o Excel/CSV
 * trata a coluna como número (ex: "21" em vez de "021") — por isso sempre
 * preenchemos até 3 dígitos, pro mesmo padrão usado em PACOTES/conta_codigo.
 */
export function parseMetasCsv(texto: string): ParseMetasCsvResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }

  const header = linhasTexto[0].split(';').map(h => h.trim().toLowerCase())
  const indices = COLUNAS_ESPERADAS.map(c => header.indexOf(c))
  if (indices.some(i => i === -1)) {
    return { linhas: [], erros: [`Cabeçalho inválido — esperado: ${COLUNAS_ESPERADAS.join(';')}`] }
  }
  const [iUnidade, iNegocio, iAno, iCodigo, iMetaAvr, iMes] = indices

  const linhas: ParsedMetaCsvRow[] = []
  const erros: string[] = []

  for (let i = 1; i < linhasTexto.length; i++) {
    const cols = linhasTexto[i].split(';')
    if (cols.length < COLUNAS_ESPERADAS.length) {
      erros.push(`Linha ${i + 1}: número de colunas inválido`)
      continue
    }
    const unidade = cols[iUnidade].trim().toUpperCase()
    const negocio = cols[iNegocio].trim().toUpperCase()
    const ano = Number(cols[iAno].trim())
    const codigo = cols[iCodigo].trim().padStart(3, '0')
    const mes = Number(cols[iMes].trim())
    const meta_avr = parseNumeroPtBr(cols[iMetaAvr])

    if (!unidade || !negocio || Number.isNaN(ano) || Number.isNaN(mes)) {
      erros.push(`Linha ${i + 1}: dado inválido`)
      continue
    }
    linhas.push({ unidade, negocio, ano, codigo, mes, meta_avr })
  }

  return { linhas, erros }
}
