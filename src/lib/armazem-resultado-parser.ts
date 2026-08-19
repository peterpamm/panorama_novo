import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'
import { negocioPorPrefixo } from '@/lib/unidade-resolver'
import { parseDuracaoParaMinutos } from '@/lib/duracao'
import { tierDaLinha, type ArmazemTier } from '@/lib/armazem-tiers'
import { lerAbaBrutaEFormatada } from '@/lib/xlsx-abas'

/**
 * Resultado mensal do Armazém vindo do BI — T1 e T2 numa planilha só, cada
 * tier na sua aba ("RV ARM _T1" / "RV ARM _T2"), lidos de uma vez.
 *
 * Antes eram dois parsers e duas telas quase idênticos (um por tier),
 * pedindo o mesmo arquivo. O que de fato muda entre os tiers é só quais
 * indicadores existem e em que tabela o resultado é gravado — o formato da
 * planilha é o mesmo.
 */

const MESES_HEADER = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

/** Indicadores que existem em cada tier — o mesmo rótulo pode valer nos dois (TMA, Presenteísmo AL), com tabela própria em cada um. */
export const INDICADORES_POR_TIER: Record<ArmazemTier, { key: string; nome: string; rotulo: string }[]> = {
  T2: [
    { key: 'presenteismo_al', nome: 'Presenteísmo AL', rotulo: 'PRESENTEISMO' },
    { key: 'efc', nome: 'EFC', rotulo: 'EFC' },
    { key: 'tma', nome: 'TMA', rotulo: 'TMA' },
    { key: 'refugo', nome: 'Refugo', rotulo: 'REFUGO' },
  ],
  T1: [
    { key: 'tma', nome: 'TMA', rotulo: 'TMA' },
    { key: 'disponibilidade_gente', nome: 'Disponibilidade de Gente', rotulo: 'DISPONIBILIDADE' },
    { key: 'presenteismo_al', nome: 'Presenteísmo AL', rotulo: 'PRESENTEISMO' },
  ],
}

/** Tabela de destino do resultado, por tier (migrations 055 e 058). */
export const TABELA_RESULTADO_POR_TIER: Record<ArmazemTier, string> = {
  T2: 'resultados_armazem_bi',
  T1: 'resultados_armazem_t1_bi',
}

export interface ParsedArmazemResultadoRow {
  tier: ArmazemTier
  indicador: string
  /** Nome da unidade, já sem o código numérico do BI (ex: "143 - CDR Bahia" → "CDR BAHIA"). */
  unidade: string
  /** ROTA (prefixo CDL) / ARM (prefixo CDR) / CONS nas demais. */
  negocio: string
  valor: number
  /** Só no formato histórico (colunas de mês) — mês desse valor. Ausente no formato RESULTADO, que usa o mês escolhido na tela. */
  mes?: number
  /** Aba de onde veio, só pra mensagem na tela. */
  aba: string
}

