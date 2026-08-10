import * as XLSX from 'xlsx'
import { normalizarNomeUnidade } from '@/lib/unidade-resolver'
import { OPERACOES_DTO_T1 } from '@/lib/dto-t1-parser'

/** Contagem agregada de ocorrências FAI de uma unidade (FILIAL), linha por linha. */
export interface FaiUnidadeAgregado {
  /** Texto de "Filial" como veio na planilha (ex: "ESTÂNCIA", "CDR BAHIA"). */
  filial: string
  /** Quantidade de linhas com TIPO = "FAI". */
  totalFai: number
}

export interface ParseFaiResultado {
  agregados: FaiUnidadeAgregado[]
  erros: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/**
 * Planilha de ocorrências — dois layouts aceitos (a Ambev trocou o layout em
 * algum momento, mas pode mandar qualquer um dos dois):
 * - Antigo: colunas "Filial" e "Tipo" — conta como FAI quando Tipo = "FAI"
 *   (igual completo, não é substring).
 * - Novo: colunas "Operação" e "Classificação de Incidentes" — conta como
 *   FAI quando o texto CONTÉM "FAI" (aparece tanto como "FAI" puro quanto
 *   como "FAI - Primeiro Atendimento Ambulatorial").
 * Só ESTÂNCIA e CDR BAHIA entram — qualquer outra unidade no relatório é ignorada.
 */
function parseMatriz(matriz: unknown[][]): ParseFaiResultado {
  if (matriz.length === 0) return { agregados: [], erros: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const iFilial = header.findIndex(h => h === 'FILIAL')
  const iTipo = header.findIndex(h => h === 'TIPO')
  const iOperacao = header.findIndex(h => h === 'OPERACAO')
  const iClassificacao = header.findIndex(h => h === 'CLASSIFICACAO DE INCIDENTES')

  const layoutAntigo = iFilial !== -1 && iTipo !== -1
  const layoutNovo = iOperacao !== -1 && iClassificacao !== -1
  if (!layoutAntigo && !layoutNovo) {
    return { agregados: [], erros: ['Cabeçalho inválido — esperado colunas Filial e Tipo, ou Operação e Classificação de Incidentes'] }
  }

  const iUnidade = layoutAntigo ? iFilial : iOperacao
  const iClassificacaoFai = layoutAntigo ? iTipo : iClassificacao
  // Layout antigo compara igual completo ("Tipo" só tem o código puro); o
  // novo compara substring, porque "Classificação de Incidentes" também
  // traz o texto por extenso (ex: "FAI - Primeiro Atendimento Ambulatorial").
  const casaFai = (texto: string) => layoutAntigo ? texto === 'FAI' : texto.includes('FAI')

  // Pré-popula as duas unidades com zero — se o arquivo não tiver nenhuma
  // linha FAI pra uma delas (ou nem mencionar a unidade), ainda assim
  // precisamos importar um resultado zerado (bateu a meta), não deixar sem
  // importar nada.
  const porFilial = new Map<string, number>(OPERACOES_DTO_T1.map(op => [op, 0]))

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const filial = toStr(cols[iUnidade]).toUpperCase()
    if (!filial) continue
    const norm = normalizarNomeUnidade(filial)
    const canonico = OPERACOES_DTO_T1.find(op => normalizarNomeUnidade(op) === norm)
    if (!canonico) continue

    if (casaFai(normalizar(toStr(cols[iClassificacaoFai])))) porFilial.set(canonico, (porFilial.get(canonico) ?? 0) + 1)
  }

  const agregados: FaiUnidadeAgregado[] = Array.from(porFilial.entries()).map(([filial, totalFai]) => ({ filial, totalFai }))

  return { agregados, erros: [] }
}

/** Lê o CSV (separador ; ou tab). */
export function parseFaiCsv(texto: string): ParseFaiResultado {
  const linhasTexto = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  if (linhasTexto.length === 0) return { agregados: [], erros: [] }
  const separador = linhasTexto[0].includes('\t') ? '\t' : ';'
  return parseMatriz(linhasTexto.map(l => l.split(separador)))
}

/** Lê a planilha Excel (.xlsx/.xls) — usa a primeira aba. */
export async function parseFaiXlsx(file: File): Promise<ParseFaiResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { agregados: [], erros: ['Arquivo Excel sem abas'] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseMatriz(matriz)
}

/** Detecta o formato pela extensão e faz o parse do arquivo. */
export async function parseFaiFile(file: File): Promise<ParseFaiResultado> {
  if (/\.xlsx?$/i.test(file.name)) return parseFaiXlsx(file)
  return parseFaiCsv(await file.text())
}
