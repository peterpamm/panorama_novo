-- Migration 011: preserva a operação original do BI nas metas de gente
-- Duas operações do BI podem apontar pra mesma unidade (ex: CDL CAMAÇARI e CDR
-- BAHIA → CAMACARI) com metas diferentes (rota vs empurrada) — então a chave
-- única passa a ser indicador + operacao_bi + ano + mês.
-- Rodar no SQL Editor do Supabase.

ALTER TABLE metas_gente
  ADD COLUMN IF NOT EXISTS operacao_bi text NOT NULL DEFAULT '';

ALTER TABLE metas_gente
  DROP CONSTRAINT IF EXISTS metas_gente_indicador_unidade_ano_mes_key;

ALTER TABLE metas_gente
  DROP CONSTRAINT IF EXISTS metas_gente_uniq;

ALTER TABLE metas_gente
  ADD CONSTRAINT metas_gente_uniq UNIQUE (indicador, operacao_bi, ano, mes);

NOTIFY pgrst, 'reload schema';
