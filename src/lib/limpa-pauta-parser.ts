import * as XLSX from 'xlsx'

/**
 * Linha da planilha "Limpa Pauta" exportada do Freightech (sistema da
 * Ambev) — a exportação completa (EXPORTACAO_LIMPA_PAUTAS) traz muito mais
 * colunas (Id/Operador/Data Solicitação/Solicitante/Evidências/Tema/Motivo
 * Aprovação-Reprovação/Obs. GOD/Obs. Campo Regional/Obs. AC Produtividade/
 * Obs. AC Custos...), mas só usamos Segmentos/Unidades/Descrição/Status/
 * Valor solicitado/Categoria — o resto fica de fora de propósito (as 3
 * aprovações internas e a justificativa de cada uma são tratativa nossa,
 * feitas na tela, não vêm prontas da planilha). Algumas exportações mais
 * antigas trazem a coluna Unidades truncada (ex: "[ARMAZEM] CDR Bahia -
 * LOG20 L...") — por isso `unidadeNomeOriginal` (texto cru, pra auditoria)
 * e `unidadeNomeExtraido` (sem prefixo "[SEGMENTO]"/sufixo "- LOG20..."/
 * "...", pronto pra `resolverUnidadeFlexivel`) ficam separados; em
 * exportações novas (nome já vem limpo) a extração é só um no-op.
 */
export interface ParsedLimpaPautaRow {
  segmento: string
  categoria: string
  unidadeNomeOriginal: string
  unidadeNomeExtraido: string
  status: string
  valor: number
  /** Coluna "Descrição" — vai pro campo `observacao` do registro, pra lembrar do que se trata o chamado. Nem toda exportação tem essa coluna, aí fica ''. */
  descricao: string
  /** Coluna "Id" (exportação completa) — chave de deduplicação na importação (upsert por `id_freightech`). Nem toda exportação tem essa coluna, aí fica null e a linha sempre entra como nova (sem dedup possível). */
  idFreightech: string | null
}

export interface ParseLimpaPautaResultado {
  linhas: ParsedLimpaPautaRow[]
  erros: string[]
}

function normalizarHeader(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/** "[ARMAZEM] CDR Bahia - LOG20 L..." → "CDR Bahia" — tira o prefixo "[...]", o sufixo "- LOG20..." (quando sobrevive ao corte) e "..." de truncamento. */
function extrairNomeUnidade(celula: string): string {
  return celula
    .replace(/^\[[^\]]*\]\s*/, '')
    .replace(/\s*-\s*LOG20.*$/i, '')
    .replace(/\.{2,}\s*$/, '')
    .trim()
}

/** "Valor solicitado" vem em formato US (vírgula de milhar, ponto decimal) — ex: " 2,874.72 " — nunca pt-BR, mesmo a planilha sendo de uma empresa brasileira. */
function parseValorUs(raw: unknown): number | null {
  const str = toStr(raw).replace(/,/g, '')
  if (str === '' || !/^-?\d+(\.\d+)?$/.test(str)) return null
  const valor = Number(str)
  return Number.isFinite(valor) ? valor : null
}

const HEADERS = ['SEGMENTOS', 'CATEGORIA', 'UNIDADES', 'STATUS', 'VALOR SOLICITADO']

export function parseLimpaPautaMatriz(matriz: unknown[][]): ParseLimpaPautaResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const iHeader = matriz.findIndex(row => row.some(c => normalizarHeader(toStr(c)) === 'UNIDADES'))
  if (iHeader === -1) return { linhas: [], erros: ['Cabeçalho não encontrado — esperado colunas Segmentos, Categoria, Unidades, Status e Valor solicitado'] }

  const header = matriz[iHeader].map(c => normalizarHeader(toStr(c)))
  const iSegmento = header.findIndex(h => h === 'SEGMENTOS')
  const iCategoria = header.findIndex(h => h === 'CATEGORIA')
  const iUnidade = header.findIndex(h => h === 'UNIDADES')
  const iStatus = header.findIndex(h => h === 'STATUS')
  const iValor = header.findIndex(h => h === 'VALOR SOLICITADO')
  // "Descrição" e "Id" são opcionais — exportações mais antigas não têm essas colunas.
  const iDescricao = header.findIndex(h => h === 'DESCRICAO')
  const iId = header.findIndex(h => h === 'ID')
  if (iSegmento === -1 || iCategoria === -1 || iUnidade === -1 || iStatus === -1 || iValor === -1) {
    return { linhas: [], erros: [`Cabeçalho inválido — esperado colunas: ${HEADERS.join(', ')}`] }
  }

  const linhas: ParsedLimpaPautaRow[] = []
  const erros: string[] = []

  for (let i = iHeader + 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const unidadeNomeOriginal = toStr(cols[iUnidade])
    const segmento = toStr(cols[iSegmento])
    const categoria = toStr(cols[iCategoria])
    const status = toStr(cols[iStatus])
    const valor = parseValorUs(cols[iValor])

    if (!unidadeNomeOriginal) { erros.push(`Linha ${i + 1}: coluna Unidades vazia`); continue }
    if (!categoria) { erros.push(`Linha ${i + 1}: coluna Categoria vazia`); continue }
    if (!status) { erros.push(`Linha ${i + 1}: coluna Status vazia`); continue }
    if (valor === null) { erros.push(`Linha ${i + 1}: valor inválido ("${toStr(cols[iValor])}")`); continue }

    linhas.push({
      segmento,
      categoria,
      unidadeNomeOriginal,
      unidadeNomeExtraido: extrairNomeUnidade(unidadeNomeOriginal),
      status,
      valor,
      descricao: iDescricao === -1 ? '' : toStr(cols[iDescricao]),
      idFreightech: iId === -1 ? null : (toStr(cols[iId]) || null),
    })
  }

  return { linhas, erros }
}

/** Lê a planilha Excel/CSV do Freightech — a aba é sempre a primeira. */
export async function parseLimpaPautaFile(file: File): Promise<ParseLimpaPautaResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { linhas: [], erros: ['Arquivo sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
  return parseLimpaPautaMatriz(matriz)
}
