-- Migration 013: peso (%) por indicador × operação nas metas de gente.
-- O peso varia por operação: ex. o gerente de rota de Camaçari não tem DISP
-- GENTE AL, então a disp de rota dele pesa 30%; em Foz é 15% arm + 15% rota.
-- Cadastro manual na tela de Metas de Gente.
-- Rodar no SQL Editor do Supabase.

ALTER TABLE metas_gente
  ADD COLUMN IF NOT EXISTS peso numeric(5,2) NOT NULL DEFAULT 0;  -- em % (ex: 30 = 30%)

NOTIFY pgrst, 'reload schema';
