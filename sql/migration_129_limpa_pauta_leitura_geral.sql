-- Migration 129: Limpa Pauta — leitura liberada pra qualquer usuário
-- autenticado (antes era admin ou só a própria unidade) — o usuário quer
-- que todo mundo acompanhe todas as unidades na aba Acompanhamento. Escrita
-- continua admin-only (policies de INSERT/UPDATE/DELETE da migration_122
-- não mudam).
--
-- Rodar no SQL Editor do Supabase.

DROP POLICY IF EXISTS "leitura_limpa_pauta" ON limpa_pauta;
CREATE POLICY "leitura_limpa_pauta" ON limpa_pauta
  FOR SELECT TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';
