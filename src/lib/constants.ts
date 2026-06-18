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

/** Cards "Redução de Custos -15%" da aba ADM. */
export const REDUCAO_CUSTOS_CARDS = [
  { nome: 'Despesas Frota Leve', contas: ['217'] },
  { nome: 'Despesas com Viagem', contas: ['147', '192'] },
]
