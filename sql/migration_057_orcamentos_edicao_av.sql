-- Migration 057: generaliza a edição manual (migration 056, só cobria o
-- orçado em R$) pra também permitir corrigir o AV (%) na tela. Renomeia a
-- coluna genérica editado_manualmente pra orcado_editado_manualmente (não
-- tinha sido usada em produção ainda) e adiciona av_original +
-- av_editado_manualmente com a mesma lógica: valor original preservado na
-- primeira edição, flag pra destacar na tela e permitir reverter.
-- Rodar no SQL Editor do Supabase.

ALTER TABLE orcamentos RENAME COLUMN editado_manualmente TO orcado_editado_manualmente;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS av_original numeric(8,2);
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS av_editado_manualmente boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
