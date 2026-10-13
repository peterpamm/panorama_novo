import * as XLSX from 'xlsx'
import { resolverUnidadeFlexivel } from '@/lib/unidade-resolver'
import type { Unidade } from '@/types'

/** Linha pronta pra gravar em `relatos_seguranca` — unidade já resolvida (codigo). */
export interface ParsedRelatoSeguranca {
  relato_id: number
  unidade: string
  data_ocorrencia: string // 'YYYY-MM-DD'
  ano: number
  mes: number
  classificacao: string
  sif: boolean
  /** Texto original da coluna SIF (ex: "SIF PERCUSOR") — null quando não é SIF ("NÃO"/vazio). */
  sif_tipo: string | null
  tipo_relato: string | null
  detalhamento: string | null
}

export interface ParseRelatosResultado {
  linhas: ParsedRelatoSeguranca[]
  erros: string[]
  unidadesNaoReconhecidas: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** "DATA OCORRÊNCIA" vem como "31/08/2026 22:59" (texto) ou `Date` (célula tipada) — só a parte da data importa, hora é descartada. */
function parseData(raw: unknown): { iso: string; ano: number; mes: number } | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return { iso: `${raw.getFullYear()}-${pad2(raw.getMonth() + 1)}-${pad2(raw.getDate())}`, ano: raw.getFullYear(), mes: raw.getMonth() + 1 }
  }
  const str = toStr(raw)
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return null
  const dia = Number(match[1])
  const mes = Number(match[2])
  const ano = Number(match[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return { iso: `${ano}-${pad2(mes)}-${pad2(dia)}`, ano, mes }
}

const HEADERS = {
  id: 'ID',
  desconsiderado: 'DESCONSIDERADO',
  data: 'DATA OCORRÊNCIA',
  unidade: 'CDD',
  classificacao: 'CLASSIFICAÇÃO',
  tipoRelato: 'TIPO DO RELATO',
  sif: 'SIF',
  detalhamento: 'DETALHAMENTO',
}

/**
 * Planilha "RELATOS" (relatos de segurança — RELATOS/GSDPQ), aba única.
 * Colunas usadas: ID (chave de upsert), DESCONSIDERADO (linha marcada como
 * inválida pelo time de segurança — pulada), DATA OCORRÊNCIA (define
 * ano/mês), CDD (texto livre tipo "CDD ARACAJU" — resolvido pra unidade via
 * `resolverUnidadeFlexivel`, tolera variações de prefixo), CLASSIFICAÇÃO
 * (não é lista fechada — o que vier vira uma "fileira" da pirâmide), SIF
 * ("NÃO" = não é SIF, qualquer outro valor preenchido = é — o texto original
 * também é guardado em `sif_tipo`, ex: "SIF PERCUSOR"/"SIF POTENCIAL", pra
 * filtros mais específicos na Pirâmide) e DETALHAMENTO
 * (texto livre da ocorrência — usado na tabela de eventos graves/SIF do
 * slide). Demais colunas da planilha real (função, área etc.) não são
 * usadas nessa primeira leva.
 */
export function parseRelatosSegurancaMatriz(matriz: unknown[][], unidades: Unidade[]): ParseRelatosResultado {
  if (matriz.length === 0) return { linhas: [], erros: [], unidadesNaoReconhecidas: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const idx = (nome: string) => header.findIndex(h => h === normalizar(nome))
  const iId = idx(HEADERS.id)
  const iDesconsiderado = idx(HEADERS.desconsiderado)
  const iData = idx(HEADERS.data)
  const iUnidade = idx(HEADERS.unidade)
  const iClassificacao = idx(HEADERS.classificacao)
  const iTipoRelato = idx(HEADERS.tipoRelato)
  const iSif = idx(HEADERS.sif)
  const iDetalhamento = idx(HEADERS.detalhamento)

  if (iId === -1 || iData === -1 || iUnidade === -1 || iClassificacao === -1) {
    return {
      linhas: [], erros: ['Cabeçalho inválido — esperado pelo menos as colunas ID, DATA OCORRÊNCIA, CDD e CLASSIFICAÇÃO'],
      unidadesNaoReconhecidas: [],
    }
  }

  const linhas: ParsedRelatoSeguranca[] = []
  const erros: string[] = []
  const unidadesNaoReconhecidas = new Set<string>()

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    if (iDesconsiderado !== -1 && toStr(cols[iDesconsiderado]) !== '') continue // relato marcado como inválido pelo time de segurança

    const idTexto = toStr(cols[iId])
    const relatoId = Number(idTexto)
    if (idTexto === '' || !Number.isInteger(relatoId)) {
      erros.push(`Linha ${i + 1}: ID inválido ("${idTexto}")`)
      continue
    }

    const dataParsed = parseData(cols[iData])
    if (!dataParsed) {
      erros.push(`Linha ${i + 1}: data inválida em "${HEADERS.data}" ("${toStr(cols[iData])}")`)
      continue
    }

    const unidadeTexto = toStr(cols[iUnidade])
    const unidade = resolverUnidadeFlexivel(unidadeTexto, unidades)
    if (!unidade) {
      unidadesNaoReconhecidas.add(unidadeTexto)
      continue
    }

    const classificacao = toStr(cols[iClassificacao]).toUpperCase()
    if (!classificacao) {
      erros.push(`Linha ${i + 1}: sem "${HEADERS.classificacao}" preenchida`)
      continue
    }

    const sifTexto = iSif !== -1 ? toStr(cols[iSif]).toUpperCase() : ''
    const sif = sifTexto !== '' && sifTexto !== 'NAO' && sifTexto !== 'NÃO'

    linhas.push({
      relato_id: relatoId,
      unidade: unidade.codigo,
      data_ocorrencia: dataParsed.iso,
      ano: dataParsed.ano,
      mes: dataParsed.mes,
      classificacao,
      sif,
      sif_tipo: sif ? sifTexto : null,
      tipo_relato: iTipoRelato !== -1 ? (toStr(cols[iTipoRelato]) || null) : null,
      detalhamento: iDetalhamento !== -1 ? (toStr(cols[iDetalhamento]) || null) : null,
    })
  }

  return { linhas, erros, unidadesNaoReconhecidas: Array.from(unidadesNaoReconhecidas).sort() }
}

/** Lê a planilha Excel (.xlsx/.xls) — aba "RELATOS" se existir, senão a primeira. */
export async function parseRelatosSegurancaXlsx(file: File, unidades: Unidade[]): Promise<ParseRelatosResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const nomeAba = wb.SheetNames.includes('RELATOS') ? 'RELATOS' : wb.SheetNames[0]
  const sheet = wb.Sheets[nomeAba]
  if (!sheet) return { linhas: [], erros: ['Arquivo Excel sem abas'], unidadesNaoReconhecidas: [] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseRelatosSegurancaMatriz(matriz, unidades)
}
