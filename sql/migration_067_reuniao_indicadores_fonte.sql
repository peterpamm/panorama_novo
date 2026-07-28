-- Migration 067: indicadores da Reunião Resultados podem ter "Fonte"
-- automática em vez de meta/resultado 100% manual — 'perdas' (indicador do
-- Painel de Perdas, ex: Vales) ou 'farol_pacote' (pacote do Farol de Metas,
-- ex: AVR administrativo). Nesses casos meta/natureza/formato deixam de ser
-- cadastrados à mão (ficam null aqui, calculados em tempo real na tela a
-- partir de Metas de Perdas/Orçamento/DRE). Rodar no SQL Editor do Supabase.

ALTER TABLE reuniao_resultados_indicadores
  ADD COLUMN IF NOT EXISTS fonte text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS fonte_chave text;

ALTER TABLE reuniao_resultados_indicadores
  DROP CONSTRAINT IF EXISTS reuniao_resultados_indicadores_fonte_check;
ALTER TABLE reuniao_resultados_indicadores
  ADD CONSTRAINT reuniao_resultados_indicadores_fonte_check
  CHECK (fonte IN ('manual', 'perdas', 'farol_pacote'));

ALTER TABLE reuniao_resultados_indicadores
  ALTER COLUMN meta DROP NOT NULL;

ALTER TABLE reuniao_resultados_indicadores
  DROP CONSTRAINT IF EXISTS reuniao_indicadores_meta_manual_check;
ALTER TABLE reuniao_resultados_indicadores
  ADD CONSTRAINT reuniao_indicadores_meta_manual_check
  CHECK (fonte <> 'manual' OR meta IS NOT NULL);

NOTIFY pgrst, 'reload schema';
