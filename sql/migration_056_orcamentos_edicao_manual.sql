-- Migration 056: permite corrigir manualmente um valor orçado (R$) mensal
-- direto na tela de Administração > Orçamento — guarda o valor original da
-- importação (orcado_original) na primeira edição, e marca a linha como
-- editada manualmente (editado_manualmente) pra destacar na tela e permitir
-- reverter. Reimportar a mesma unidade/negócio/ano/mês/conta sobrescreve o
-- orcado de novo (o upsert da importação não toca essas duas colunas, mas
-- também não protege o valor editado de ser sobrescrito).
-- Rodar no SQL Editor do Supabase.

ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS orcado_original numeric(16,2);
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS editado_manualmente boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
