import * as XLSX from 'xlsx'
import { parseNumeroPtBr } from '@/lib/utils'

/** Linha bruta ainda não resolvida pro código da unidade cadastrada. */
export interface LinhaLucro {
  unidadeNome: string
  negocio: string
  ano: number
  mes: number
  volume: number
  valorHl: number
  lucro: number
}

export interface ParseLucroResultado {
  linhas: LinhaLucro[]
  erros: string[]
}

// "ROTA_2_3_2026" / "AS_2_3_2026" → negócio "ROTA"/"AS", mês 3, ano 2026.
// O número entre o negócio e o mês (sempre "2" nos exemplos vistos) não tem
// uso conhecido — ignorado.
const PADRAO_VIGENCIA = /^([A-Z]+)_\d+_(\d{1,2})_(\d{4})$/

function parseVigencia(v: unknown): { negocio: string; mes: number; ano: number } | null {
  const texto = String(v ?? '').trim().toUpperCase()
  const m = texto.match(PADRAO_VIGENCIA)
  if (!m) return null
  const [, negocio, mesStr, anoStr] = m
  const mes = Number(mesStr)
  if (mes < 1 || mes > 12) return null
  return { negocio, mes, ano: Number(anoStr) }
}

/**
 * Busca um campo por uma lista de nomes de coluna possíveis (ignora
 * maiúsculas/minúsculas e espaço sobrando) — a planilha do ROTA usa "Volume
 * Atual"/"R$/HL"/"Lucro", a do AS usa "volumeAtual"/"reaisPorHectolitro"/
 * "lucro" pros mesmos dados. "Vigencia" e "Unidade - Nome" são iguais nas duas.
 */
function buscarCampo(row: Record<string, unknown>, candidatos: string[]): unknown {
  const normalizados = candidatos.map(c => c.trim().toLowerCase())
  for (const chave of Object.keys(row)) {
    const idx = normalizados.indexOf(chave.trim().toLowerCase())
    if (idx !== -1) return row[chave]
  }
  return undefined
}

/**
 * Lê a planilha de Lucro da Ambev (aba única, colunas nomeadas) — usa
 * "Vigencia" (negócio + mês + ano), "Unidade - Nome", volume, R$/HL e
 * Lucro (nomes de coluna variam entre a planilha do ROTA e a do AS, ver
 * `buscarCampo`). O Lucro é importado como veio da planilha (não
 * recalculado como Volume × R$/HL aqui) — o R$/HL exibido na origem já é
 * arredondado, então recalcular geraria uma diferença de centavos vs o
 * número oficial da Ambev.
 */
export async function parseLucroXlsx(file: File): Promise<ParseLucroResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const linhasRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

  const linhas: LinhaLucro[] = []
  const erros: string[] = []

  linhasRaw.forEach((row, i) => {
    const numeroLinha = i + 2 // +1 do cabeçalho, +1 pra virar 1-indexado
    const vigenciaBruta = buscarCampo(row, ['Vigencia', 'Vigência'])
    const unidadeNome = String(buscarCampo(row, ['Unidade - Nome']) ?? '').trim()
    const vigencia = parseVigencia(vigenciaBruta)

    if (unidadeNome === '' && !vigenciaBruta) return // linha em branco, ignora sem avisar

    if (unidadeNome === '') {
      erros.push(`Linha ${numeroLinha}: sem "Unidade - Nome".`)
      return
    }
    if (vigencia === null) {
      erros.push(`Linha ${numeroLinha}: não entendi "Vigencia" (${String(vigenciaBruta ?? '')}) — esperado algo como ROTA_2_3_2026.`)
      return
    }

    const volume = parseNumeroPtBr(buscarCampo(row, ['Volume Atual', 'volumeAtual']))
    const valorHl = parseNumeroPtBr(buscarCampo(row, ['R$/HL', 'reaisPorHectolitro']))
    const lucro = parseNumeroPtBr(buscarCampo(row, ['Lucro', 'lucro']))

    linhas.push({ unidadeNome, negocio: vigencia.negocio, ano: vigencia.ano, mes: vigencia.mes, volume, valorHl, lucro })
  })

  return { linhas, erros }
}
