-- Migration 009: coluna NEGOCIO na RV das lideranças
-- Líderes de ROTA / ARMAZEM / EMPURRADA etc. — depois o resultado sai separado do DRE por negócio.
-- Rodar no SQL Editor do Supabase.

ALTER TABLE rv_liderancas
  ADD COLUMN IF NOT EXISTS negocio text NOT NULL DEFAULT '';
