-- Migration 094: Farol Gerentes precisa do TRI (acidente grave) de TODAS as
-- unidades, mesma ideia da migration_093 (Ranking) — qualquer usuário
-- logado vê o indicador de todo mundo, não só da própria unidade, porque o
-- Farol Gerentes é justamente pra comparar unidades lado a lado.
--
-- Reaproveita o mesmo padrão SECURITY DEFINER das funções `ranking_*`
-- (DRE/Orçamento, já usadas também pelo Farol Gerentes) — essa aqui é só
-- pro TRI, que elas ainda não cobrem.
--
-- Rodar no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION farol_gerentes_resultados_tri()
RETURNS SETOF resultados_tri
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM resultados_tri;
$$;

GRANT EXECUTE ON FUNCTION farol_gerentes_resultados_tri() TO authenticated;

NOTIFY pgrst, 'reload schema';
