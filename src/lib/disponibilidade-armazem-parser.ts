import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'

/** Linha bruta ainda não resolvida pro código da unidade cadastrada. */
export interface LinhaDisponibilidadeArmazem {
  unidadeNome: string
  real: number
  /** null quando a planilha não trouxe a coluna de meta (ver `temColunaMeta`) — nesse caso a importação preserva a meta já salva. */
  meta: number | null
}

export interface ParseDisponibilidadeArmazemResultado {
  linhas: LinhaDisponibilidadeArmazem[]
  erros: string[]
  /** false = a planilha não tem a coluna de meta (nenhuma linha teve a chave) — a importação deve preservar a meta já salva, não zerar. */
  temColunaMeta: boolean
}

function buscarCampo(row: Record<string, unknown>, candidatos: string[]): unknown {
  const normalizados = candidatos.map(c => c.trim().toLowerCase())
  for (const chave of Object.keys(row)) {
    if (normalizados.includes(chave.trim().toLowerCase())) return row[chave]
  }
  return undefined
}

/** Aceita "83%"/"83,5%"/0,835/83,5 — sempre devolve na escala de percentual (83.5). */
function parsePercentual(raw: unknown): number {
  if (typeof raw === 'number') return Math.abs(raw) <= 1 ? raw * 100 : raw
  const texto = String(raw ?? '').trim()
  const temSinalPercentual = texto.includes('%')
  const numero = parseNumeroPtBr(texto.replace('%', ''))
  if (!temSinalPercentual && Math.abs(numero) <= 1) return numero * 100
  return numero
}

/**
 * Lê a planilha de Disponibilidade Armazém — colunas "Filial" (unidade),
 * "Disp. Contratado" (realizado) e "META", que às vezes não vem na
 * planilha (nesse caso a importação preserva a última meta importada, ver
 * `temColunaMeta`).
 */
export async function parseDisponibilidadeArmazemXlsx(file: File): Promise<ParseDisponibilidadeArmazemResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const linhasRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

  // A coluna existe se QUALQUER linha tiver a chave (mesmo que vazia nessa
  // linha específica) — só fica ausente de verdade se o cabeçalho "META"
  // nunca apareceu na planilha.
  const temColunaMeta = linhasRaw.some(row => buscarCampo(row, ['Meta']) !== undefined)

  const linhas: LinhaDisponibilidadeArmazem[] = []
  const erros: string[] = []

  linhasRaw.forEach((row, i) => {
    const numeroLinha = i + 2
    const unidadeNome = String(buscarCampo(row, ['Filial']) ?? '').trim()
    const realBruto = buscarCampo(row, ['Disp. Contratado', 'Disp Contratado'])
    const metaBruto = temColunaMeta ? buscarCampo(row, ['Meta']) : undefined

    if (unidadeNome === '' && realBruto == null) return // linha em branco, ignora sem avisar

    if (unidadeNome === '') {
      erros.push(`Linha ${numeroLinha}: sem "Filial".`)
      return
    }
    if (realBruto == null) {
      erros.push(`Linha ${numeroLinha}: faltou "Disp. Contratado" pra ${unidadeNome}.`)
      return
    }
    if (temColunaMeta && metaBruto == null) {
      erros.push(`Linha ${numeroLinha}: faltou "META" pra ${unidadeNome}.`)
      return
    }

    linhas.push({
      unidadeNome,
      real: parsePercentual(realBruto),
      meta: metaBruto == null ? null : parsePercentual(metaBruto),
    })
  })

  return { linhas, erros, temColunaMeta }
}
