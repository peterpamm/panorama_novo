-- Migration 116: adiciona DETALHAMENTO em relatos_seguranca (migration 115) —
-- texto livre da ocorrência, usado na tabela de eventos que aparece no slide
-- da Pirâmide de Segurança quando o mês selecionado tem algum evento grave
-- (FAI/MTI/LTI/FATAL) ou marcado como SIF.
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE relatos_seguranca ADD COLUMN IF NOT EXISTS detalhamento text;

NOTIFY pgrst, 'reload schema';
