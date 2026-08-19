/**
 * Registro central das páginas restritas por permissão individual — a fonte
 * de verdade tanto pras rotas (`App.tsx`), o menu (`Sidebar.tsx`) e os hubs
 * (`RemuneracaoVariavelPage`/`MetasPage`) quanto pra matriz de concessão em
 * Administração > Usuários. "Administração" não entra aqui — é controlada
 * só pelo flag `dono` (ver `AuthContext`), nunca concedida por página.
 */
export type PaginaChave =
  | 'importacao'
  | 'metas_gerais'
  | 'metas_perdas'
  | 'metas_gente'
  | 'metas_financeiro'
  | 'metas_frota'
  | 'metas_seguranca'
  | 'metas_distribuicao'
  | 'metas_armazem'
  | 'rv_gente'
  | 'rv_financeiro'
  | 'rv_frota'
  | 'rv_seguranca'
  | 'rv_distribuicao'
  | 'rv_armazem'
  | 'rv_empurrada'
  | 'metas_empurrada'
  | 'rv_painel_geral'
  | 'rv_matriz'
  | 'reuniao_financeiro'
  | 'reuniao_gente'
  | 'reuniao_frota'
  | 'reuniao_seguranca'
  | 'reuniao_distribuicao'
  | 'reuniao_armazem'
  | 'reuniao_resumo_geral'
  | 'reuniao_pagamento'

export interface PaginaInfo {
  chave: PaginaChave
  grupo: 'Importação' | 'Remuneração Variável' | 'Reunião Resultados'
  label: string
}

export const PAGINAS: PaginaInfo[] = [
  { chave: 'importacao', grupo: 'Importação', label: 'Importação' },

  { chave: 'rv_painel_geral', grupo: 'Remuneração Variável', label: 'Painel Geral' },
  { chave: 'rv_gente', grupo: 'Remuneração Variável', label: 'RV de Gente' },
  { chave: 'rv_financeiro', grupo: 'Remuneração Variável', label: 'RV do Financeiro' },
  { chave: 'rv_frota', grupo: 'Remuneração Variável', label: 'RV de Frota' },
  { chave: 'rv_seguranca', grupo: 'Remuneração Variável', label: 'RV de Segurança' },
  { chave: 'rv_distribuicao', grupo: 'Remuneração Variável', label: 'RV de Distribuição' },
  { chave: 'rv_armazem', grupo: 'Remuneração Variável', label: 'RV de Armazém' },
  { chave: 'rv_empurrada', grupo: 'Remuneração Variável', label: 'RV de Empurrada' },
  { chave: 'rv_matriz', grupo: 'Remuneração Variável', label: 'Matriz' },

  // Metas mudou de página própria pra ficar dentro do hub de Remuneração
  // Variável (`/remuneracao-variavel/metas`) — o grupo aqui segue essa mudança.
  { chave: 'metas_gerais', grupo: 'Remuneração Variável', label: 'Metas Gerais' },
  { chave: 'metas_perdas', grupo: 'Remuneração Variável', label: 'Metas de Perdas' },
  { chave: 'metas_gente', grupo: 'Remuneração Variável', label: 'Metas de Gente' },
  { chave: 'metas_financeiro', grupo: 'Remuneração Variável', label: 'Metas do Financeiro' },
  { chave: 'metas_frota', grupo: 'Remuneração Variável', label: 'Metas de Frota' },
  { chave: 'metas_seguranca', grupo: 'Remuneração Variável', label: 'Metas de Segurança' },
  { chave: 'metas_distribuicao', grupo: 'Remuneração Variável', label: 'Metas de Distribuição' },
  { chave: 'metas_armazem', grupo: 'Remuneração Variável', label: 'Metas de Armazém' },
  { chave: 'metas_empurrada', grupo: 'Remuneração Variável', label: 'Metas de Empurrada' },

  { chave: 'reuniao_financeiro', grupo: 'Reunião Resultados', label: 'Reunião Resultados — Financeiro' },
  { chave: 'reuniao_gente', grupo: 'Reunião Resultados', label: 'Reunião Resultados — Gente' },
  { chave: 'reuniao_frota', grupo: 'Reunião Resultados', label: 'Reunião Resultados — Frota' },
  { chave: 'reuniao_seguranca', grupo: 'Reunião Resultados', label: 'Reunião Resultados — Segurança' },
  { chave: 'reuniao_distribuicao', grupo: 'Reunião Resultados', label: 'Reunião Resultados — Distribuição' },
  { chave: 'reuniao_armazem', grupo: 'Reunião Resultados', label: 'Reunião Resultados — Armazém' },
  { chave: 'reuniao_resumo_geral', grupo: 'Reunião Resultados', label: 'Reunião Resultados — Resumo Geral (Corporativo)' },
  // Dado sensível (cartão/conta de pagamento) — diferente das outras páginas
  // de Reunião Resultados, esta é SEMPRE adminOnly na rota (App.tsx), nunca
  // aberta pra usuário de unidade mesmo que concedida aqui.
  { chave: 'reuniao_pagamento', grupo: 'Reunião Resultados', label: 'Reunião Resultados — Pagamento' },
]
