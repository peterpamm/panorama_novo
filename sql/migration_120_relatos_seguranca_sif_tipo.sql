-- Migration 120: adiciona SIF_TIPO em relatos_seguranca (migration 115) — o
-- texto original da coluna SIF da planilha ("SIF PERCUSOR", "SIF POTENCIAL"
-- etc), além do booleano `sif` já existente (que só diz se é SIF ou não,
-- qualquer tipo). A Pirâmide de Segurança (tabela de eventos + cards SIF do
-- mês/acumulado) agora restringe especificamente a "SIF PERCUSOR"/"SIF
-- POTENCIAL" (ver `piramide-seguranca.ts`, `SIF_TIPOS_VALIDOS`) — precisa do
-- texto original, não só do booleano, pra distinguir desses outros valores
-- que a coluna pode ter.
--
-- Relatos já importados antes dessa migration ficam com sif_tipo NULL (o
-- texto original não foi guardado na importação de antes) — reimportar a
-- planilha de Relatos recupera o valor certo.
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE relatos_seguranca ADD COLUMN IF NOT EXISTS sif_tipo text;

NOTIFY pgrst, 'reload schema';
