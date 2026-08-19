import * as XLSX from 'xlsx'
import type { SetorPagamento } from '@/types'

/**
 * Leitura da planilha de cadastro de lideranças (Reunião Resultados >
 * Pagamento > Cadastro) — colunas FILIAL / SETOR / LIDERANÇA / NÚMERO
 * EXTRATTA. Devolve só texto bruto (setor já identificado, já que isso não
 * depende do banco); quem resolve FILIAL pra unidade+negócio é
 * `resolverFilialSetor` (reuniao-pagamento.ts), que precisa da lista de
 * unidades — fica no componente, mesmo padrão de todo importador do app
 * (parser não conhece o banco).
 *
 * SETOR aceita os 6 reais da Reunião Resultados + "Empurrada"/"EMP" — rótulo
 * de Ponta Grossa/Estância (ver `SetorPagamento`, types/index.ts).
 */
export interface ParsedLiderancaRow {
  filialTexto: string
  setorTexto: string
  /** null = texto não bate com nenhum setor reconhecido — linha vira erro na tela. */
  setor: SetorPagamento | null
  nome: string
  numeroExtratta: string
}

export interface ParseLiderancasResultado {
  linhas: ParsedLiderancaRow[]
  erros: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/** Número Extratta pode vir como texto ou como número do Excel — nunca em notação decimal/científica ("378315.0"). */
function toStrNumero(v: unknown): string {
  if (typeof v === 'number') return String(Math.round(v))
  return toStr(v)
}

const SETOR_POR_TEXTO: Record<string, SetorPagamento> = {
  FINANCEIRO: 'financeiro',
  GENTE: 'gente',
  FROTA: 'frota',
  SEGURANCA: 'seguranca', // já normalizado (sem cedilha/acento)
  DISTRIBUICAO: 'distribuicao',
  ARMAZEM: 'armazem',
  // Rótulo próprio de Ponta Grossa/Estância — o vencedor do mês ainda sai do
  // ranking de 'distribuicao' (ver `setorCompativel`, reuniao-pagamento.ts).
  EMPURRADA: 'empurrada',
  EMP: 'empurrada',
}

/** Identifica o setor pelo texto da coluna SETOR — exato após normalizar (maiúsculas, sem acento). null = não reconhecido. */
export function identificarSetorPagamento(texto: string): SetorPagamento | null {
  return SETOR_POR_TEXTO[normalizar(texto)] ?? null
}

/**
 * Aceita FILIAL / SETOR / LIDERANÇA / NÚMERO EXTRATTA (nessa ordem ou não,
 * casa pelo nome da coluna) — uma linha por pessoa. Não resolve FILIAL pra
 * unidade aqui (ver docstring do módulo); só identifica o SETOR, que é
 * texto puro sem depender do cadastro de unidades.
 */
function parseMatriz(matriz: unknown[][]): ParseLiderancasResultado {
  if (matriz.length === 0) return { linhas: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iFilial = header.findIndex(h => h === 'FILIAL')
  const iSetor = header.findIndex(h => h === 'SETOR')
  const iLideranca = header.findIndex(h => h === 'LIDERANCA' || h === 'LIDER')
  const iExtratta = header.findIndex(h => h.includes('EXTRATTA'))

  if (iFilial === -1 || iSetor === -1 || iLideranca === -1 || iExtratta === -1) {
    return { linhas: [], erros: ['Cabeçalho inválido — esperado colunas FILIAL, SETOR, LIDERANÇA e NÚMERO EXTRATTA'] }
  }

  const linhas: ParsedLiderancaRow[] = []
  const erros: string[] = []

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const filialTexto = toStr(cols[iFilial])
    const setorTexto = toStr(cols[iSetor])
    const nome = toStr(cols[iLideranca])
    const numeroExtratta = toStrNumero(cols[iExtratta])

    if (!filialTexto || !setorTexto || !nome) {
      erros.push(`Linha ${i + 1}: faltou FILIAL, SETOR ou LIDERANÇA`)
      continue
    }
    if (!numeroExtratta) {
      erros.push(`Linha ${i + 1}: faltou o NÚMERO EXTRATTA de "${nome}"`)
      continue
    }

    linhas.push({ filialTexto, setorTexto, setor: identificarSetorPagamento(setorTexto), nome, numeroExtratta })
  }

  return { linhas, erros }
}

/** Lê o CSV (separador ; ou tab). */
export function parseLiderancasCsv(texto: string): ParseLiderancasResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { linhas: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/** Lê a planilha Excel (.xlsx/.xls) — usa a primeira aba. */
export async function parseLiderancasXlsx(file: File): Promise<ParseLiderancasResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { linhas: [], erros: ['Arquivo Excel sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseLiderancasFile(file: File): Promise<ParseLiderancasResultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseLiderancasXlsx(file)
  return parseLiderancasCsv(await file.text())
}
