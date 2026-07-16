import type { PacoteInfo } from '@/types'

/**
 * Espelha o dict PACOTES de dashboard/pages/1_Farol_de_Metas.py (linha ~549) no
 * Panorama Financeiro original. Mantido 1:1, inclusive a inconsistência conhecida
 * do código '159', que usa prefixos: ['158'] (igual ao pacote '158') no Python —
 * não corrigido aqui de propósito, para preservar paridade de cálculo.
 */
export const PACOTES: Record<string, PacoteInfo> = {
  '232': { nome: 'EBITDA',                     natureza: 'performance', prefixos: ['232'] },
  '275': { nome: 'Geração de Caixa',            natureza: 'performance', prefixos: ['275'] },
  '900': { nome: 'Gastos Totais',               natureza: 'custo',       prefixos: ['021', '157'] },
  '021': { nome: 'Custo Operacional',           natureza: 'custo',       prefixos: ['021'] },
  '158': { nome: 'Pacote de Gente',             natureza: 'custo',       prefixos: ['158', '033'] },
  '033': { nome: 'Custo com Pessoal',           natureza: 'custo',       prefixos: ['033'] },
  '159': { nome: 'Despesa com Pessoal ADM',     natureza: 'custo',       prefixos: ['158'] }, // [sic] igual ao Python original
  '190': { nome: 'Despesas ADM Gerais',         natureza: 'custo',       prefixos: ['190'] },
  '217': { nome: 'Despesas Frota Leve',         natureza: 'custo',       prefixos: ['217'] },
  '218': { nome: 'Manutenção Frota Leve',       natureza: 'custo',       prefixos: ['218'] },
  '113': { nome: 'Pacote de Frota',             natureza: 'custo',       prefixos: ['113'] },
  '117': { nome: 'Manutenção',                  natureza: 'custo',       prefixos: ['117'] },
  '131': { nome: 'Pneus',                       natureza: 'custo',       prefixos: ['131'] },
  '115': { nome: 'Combustíveis',                natureza: 'custo',       prefixos: ['115'] },
  '157': { nome: 'Despesa Administrativa',      natureza: 'custo',       prefixos: ['157'] },
  '073': { nome: 'Pacote Segurança',            natureza: 'custo',       prefixos: ['073'] },
  '074': { nome: "EPI's",                       natureza: 'custo',       prefixos: ['074'] },
  '075': { nome: 'Uniformes',                   natureza: 'custo',       prefixos: ['075'] },
}

export const PACOTES_RESUMO    = ['232', '275', '900', '021', '158', '113', '157', '073']
export const PACOTES_GENTE     = ['158', '033', '159']
export const PACOTES_FROTA     = ['113', '117', '131', '115']
export const PACOTES_SEGURANCA = ['073', '074', '075']
export const PACOTES_ADM       = ['159', '190', '217', '218']

/** Código da conta "Receita Líquida Operacional", usado como base de todo cálculo de % de faturamento e impacto financeiro. */
export const CONTA_RECEITA = '002'
export const NOME_RECEITA = 'Receita Líquida Operacional'

/**
 * Indicadores das abas Performance e Custos da página Ranking, espelhando
 * 1:1 as listas hardcoded de dashboard/pages/03_Ranking.py (linha ~237) do
 * Panorama Financeiro original. Cada código já existe em `PACOTES` (reaproveitado
 * pra natureza/prefixos) — mantido como lista separada porque é um recorte
 * diferente de PACOTES_RESUMO (usado no Farol).
 */
export const RANKING_PERFORMANCE = ['232', '275']
export const RANKING_CUSTOS = ['900', '021', '158', '113', '157', '074', '075']

/**
 * Contas cujo AVR (%) do GInfo NÃO é invertido ao normalizar (mantém o sinal
 * original). Espelha `performance_codes = [232, 275]` em
 * scripts/tratar_dre_pro.py do Panorama Financeiro original — para todas as
 * outras contas (custo), o AVR bruto é multiplicado por -1, porque o GInfo
 * exporta o AVR de custo com o mesmo sinal do REALIZADO (negativo), e o Farol
 * espera custo como percentual positivo (ex: "77,83% da receita").
 */
export const CODIGOS_PERFORMANCE = ['232', '275']

export const CORES_FAROL = {
  positivo: '#10b981',
  negativo: '#ef4444',
  atencao: '#f59e0b',
  neutro: '#6b7280',
} as const

