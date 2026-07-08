-- ============================================================
-- MIGRAÇÃO 004 — data de entrada da unidade, pra ajustar a meta
-- de Redução de Custos (-15%) de unidades que começaram a operar
-- no meio do ano anterior (ex: Petrópolis em jul/2025, Carambeí
-- em set/2025) — sem isso, faltaria "ano anterior" pra comparar
-- nos meses antes da entrada, ou o card agregado compararia 12
-- meses do ano atual contra só os poucos meses que existiram no
-- ano anterior, distorcendo a meta pra baixo.
--
-- Opcional: deixe em branco (NULL) pra qualquer unidade que já
-- existia antes de qualquer dado importado — não precisa cadastrar
-- todas, só as que entraram no meio de algum ano com dado no banco.
--
-- Rode isso no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE unidades
  ADD COLUMN IF NOT EXISTS data_entrada date;
