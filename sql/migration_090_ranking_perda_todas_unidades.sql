-- Migration 090: o ranking entre unidades dos slides de Vales (Pacote
-- Geral/Financeiros/Físicos) e Multas no SDG Financeiro só mostrava a
-- própria unidade pra um usuário logado como "unidade" — porque esses
-- slides buscam em `mv_dre_longo`, que tem uma trava de segurança (ver
-- migration_007) que só deixa uma unidade comum enxergar as PRÓPRIAS linhas
-- (+ AMBEV), nunca as de outra unidade. Essa trava é correta e continua
-- valendo pra tudo (Farol, Ranking, Painel de Perdas etc.) — mas o pedido
-- aqui é abrir uma exceção BEM ESTREITA: só o ranking desses 4 indicadores
-- específicos (soma da diferença das contas 051/052/137/222), sem expor
-- nenhum outro dado do DRE de outras unidades.
--
-- Solução: uma função SECURITY DEFINER (roda com privilégio elevado,
-- ignorando a trava de unidade) que devolve só as linhas mensais dessas
-- contas específicas, pra qualquer usuário logado — mesmo padrão já usado
-- em refresh_mv_dre_longo (migration_007) e nas funções de status de Plano
-- de Ação/Encontro de Contas (migrations 063/080).
--
-- Rodar no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION ranking_perda_indicador(p_ano integer, p_contas text[])
RETURNS SETOF _mv_dre_longo_raw
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM _mv_dre_longo_raw
  WHERE negocio = 'CONS'
    AND tipo_periodo = 'MENSAL'
    AND ano = p_ano
    AND EXISTS (SELECT 1 FROM unnest(p_contas) c WHERE conta_codigo LIKE c || '%');
$$;

GRANT EXECUTE ON FUNCTION ranking_perda_indicador(integer, text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
