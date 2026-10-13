-- Migration 123: Limpa Pauta — campos de tratativa manual (aprovação
-- interna, antes da resposta do Freightech). Três campos independentes
-- (GOD/GEO/RPO — áreas internas que precisam opinar sobre o desconto),
-- cada um com status Pendente/OK/NOK + uma justificativa de uma linha.
-- Edição é admin-only, mesma trava das outras colunas de `limpa_pauta`
-- (sem function nova — já existe a policy de UPDATE admin da migration_122).
-- Rodar no SQL Editor do Supabase.

ALTER TABLE limpa_pauta
  ADD COLUMN IF NOT EXISTS status_god        text NOT NULL DEFAULT 'pendente' CHECK (status_god IN ('pendente', 'ok', 'nok')),
  ADD COLUMN IF NOT EXISTS justificativa_god text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_geo        text NOT NULL DEFAULT 'pendente' CHECK (status_geo IN ('pendente', 'ok', 'nok')),
  ADD COLUMN IF NOT EXISTS justificativa_geo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_rpo        text NOT NULL DEFAULT 'pendente' CHECK (status_rpo IN ('pendente', 'ok', 'nok')),
  ADD COLUMN IF NOT EXISTS justificativa_rpo text NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
