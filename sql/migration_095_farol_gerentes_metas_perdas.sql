-- Migration 095: Farol Gerentes precisa da meta anual de Perdas (Metas >
-- Metas de Perdas, por indicador) de TODAS as unidades — mesma ideia das
-- migrations 093/094: qualquer usuário logado vê o Pacote de Perdas de
-- todo mundo, não só da própria unidade.
--
-- painel_perdas_aux (Indisponibilidade/Devolução) já tem uma RPC aberta
-- (ranking_painel_perdas_aux, migration_093) — reaproveitada aqui, sem
-- precisar de outra igual. Essa migration só cobre metas_perdas_indicadores,
-- que ainda não tinha versão aberta.
--
-- Rodar no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION farol_gerentes_metas_perdas_indicadores()
RETURNS SETOF metas_perdas_indicadores
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM metas_perdas_indicadores;
$$;

GRANT EXECUTE ON FUNCTION farol_gerentes_metas_perdas_indicadores() TO authenticated;

NOTIFY pgrst, 'reload schema';
