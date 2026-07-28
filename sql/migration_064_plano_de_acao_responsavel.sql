-- Migration 064: adiciona "Responsável" (nome livre, texto) ao Plano de Ação
-- — quem é o dono da ação dentro da unidade. Rodar no SQL Editor do Supabase.

ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS responsavel text NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
