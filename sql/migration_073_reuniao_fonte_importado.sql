-- Migration 073: quinta fonte automática pra indicadores da Reunião
-- Resultados — 'importado' (planilha padrão de RR com meta, resultado e
-- pontos já prontos — ver Import_RR - Arm&DU.xlsx, aba Import RR_DU). Nome
-- alternativo (nome_t1) permite que um mesmo indicador tenha rótulo
-- diferente pra unidades T1 (ex: "DEV PDV" pro T2, "GTY" pro T1), mantendo
-- tudo na mesma tabela. Rodar no SQL Editor do Supabase.

ALTER TABLE reuniao_resultados_indicadores ADD COLUMN IF NOT EXISTS nome_t1 text;

ALTER TABLE reuniao_resultados_mensais ADD COLUMN IF NOT EXISTS meta   numeric(14,2);
ALTER TABLE reuniao_resultados_mensais ADD COLUMN IF NOT EXISTS pontos numeric(6,2);

ALTER TABLE reuniao_resultados_indicadores
  DROP CONSTRAINT IF EXISTS reuniao_resultados_indicadores_fonte_check;
ALTER TABLE reuniao_resultados_indicadores
  ADD CONSTRAINT reuniao_resultados_indicadores_fonte_check
  CHECK (fonte IN ('manual', 'perdas', 'farol_pacote', 'rotinas', 'termometro', 'importado'));

NOTIFY pgrst, 'reload schema';
