-- Migration 082: corrige leitura de `orcamentos` pra usuário de unidade —
-- faltava o mesmo grant de AMBEV que `metas`/`negocios` já têm
-- (`unidade IN (auth_unidade(), 'AMBEV')`). A política antiga só liberava
-- `unidade = auth_unidade()`, então nenhuma conta de unidade conseguia ler o
-- orçamento consolidado da AMBEV — aparecia tudo cinza (sem meta) no Farol
-- de Metas ao selecionar AMBEV, mesmo ela tendo orçamento cadastrado.
-- Rodar no SQL Editor do Supabase.

DROP POLICY IF EXISTS "unidade_orcamentos" ON orcamentos;
CREATE POLICY "unidade_orcamentos" ON orcamentos
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade IN (auth_unidade(), 'AMBEV'));

NOTIFY pgrst, 'reload schema';
