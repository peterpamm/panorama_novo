-- Migration 093: a página Ranking passa a mostrar TODAS as unidades pra
-- qualquer usuário logado, mesmo as que não são liberadas pra ele em
-- nenhuma outra tela — o objetivo ali é incentivar a competição entre
-- unidades, então a ideia é justamente comparar o resultado de todo mundo,
-- ao contrário do resto do app (Farol, Análise por Conta, SDG Financeiro
-- etc.), que continuam restritos à própria unidade + AMBEV.
--
-- Como isso é o oposto do padrão de segurança do resto do projeto, a
-- abertura fica só nestas 3 funções novas (SECURITY DEFINER, mesmo padrão
-- de refresh_mv_dre_longo/ranking_perda_indicador) — usadas SÓ pela página
-- Ranking (ver useRankingDados.ts). Nenhuma política de RLS existente foi
-- afrouxada; o resto do app continua vendo só a própria unidade.
--
-- Rodar no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION ranking_dre_longo()
RETURNS SETOF _mv_dre_longo_raw
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM _mv_dre_longo_raw;
$$;

GRANT EXECUTE ON FUNCTION ranking_dre_longo() TO authenticated;

CREATE OR REPLACE FUNCTION ranking_painel_perdas_aux()
RETURNS SETOF painel_perdas_aux
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM painel_perdas_aux;
$$;

GRANT EXECUTE ON FUNCTION ranking_painel_perdas_aux() TO authenticated;

-- `p_contas` (contas usadas pelos pacotes do Ranking, CONTAS_ORCAMENTO_USADAS
-- no código) e o corte de 2 anos vêm de fora pra não duplicar essa lista
-- aqui — mesma janela que o DataContext já usa (nenhuma tela olha além de
-- "ano atual - 2").
CREATE OR REPLACE FUNCTION ranking_orcamentos(p_contas text[])
RETURNS SETOF orcamentos
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM orcamentos
  WHERE conta_codigo = ANY(p_contas)
    AND ano >= extract(year from now())::int - 2;
$$;

GRANT EXECUTE ON FUNCTION ranking_orcamentos(text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
