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
  | 'rv_painel_geral'
  | 'rv_matriz'
  | 'reuniao_financeiro'

export interface PaginaInfo {
  chave: PaginaChave
  grupo: 'Importação' | 'Metas' | 'Remuneração Variável' | 'Reunião Resultados'
  label: string
}

export const PAGINAS: PaginaInfo[] = [
  { chave: 'importacao', grupo: 'Importação', label: 'Importação' },

  { chave: 'metas_gerais', grupo: 'Metas', label: 'Metas Gerais' },
  { chave: 'metas_perdas', grupo: 'Metas', label: 'Metas de Perdas' },
  { chave: 'metas_gente', grupo: 'Metas', label: 'Metas de Gente' },
  { chave: 'metas_financeiro', grupo: 'Metas', label: 'Metas do Financeiro' },
  { chave: 'metas_frota', grupo: 'Metas', label: 'Metas de Frota' },
  { chave: 'metas_seguranca', grupo: 'Metas', label: 'Metas de Segurança' },
  { chave: 'metas_distribuicao', grupo: 'Metas', label: 'Metas de Distribuição' },
  { chave: 'metas_armazem', grupo: 'Metas', label: 'Metas de Armazém' },

  { chave: 'rv_painel_geral', grupo: 'Remuneração Variável', label: 'Painel Geral' },
  { chave: 'rv_gente', grupo: 'Remuneração Variável', label: 'RV de Gente' },
  { chave: 'rv_financeiro', grupo: 'Remuneração Variável', label: 'RV do Financeiro' },
  { chave: 'rv_frota', grupo: 'Remuneração Variável', label: 'RV de Frota' },
  { chave: 'rv_seguranca', grupo: 'Remuneração Variável', label: 'RV de Segurança' },
  { chave: 'rv_distribuicao', grupo: 'Remuneração Variável', label: 'RV de Distribuição' },
  { chave: 'rv_armazem', grupo: 'Remuneração Variável', label: 'RV de Armazém' },
  { chave: 'rv_matriz', grupo: 'Remuneração Variável', label: 'Matriz' },

  { chave: 'reuniao_financeiro', grupo: 'Reunião Resultados', label: 'Reunião Resultados — Financeiro' },
]
