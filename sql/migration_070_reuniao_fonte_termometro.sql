-- Migration 070: quarta fonte automática pra indicadores da Reunião
-- Resultados — 'termometro' (planilha mensal, sem meta — a pontuação ganha
-- é o próprio valor importado, capado no total de pontos cadastrado do
-- indicador). Diferente de 'perdas'/'farol_pacote'/'rotinas', não tem
-- cálculo automático nenhum: o resultado é gravado direto em
-- reuniao_resultados_mensais pela aba Importação. Rodar no SQL Editor do
-- Supabase.

ALTER TABLE reuniao_resultados_indicadores
  DROP CONSTRAINT IF EXISTS reuniao_resultados_indicadores_fonte_check;
ALTER TABLE reuniao_resultados_indicadores
  ADD CONSTRAINT reuniao_resultados_indicadores_fonte_check
  CHECK (fonte IN ('manual', 'perdas', 'farol_pacote', 'rotinas', 'termometro'));

NOTIFY pgrst, 'reload schema';
