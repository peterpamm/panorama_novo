/**
 * Hierarquia de contas de Frota (numeração nova do DRE, pós-cutover 09/2026)
 * — hardcoded aqui porque a tabela `contas` não guarda `nivel`/hierarquia de
 * verdade pra códigos ≥ 035 (a migration 110 nunca populou essa coluna, só
 * codigo/descricao/ordem). Conferida linha a linha cruzando
 * `sql/migration_110_dre_renumeracao_2026.sql` (numeração nova) com
 * `sql/seed_contas.sql` (numeração antiga, que ainda tem a coluna `nivel`
 * com a indentação real do Excel original):
 *
 * 114 CUSTOS GERAIS COM FROTA            (conta-mãe; = 115+140+144)
 *   115 CUSTOS VARIÁVEIS FROTA           (subtotal; = 116+118+132+136)
 *     116 GASTO COM COMBUSTÍVEIS         (subtotal)
 *       117 ÓLEO DIESEL
 *     118 GASTOS COM MANUTENÇÕES         (subtotal)
 *       119..130 (12 subcontas) + 131 DESCONTO IFOLLOW
 *     132 GASTOS COM PNEUS               (subtotal)
 *       133 PNEUS · 134 RECAPAGENS · 135 BORRACHARIA
 *     136 OUTROS GASTOS COM FROTA        (subtotal, não é conta solta)
 *       137 PEDÁGIOS · 138 MULTAS DE TRÂNSITO · 139 LAVAÇÃO
 *   140 CUSTO FIXOS                      (subtotal; = 141+142+143)
 *     141 IPVA/DPVAT E LICENCIAMENTOS · 142 SEGURO DE FROTA · 143 RASTREAMENTO
 *   144 OUTROS CUSTOS OPERACIONAIS       (subtotal; = 145..155)
 *     145..155 (11 subcontas)
 * 156 LUCRO OPERACIONAL VARIÁVEL — fecha a seção, NÃO é custo de frota, fica
 *     de fora de qualquer soma/Pareto/consistência.
 *
 * Duas correções importantes vs. a leitura "óbvia" do código: 131 (Desconto
 * Ifollow) é filha de Manutenções (118), não solta ao lado de 116/118/132;
 * e 136 (Outros Gastos com Frota) é ela mesma um subtotal (com 137/138/139
 * embaixo), não uma conta simples.
 */

/** Conta-mãe de Frota — Tela 1 (Visão Geral). */
export const CONTA_FROTA_MAE = '114'

/** Os 3 grupos que formam 114 — Tela 1. */
export const GRUPOS_FROTA = [
  { codigo: '115', nome: 'Custos Variáveis Frota' },
  { codigo: '140', nome: 'Custo Fixos' },
  { codigo: '144', nome: 'Outros Custos Operacionais' },
] as const

/**
 * Todos os códigos totalizadores (contas-mãe/subtotal) dentro da faixa de
 * Frota — excluídos de qualquer Pareto/tabela de detalhe por folha, senão
 * contariam o mesmo custo duas vezes (a totalizadora + as subcontas que já
 * estão logo abaixo). Mesmo padrão de `CONTAS_TOTALIZADORAS_ADM`
 * (constants.ts).
 */
export const CONTAS_TOTALIZADORAS_FROTA = ['114', '115', '116', '118', '132', '136', '140', '144']

/** Faixa completa (conta-mãe + todas as filhas, em qualquer nível) — usada só pra filtrar linhas do DRE por range; 156 fica de fora de propósito (fecha a seção, não é custo). */
export const FAIXA_FROTA: [number, number] = [114, 155]

/** Configuração de cada uma das 4 telas do módulo. */
export interface TelaFrotaConfig {
  slug: string
  titulo: string
  /** Código da conta-mãe dessa tela — chave em `PACOTES`. */
  codigo: string
  /** Faixa numérica das folhas (Pareto/detalhe) — [ini, fim], mesma convenção de `topContasFaixa`. */
  faixaFolhas: [number, number]
  /** Totalizadoras a excluir dentro dessa faixa (evita contar dobrado). */
  excluirDoRanking: readonly string[]
}

export const TELAS_FROTA: TelaFrotaConfig[] = [
  {
    slug: 'combustiveis',
    titulo: 'Combustíveis / Diesel',
    codigo: '116',
    faixaFolhas: [117, 117],
    excluirDoRanking: [],
  },
  {
    slug: 'visao-geral',
    titulo: 'Visão Geral dos Custos de Frota',
    codigo: CONTA_FROTA_MAE,
    faixaFolhas: FAIXA_FROTA,
    excluirDoRanking: CONTAS_TOTALIZADORAS_FROTA,
  },
  {
    slug: 'manutencoes',
    titulo: 'Manutenções',
    codigo: '118',
    faixaFolhas: [119, 131],
    excluirDoRanking: [],
  },
  {
    slug: 'pneus',
    titulo: 'Pneus',
    codigo: '132',
    faixaFolhas: [133, 135],
    excluirDoRanking: [],
  },
]
