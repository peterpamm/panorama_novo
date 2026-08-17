import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'

/** Linha bruta ainda não resolvida pro código da unidade cadastrada. */
export interface LinhaDisponibilidadeRota {
  unidadeNome: string
  meta: number
  real: number
}

export interface ParseDisponibilidadeRotaResultado {
  linhas: LinhaDisponibilidadeRota[]
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
  // Sem "%" no texto e valor fracionário (ex: "0,835") — normaliza pra escala de percentual.
  if (!temSinalPercentual && Math.abs(numero) <= 1) return numero * 100
  return numero
}

/**
 * Lê a planilha de Disponibilidade Rota Acumulada — colunas "Unidade",
 * "% Disp" (realizado) e "Meta".
 */
export async function parseDisponibilidadeRotaXlsx(file: File): Promise<ParseDisponibilidadeRotaResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const linhasRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

  const linhas: LinhaDisponibilidadeRota[] = []
  const erros: string[] = []

  linhasRaw.forEach((row, i) => {
    const numeroLinha = i + 2
    const unidadeNome = String(buscarCampo(row, ['Unidade']) ?? '').trim()
    // "Disp" sozinha (sem o "%") é uma coluna diferente na planilha real —
    // volume esperado/disponível, não o percentual. Não pode entrar como
    // candidato aqui, senão casa com a coluna errada.
    const realBruto = buscarCampo(row, ['% Disp', '%Disp'])
    const metaBruto = buscarCampo(row, ['Meta'])

    if (unidadeNome === '' && realBruto == null && metaBruto == null) return // linha em branco, ignora sem avisar

    if (unidadeNome === '') {
      erros.push(`Linha ${numeroLinha}: sem "Unidade".`)
      return
    }
    if (realBruto == null || metaBruto == null) {
      erros.push(`Linha ${numeroLinha}: faltou "% Disp" ou "Meta" pra ${unidadeNome}.`)
      return
    }

    linhas.push({ unidadeNome, real: parsePercentual(realBruto), meta: parsePercentual(metaBruto) })
  })

  return { linhas, erros }
}
