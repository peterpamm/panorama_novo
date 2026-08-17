import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'
import { normalizarNomeUnidade } from '@/lib/unidade-resolver'
import type { DisponibilidadeTipo } from '@/lib/farol-gerentes'

/** Linha bruta ainda não resolvida pro código da unidade cadastrada. */
export interface LinhaScorecard {
  unidadeNome: string
  /** Canal já traduzido pro negócio do app (ver `negocioDoCanal`). */
  negocio: DisponibilidadeTipo
  /** Texto do canal como veio na planilha, só pra mensagem de erro. */
  canalTexto: string
  /** Score em escala de percentual (ex: 97.4 = 97,4%). */
  score: number
}

export interface ParseScorecardResultado {
  linhas: LinhaScorecard[]
  erros: string[]
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
  // Número já vem certo do Excel (célula numérica) — passar por String() antes
  // de parsear quebraria (0.9 vira "0.9", e parseNumeroPtBr lê "." como
  // separador de milhar do padrão pt-BR, virando 9 em vez de 0,9).
  if (typeof raw === 'number') return Math.abs(raw) <= 1 ? raw * 100 : raw

  const texto = String(raw ?? '').trim()
  const temSinalPercentual = texto.includes('%')
  const numero = parseNumeroPtBr(texto.replace('%', ''))
  // Sem "%" no texto e valor fracionário (ex: "0,974") — normaliza pra escala de percentual.
  if (!temSinalPercentual && Math.abs(numero) <= 1) return numero * 100
  return numero
}

/**
 * Traduz o canal da planilha pro negócio usado no app: "Apoio Logístico" é
 * Armazém, "Distribuição Urbana" é Rota, "Empurrada" é Empurrada. Casa por
 * texto normalizado (maiúsculas, sem acento) e por trecho, pra aguentar
 * variação de escrita ("APOIO LOG.", "DISTRIBUICAO URBANA (DU)"). Devolve
 * `undefined` quando o canal não é nenhum dos três.
 */
export function negocioDoCanal(canal: string): DisponibilidadeTipo | undefined {
  const norm = normalizarNomeUnidade(canal)
  if (norm.includes('APOIO LOG')) return 'ARM'
  if (norm.includes('DISTRIBUICAO URBANA') || norm === 'DU') return 'ROTA'
  if (norm.includes('EMPURRADA')) return 'EMP'
  return undefined
}

/**
 * Lê a planilha de Scorecard — colunas "Unidade", "Canal" e "Score".
 * Uma linha por unidade × canal; o canal vira o negócio do app
 * (ver `negocioDoCanal`), e alimenta as linhas "Scorecard Rota./Arm./Empur."
 * do Farol Gerentes.
 */
export async function parseScorecardXlsx(file: File): Promise<ParseScorecardResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const linhasRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

  const linhas: LinhaScorecard[] = []
  const erros: string[] = []

  linhasRaw.forEach((row, i) => {
    const numeroLinha = i + 2
    const unidadeNome = String(buscarCampo(row, ['Unidade', 'Filial']) ?? '').trim()
    const canalTexto = String(buscarCampo(row, ['Canal']) ?? '').trim()
    const scoreBruto = buscarCampo(row, ['Score', 'Scorecard'])

    if (unidadeNome === '' && canalTexto === '' && scoreBruto == null) return // linha em branco, ignora sem avisar

    if (unidadeNome === '') {
      erros.push(`Linha ${numeroLinha}: sem "Unidade".`)
      return
    }
    if (canalTexto === '') {
      erros.push(`Linha ${numeroLinha}: sem "Canal" pra ${unidadeNome}.`)
      return
    }
    const negocio = negocioDoCanal(canalTexto)
    if (!negocio) {
      erros.push(`Linha ${numeroLinha}: canal "${canalTexto}" não reconhecido (esperado Apoio Logístico, Distribuição Urbana ou Empurrada).`)
      return
    }
    if (scoreBruto == null) {
      erros.push(`Linha ${numeroLinha}: faltou "Score" pra ${unidadeNome} (${canalTexto}).`)
      return
    }

    linhas.push({ unidadeNome, negocio, canalTexto, score: parsePercentual(scoreBruto) })
  })

  return { linhas, erros }
}
