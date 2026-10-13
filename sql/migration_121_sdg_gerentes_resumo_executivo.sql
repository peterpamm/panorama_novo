-- Migration 121: slide "Assuntos Gerais" do SDG dos Gerentes vira "Resumo
-- Executivo" — pedido do chefe do usuário depois de ver a apresentação real.
-- Continua a MESMA linha de `sdg_justificativas` (indicador
-- 'assuntos-gerais-gerentes', já existente desde a migration 114) — só
-- acrescenta 2 colunas novas (Pontos de Atenção / Pontos em Andamento) além
-- de Positivos/Negativos que já existiam, virando 4 blocos em vez de 1.
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE sdg_justificativas ADD COLUMN IF NOT EXISTS pontos_atencao text NOT NULL DEFAULT '';
ALTER TABLE sdg_justificativas ADD COLUMN IF NOT EXISTS pontos_andamento text NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
