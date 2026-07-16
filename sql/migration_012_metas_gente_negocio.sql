-- Migration 012: negócio da operação do BI nas metas de gente
-- CDL* = ROTA, CDR* = ARMAZEM (auto-sugerido na importação, editável na tela de Metas de Gente).
-- Rodar no SQL Editor do Supabase.

ALTER TABLE metas_gente
  ADD COLUMN IF NOT EXISTS negocio text NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
