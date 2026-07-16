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

/** Meta de Perdas — só por unidade + ano (sempre consolidado, sem quebra mensal), base do futuro Painel de Perdas. */
export interface MetaPerdas {
  id?: string
  unidade: string
  ano: number
  /** % de perdas sobre o faturamento, negativo (ex: -2.42). */
  meta_pct: number
  /** Meta financeira anual em R$, negativo. */
  meta_anual: number
}

export interface Unidade {
  id: string
  nome: string
  codigo: string
  /** Nome completo usado pelo GInfo no arquivo de download (ex: "FOZ_DO_IGUACU"), pra reconhecimento automático na importação em massa. */
  nome_ginfo: string | null
  /** Data (YYYY-MM-DD) em que a unidade começou a operar — null se já existia antes de qualquer dado importado. Usado pra ajustar a meta de Redução de Custos em anos em que a unidade só tem histórico parcial. */
  data_entrada: string | null
  /** Nomes alternativos vindos de arquivos externos (BI da Ambev etc) — ex: CAMACARI ← ["CDL CAMAÇARI", "CDR BAHIA"]. */
  apelidos?: string[] | null
}

/** Meta de gente (BI da Ambev): indicador × operação do BI × ano × mês, valor em %. */
export interface MetaGente {
  id?: string
  indicador: string
  /** Unidade resolvida pelos apelidos — pode repetir entre operações (ex: CDL CAMAÇARI e CDR BAHIA → CAMACARI). */
  unidade: string
  /** Nome original da operação no BI — parte da chave, preserva metas distintas da mesma unidade (rota vs empurrada). */
  operacao_bi: string
  /** Negócio da operação (ROTA/ARMAZEM/...) — auto-sugerido pelo prefixo (CDL→ROTA, CDR→ARMAZEM), editável na tela. */
  negocio: string
  /** Peso (%) desse indicador na RV dessa operação — cadastro manual (varia por operação: ex. rota de Camaçari 30%, Foz 15%+15%). */
  peso: number
  ano: number
  mes: number
  valor: number
}

/** Alteração retroativa detectada num mês já encerrado ao reimportar uma unidade/negócio/ano (espelha importacoes_alteracoes). */
export interface AlteracaoRetroativa {
  id?: string
  importacao_id: string
  unidade: string
  negocio: string
  ano: number
  conta_codigo: string
  campo: string
  valor_antigo: number | null
  valor_novo: number | null
}

/** RV (remuneração variável) por liderança — cadastro corrente, atualizado por upsert no nome. */
export interface RvLideranca {
  id?: string
  operacao: string
  /** ROTA / ARMAZEM / EMPURRADA etc — usado depois pra puxar o resultado separado do DRE. */
  negocio: string
  setor: string
  funcao: string
  nome: string
  valor: number
}

/** Resultado mensal (realizado) de um indicador de gente, importado do BI pelo corporativo. */
export interface ResultadoGente {
  id?: string
  indicador: string
  unidade: string
  operacao_bi: string
  ano: number
  mes: number
  valor: number
}

/** Registro de Indisponibilidade ou Devolução no Painel de Perdas (fonte AUX — não vem da DRE). */
export interface PainelPerdasAux {
  id?: string
  unidade: string
  ano: number
  mes: number
  indicador: 'indisponibilidade' | 'devolucao'
  valor: number
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
