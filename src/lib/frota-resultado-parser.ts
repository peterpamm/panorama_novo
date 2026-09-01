import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'

/**
 * Linha da planilha de resultado da Frota: unidade + os indicadores do mês —
 * Desconto CIVF (R$), Desconto Stress Test (R$) e Disponibilidade
 * Empilhadeira / Aderência à Milimetragem / Indisponibilidade Manutenção /
 * Aderência ao Checklist (%, só ESTÂNCIA/PONTA GROSSA/CDR BAHIA têm valor —
 * ver `OPERACOES_FROTA_T1`, rv-frota-t1.ts). Custos Gerais (DRE 113) não
 * entra aqui — vem direto do DRE, sem planilha.
 */
export interface ParsedFrotaResultadoRow {
  unidade: string
  civf: number | null
  stressTest: number | null
  dispEmpilhadeira: number | null
  adMilimetragem: number | null
  indispManutencao: number | null
  adChecklist: number | null
}

export interface ParseFrotaResultadoResultado {
  linhas: ParsedFrotaResultadoRow[]
  erros: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/** "1.500,00" → 1500; "-", "NA" e vazio viram null (sem resultado, não zero) — pros indicadores em R$ (CIVF, Stress Test). */
function parseValor(raw: unknown): number | null {
  if (typeof raw === 'number') return raw
  const str = toStr(raw)
  if (str === '' || str === '-' || normalizar(str) === 'N/A') return null
  const n = parseNumeroPtBr(str)
  return n === 0 && !/^0[,.]?0*$/.test(str) ? null : n
}

/** Coluna formatada como % no Excel vem como fração (0,511 = 51,1%) — mesma pegadinha da célula de duração (ver parseDuracaoParaMinutos), aqui sempre fração (não há variante "número puro" observada nessa planilha). "-"/"NA"/vazio viram null. */
function parseValorPct(raw: unknown): number | null {
  if (typeof raw === 'number') return Math.round(raw * 100 * 100) / 100
  const str = toStr(raw)
  if (str === '' || str === '-' || normalizar(str) === 'N/A') return null
  const n = parseNumeroPtBr(str)
  return Number.isNaN(n) ? null : n
}

/**
 * Planilha de Resultado da Frota (aba "RESULTADO") — unidade pela coluna CDD
 * GINFO, os demais indicadores por nome de coluna (TIER/NEGOCIO não são
 * lidos — a restrição de quais unidades participam de cada indicador vem do
 * cadastro de meta, não da planilha).
 */
function parseMatriz(matriz: unknown[][]): ParseFrotaResultadoResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iUnidade = header.findIndex(h => h === 'CDD GINFO')
  const iCivf = header.findIndex(h => h === 'CIVF')
  const iStressTest = header.findIndex(h => h === 'TT STRESS TEST')
  const iDispEmpilhadeira = header.findIndex(h => h === 'DISP. EMPILHADEIRA' || h === 'DISP EMPILHADEIRA')
  const iAdMilimetragem = header.findIndex(h => h === 'ADERENCIA MM')
  const iIndispManutencao = header.findIndex(h => h === 'INDSP MANUT')
  const iAdChecklist = header.findIndex(h => h === 'ADERENCIA CHECKLIST')

  if (iUnidade === -1 || iCivf === -1 || iStressTest === -1) {
    return { linhas: [], erros: ['Cabeçalho inválido — esperado colunas CDD GINFO, CIVF e TT STRESS TEST'] }
  }

  const linhas: ParsedFrotaResultadoRow[] = []

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const unidade = toStr(cols[iUnidade]).toUpperCase()
    if (!unidade) continue

    linhas.push({
      unidade,
      civf: parseValor(cols[iCivf]),
      stressTest: parseValor(cols[iStressTest]),
      dispEmpilhadeira: iDispEmpilhadeira === -1 ? null : parseValorPct(cols[iDispEmpilhadeira]),
      adMilimetragem: iAdMilimetragem === -1 ? null : parseValorPct(cols[iAdMilimetragem]),
      indispManutencao: iIndispManutencao === -1 ? null : parseValorPct(cols[iIndispManutencao]),
      adChecklist: iAdChecklist === -1 ? null : parseValorPct(cols[iAdChecklist]),
    })
  }

  return { linhas, erros: [] }
}

/** Lê o CSV (separador ; ou tab) — sem conceito de aba, lê o conteúdo todo. */
export function parseFrotaResultadoCsv(texto: string): ParseFrotaResultadoResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/** Lê a planilha Excel (.xlsx/.xls) — usa especificamente a aba "Resultado", não a primeira. */
export async function parseFrotaResultadoXlsx(file: File): Promise<ParseFrotaResultadoResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const nomeAba = wb.SheetNames.find(n => normalizar(n) === 'RESULTADO')
  if (!nomeAba) {
    return { linhas: [], erros: [`Aba "Resultado" não encontrada no arquivo (abas disponíveis: ${wb.SheetNames.join(', ')})`] }
  }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeAba], { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseFrotaResultadoFile(file: File): Promise<ParseFrotaResultadoResultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseFrotaResultadoXlsx(file)
  return parseFrotaResultadoCsv(await file.text())
}