/** Cards "Estouro Zero" da aba Gente — real não pode exceder remunerado. */
export const ESTOURO_ZERO_CARDS = [
  { nome: 'Salários',   prefixos: ['035', '160'] },
  { nome: 'Benefícios', prefixos: ['055', '171'] },
]

/** Indicador de RV com origem no DRE — 'avr' compara com a meta do Farol; 'dispersao' usa a coluna DIFERENÇA (≥ 0 = bateu). */
export interface RvIndicadorDre {
  /** Chave do peso na tabela de pesos do setor (rv_gente_pesos_dre / rv_financeiro_pesos_dre). */
  id: string
  nome: string
  tipo: 'avr' | 'dispersao'
  prefixos: string[]
}

/**
 * Indicadores de gente com origem no DRE que compõem a RV das lideranças.
 * - 'avr': AVR mensal vs meta do Farol (pacote 158).
 * - 'dispersao': coluna DIFERENÇA do DRE (REAL−REMUN) somada nas contas —
 *   meta implícita é não estourar (dispersão ≥ 0 = verde).
 * O `id` é a chave do peso em rv_gente_pesos_dre.
 */
export const RV_GENTE_DRE: RvIndicadorDre[] = [
  { id: '158',        nome: 'Pacote de Gente',      tipo: 'avr',       prefixos: ['158', '033'] },
  { id: 'SALARIOS',   nome: 'Salários',             tipo: 'dispersao', prefixos: ['035', '160'] },
  { id: 'BENEFICIOS', nome: 'Pacote de Benefícios', tipo: 'dispersao', prefixos: ['055', '171'] },
]

/**
 * Indicadores do setor financeiro — todos com origem no DRE, sem importação
 * de metas (AVR usa a meta do Farol; dispersão usa as contas do Painel de
 * Perdas). O `id` é a chave do peso em rv_financeiro_pesos_dre.
 */
export const RV_FINANCEIRO_DRE: RvIndicadorDre[] = [
  { id: '157',    nome: 'Despesa Administrativa', tipo: 'avr',       prefixos: ['157'] },
  { id: '021',    nome: 'Custo Operacional',      tipo: 'avr',       prefixos: ['021'] },
  { id: 'VALES',  nome: 'Gastos com Vales',       tipo: 'dispersao', prefixos: ['051', '052'] },
  { id: 'MULTAS', nome: 'Multas',                 tipo: 'dispersao', prefixos: ['137', '222'] },
]

/**
 * Indicadores de frota com origem no DRE — AVR mensal vs meta do Farol
 * (pacotes de custo). Os indicadores de frota de fora do DRE entram depois,
 * quando a importação deles for estruturada. O `id` é a chave do peso em
 * rv_frota_pesos_dre.
 */
export const RV_FROTA_DRE: RvIndicadorDre[] = [
  { id: '117', nome: 'Manutenção',            tipo: 'avr', prefixos: ['117'] },
  { id: '131', nome: 'Pneus',                 tipo: 'avr', prefixos: ['131'] },
  { id: '115', nome: 'Diesel (Combustíveis)', tipo: 'avr', prefixos: ['115'] },
]

/**
 * Indicadores de segurança com origem no DRE — EPI's (074) e Uniformes (075),
 * os mesmos acompanhados no Farol de Metas, por AVR mensal vs meta do Farol.
 * O `id` é a chave do peso em rv_seguranca_pesos_dre.
 */
export const RV_SEGURANCA_DRE: RvIndicadorDre[] = [
  { id: '074', nome: "EPI's",     tipo: 'avr', prefixos: ['074'] },
  { id: '075', nome: 'Uniformes', tipo: 'avr', prefixos: ['075'] },
]

/** Cards "Redução de Custos -15%" da aba ADM. */
export const REDUCAO_CUSTOS_CARDS = [
  { nome: 'Despesas Frota Leve', contas: ['217'] },
  { nome: 'Despesas com Viagem', contas: ['147', '192'] },
]

/**
 * Faixas numéricas "Pacote DRE" da aba Abertura de Contas, espelhando 1:1 o
 * dict PACOTES de dashboard/pages/04_Analise_por_Conta.py (linha ~264) do
 * Panorama Financeiro original. Usado só nessa aba (não confundir com
 * PACOTES, os indicadores do Farol de Metas).
 */
export const PACOTES_DRE: Record<string, [number, number]> = {
  'Receita': [1, 20],
  'Custo Operacional Geral': [21, 32],
  'Pacote de Gente Operacional': [33, 112],
  'Frota': [113, 156],
  'Despesa Administrativa': [157, 227],
  'Contas Finais do DRE': [228, 282],
}
