export type Natureza = 'custo' | 'performance'

export interface PacoteInfo {
  nome: string
  natureza: Natureza
  prefixos: string[]
}

export type TipoPeriodo = 'MENSAL' | 'ACUMULADO_ANO'

/** Linha no formato longo (equivalente ao historico_dre.csv antigo), vinda de vw_dre_longo. */
export interface DreLongoRow {
  unidade: string
  negocio: string
  ano: number
  mes: number
  tipo_periodo: TipoPeriodo
  conta_codigo: string
  remunerado: number | null
  realizado: number | null
  diferenca: number | null
  /** Meta mensal por conta, exportada pelo próprio GInfo — não usada nos cálculos do Farol (que usam a tabela `metas`, por pacote). */
  avo: number | null
  avr: number | null
}

/**
 * Linha normalizada para os cálculos do Farol, equivalente às colunas
 * REMUN/REAL/DIF/AVR do historico_dre.csv antigo (produzidas por
 * tratar_dre_pro.py a partir do DreLongoRow bruto): `real` e `remun` são
 * sempre valores absolutos (magnitude), `dif` mantém o sinal original
 * (REALIZADO-REMUNERADO), e `avr` tem o sinal invertido para toda conta
 * que não seja EBITDA (232) ou Geração de Caixa (275) — ver normalizarParaCalculo.
 */
export interface DreCalculoRow {
  conta_codigo: string
  real: number
  remun: number
  dif: number
  avr: number
  /** Meta (%) por conta vinda do GInfo, mesmo sinal/inversão do avr; null quando o período não tem AVO (ex: importado antes da migração 001). */
  avo: number | null
}

export interface Meta {
  id?: string
  unidade: string
  negocio: string
  ano: number
  codigo: string
  mes: number // 0 = anual, 1-12 = mensal
  meta_avr: number
}

export interface Unidade {
  id: string
  nome: string
  codigo: string
}

export interface Negocio {
  id: string
  codigo: string
  nome: string
}

export interface Conta {
  codigo: string
  descricao: string
  ordem: number
  nivel: number
  ativo: boolean
}