export interface ParseArmazemResultadoRetorno {
  linhas: ParsedArmazemResultadoRow[]
  erros: string[]
  /** Rótulos ignorados por não existirem naquele tier (ex: REFUGO numa aba de T1) — a tela mostra pra não parecer que sumiram sozinhos. */
  ignorados: string[]
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

/** TMA é duração (HH:MM → minutos); os demais são percentuais. */
function parseValor(raw: unknown, indicador: string): number | null {
  return indicador === 'tma' ? parseDuracaoParaMinutos(raw) : parsePercentual(raw)
}

/** Identifica o indicador dentro do tier — por prefixo normalizado, tolerando variação de acento/ortografia. */
export function identificarIndicadorDoTier(label: string, tier: ArmazemTier): string | null {
  const norm = normalizar(label)
  return INDICADORES_POR_TIER[tier].find(i => norm.startsWith(i.rotulo))?.key ?? null
}

/** "143 - CDD Beltrao" → "CDD BELTRAO" — algumas linhas trazem o código numérico do BI na frente do nome. */
function semCodigoNumerico(unidade: string): string {
  return unidade.replace(/^\d+\s*-\s*/, '').trim()
}

/**
 * Lê uma aba. Aceita INDICADOR · UNIDADE · RESULTADO (um mês, escolhido na
 * tela) ou INDICADOR · UNIDADE · JAN · FEV · ... (histórico). O tier de cada
 * linha sai do nome da aba, com a unidade como desempate (ver `tierDaLinha`).
 *
 * `matrizFormatada` é a mesma aba lida com `raw:false` (ver
 * `lerAbaBrutaEFormatada`) — usada só pra TMA, porque a planilha real mistura
 * duas codificações numéricas pra "duração" na mesma coluna/mês a mês (uma
 * fração do dia, outra um inteiro tipo HHMM com formato customizado "00:00")
 * e o valor bruto sozinho não dá pra distinguir uma da outra sem adivinhar.
 * Os demais indicadores continuam lendo o valor bruto, como sempre.
 */
function parseMatriz(matriz: unknown[][], matrizFormatada: unknown[][], nomeAba: string): ParseArmazemResultadoRetorno {
  const vazio: ParseArmazemResultadoRetorno = { linhas: [], erros: [], ignorados: [] }
  if (matriz.length === 0) return vazio

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iIndicador = header.findIndex(h => h === 'INDICADOR')
  const iUnidade = header.findIndex(h => h === 'UNIDADE')
  const iResultado = header.findIndex(h => h === 'RESULTADO')
  const colunasMes = MESES_HEADER
    .map((label, idx) => ({ mes: idx + 1, i: header.findIndex(h => h === label) }))
    .filter(c => c.i !== -1)

  if (iIndicador === -1 || iUnidade === -1 || (iResultado === -1 && colunasMes.length === 0)) return vazio

  const linhas: ParsedArmazemResultadoRow[] = []
  const erros: string[] = []
  const ignorados = new Set<string>()

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    const colsFormatadas = matrizFormatada[i] ?? []
    if (cols.every(c => toStr(c) === '')) continue

    const unidade = semCodigoNumerico(toStr(cols[iUnidade])).toUpperCase()
    if (!unidade) continue

    const tier = tierDaLinha(nomeAba, unidade)
    const rotulo = toStr(cols[iIndicador])
    const indicador = identificarIndicadorDoTier(rotulo, tier)
    if (!indicador) {
      if (rotulo) ignorados.add(`${rotulo} (${tier})`)
      continue
    }

    const negocio = negocioPorPrefixo(unidade)
    // TMA lê o texto formatado da célula (o que a planilha mostra), não o
    // número bruto — ver o comentário da função.
    const celula = (col: number): unknown => (indicador === 'tma' ? colsFormatadas[col] : cols[col])

    if (iResultado !== -1) {
      const valor = parseValor(celula(iResultado), indicador)
      if (valor === null) {
        erros.push(`${nomeAba} linha ${i + 1}: resultado inválido para "${unidade}"`)
        continue
      }
      linhas.push({ tier, indicador, unidade, negocio, valor, aba: nomeAba })
      continue
    }

    for (const { mes, i: iCol } of colunasMes) {
      if (toStr(cols[iCol]) === '') continue // mês ainda sem valor (ex: meses futuros em branco na planilha histórica)
      const valor = parseValor(celula(iCol), indicador)
      if (valor === null) {
        erros.push(`${nomeAba} linha ${i + 1}: valor inválido em ${MESES_HEADER[mes - 1]} para "${unidade}"`)
        continue
      }
      linhas.push({ tier, indicador, unidade, negocio, valor, mes, aba: nomeAba })
    }
  }

  return { linhas, erros, ignorados: Array.from(ignorados) }
}

/** Lê todas as abas do Excel — cabeçalho inesperado numa aba (apoio, notas) é ignorado sem erro. */
export async function parseArmazemResultadosXlsx(file: File): Promise<ParseArmazemResultadoRetorno> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const juntos: ParseArmazemResultadoRetorno = { linhas: [], erros: [], ignorados: [] }
  for (const nomeAba of wb.SheetNames) {
    const { bruta, formatada } = lerAbaBrutaEFormatada(wb.Sheets[nomeAba])
    const parcial = parseMatriz(bruta, formatada, nomeAba)
    juntos.linhas.push(...parcial.linhas)
    juntos.erros.push(...parcial.erros)
    juntos.ignorados.push(...parcial.ignorados.filter(x => !juntos.ignorados.includes(x)))
  }
  return juntos
}

/** Lê o CSV (separador ; ou tab) — sem aba, o tier sai da unidade. Texto puro não tem "bruto vs formatado" — é a mesma coisa. */
export function parseArmazemResultadosCsv(texto: string): ParseArmazemResultadoRetorno {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [], ignorados: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  const matriz = linhasTexto.map(l => l.split(separador))
  return parseMatriz(matriz, matriz, '')
}

/** Detecta o formato pela extensão e lê o arquivo inteiro. */
export async function parseArmazemResultadosFile(file: File): Promise<ParseArmazemResultadoRetorno> {
  if (/\.xlsx?$/i.test(file.name)) return parseArmazemResultadosXlsx(file)
  return parseArmazemResultadosCsv(await file.text())
}
