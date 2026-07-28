import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'
import type { IndicadorKey } from '@/lib/painel-perdas-calculations'

/** Meta anual (R$) de um indicador, por unidade — linha bruta ainda não resolvida pro código da unidade cadastrada. */
export interface ParsedMetaPerdaIndicador {
  unidade: string
  indicador: IndicadorKey
  meta_anual: number
}

/** Linha TOTAL (R$) + "Perdas (sem OC) Acumulado" (%) da planilha, por unidade — mesmos campos do metas_perdas de hoje. */
export interface ParsedMetaPerdaTotal {
  unidade: string
  meta_anual: number
  meta_pct: number
}

export interface ParseMetasPerdasXlsxResultado {
  indicadores: ParsedMetaPerdaIndicador[]
  totais: ParsedMetaPerdaTotal[]
  erros: string[]
}

function normalizarLabel(v: unknown): string {
  return String(v ?? '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

type LinhaIdentificada =
  | { tipo: 'indicador'; key: IndicadorKey }
  | { tipo: 'total' }
  | { tipo: 'faturamento' }
  | { tipo: 'meta_pct' }
  | null

/**
 * Identifica o tipo de uma linha pelo rótulo da coluna A — por prefixo/trecho
 * normalizado (sem acento, maiúsculo), pra tolerar pequenas variações de
 * ortografia da planilha real (ex: "Desconto CIVF" vs "CIVIF" no código).
 */
function identificarLinha(label: unknown): LinhaIdentificada {
  const norm = normalizarLabel(label)
  if (norm === '') return null
  if (norm.startsWith('DEVOLU')) return { tipo: 'indicador', key: 'devolucao' }
  if (norm.startsWith('INDISPONIBIL')) return { tipo: 'indicador', key: 'indisponibilidade' }
  if (norm.startsWith('DESCONTO CIV')) return { tipo: 'indicador', key: 'civif' }
  if (norm.startsWith('BNS')) return { tipo: 'indicador', key: 'bns' }
  if (norm.startsWith('MULTA')) return { tipo: 'indicador', key: 'multas' }
  if (norm.startsWith('PROCESSOS TRABALHISTA') || norm.startsWith('PROC TRAB')) return { tipo: 'indicador', key: 'proc_trab' }
  if (norm.startsWith('SINISTRO')) return { tipo: 'indicador', key: 'sinistro_frota' }
  if (norm.startsWith('VALES')) return { tipo: 'indicador', key: 'vales' }
  if (norm.startsWith('TOTAL')) return { tipo: 'total' }
  if (norm.startsWith('FATURAMENTO')) return { tipo: 'faturamento' }
  if (norm.includes('PERDAS') && norm.includes('ACUMULADO')) return { tipo: 'meta_pct' }
  return null
}

/**
 * Lê a matriz "ACUMULADO" da Meta de Perdas (indicadores nas linhas, unidades
 * nas colunas a partir de B) — mesmo layout da planilha que já é usada pra
 * acompanhar o realizado (ver INDICADORES_PERDAS em painel-perdas-calculations.ts),
 * agora usada pra cadastrar a meta (máximo a perder no ano) de cada indicador.
 * Células zeradas ou vazias = meta zero pra perder naquele indicador. A linha
 * de % (meta_pct) vem da planilha como fração de Excel (ex: -0,0242 pra
 * -2,42%) — multiplicada por 100 pra virar o número percentual usado em
 * metas_perdas (mesma convenção do CSV/formulário manual, ex: -2,42).
 */
function parseMatriz(matriz: unknown[][]): ParseMetasPerdasXlsxResultado {
  const erros: string[] = []
  if (matriz.length === 0) return { indicadores: [], totais: [], erros: ['Planilha vazia.'] }

  const headerRow = matriz[0] ?? []
  const colunas: { col: number; unidade: string }[] = []
  for (let c = 1; c < headerRow.length; c++) {
    const nome = String(headerRow[c] ?? '').trim()
    if (nome !== '') colunas.push({ col: c, unidade: nome })
  }
  if (colunas.length === 0) {
    return { indicadores: [], totais: [], erros: ['Não encontrei nenhuma coluna de unidade na primeira linha.'] }
  }

  const indicadores: ParsedMetaPerdaIndicador[] = []
  const totalPorUnidade = new Map<string, number>()
  const pctPorUnidade = new Map<string, number>()

  for (let r = 1; r < matriz.length; r++) {
    const row = matriz[r]
    if (!row) continue
    const info = identificarLinha(row[0])
    if (!info || info.tipo === 'faturamento') continue // faturamento é só referência da planilha, não é meta

    for (const { col, unidade } of colunas) {
      const valor = parseNumeroPtBr(row[col])
      if (info.tipo === 'indicador') {
        indicadores.push({ unidade, indicador: info.key, meta_anual: valor })
      } else if (info.tipo === 'total') {
        totalPorUnidade.set(unidade, valor)
      } else {
        pctPorUnidade.set(unidade, valor * 100)
      }
    }
  }

  const totais: ParsedMetaPerdaTotal[] = colunas
    .filter(({ unidade }) => totalPorUnidade.has(unidade) || pctPorUnidade.has(unidade))
    .map(({ unidade }) => ({
      unidade,
      meta_anual: totalPorUnidade.get(unidade) ?? 0,
      meta_pct: pctPorUnidade.get(unidade) ?? 0,
    }))

  if (indicadores.length === 0) erros.push('Não encontrei nenhuma linha de indicador reconhecida na planilha (Devolução, Indisponibilidade, Vales, Multas, Processos Trabalhistas, Desconto CIVF, Sinistro de Frota, BNS).')

  return { indicadores, totais, erros }
}

/** Lê o arquivo .xlsx de Meta de Perdas — só aceita a primeira aba do arquivo. */
export async function parseMetasPerdasXlsx(file: File): Promise<ParseMetasPerdasXlsxResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const matriz: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  return parseMatriz(matriz)
}
