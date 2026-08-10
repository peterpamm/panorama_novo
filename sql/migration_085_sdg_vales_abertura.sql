-- Migration 085: novos indicadores do SDG pra abertura de Vales — o pacote
-- geral (051+052) virou 4 slides próprios (Vales Financeiros, Vales Físicos,
-- Refugo, Quebras), cada um com sua Justificativa e ações do Plano de Ação.
-- Só amplia o CHECK das duas tabelas da migration_084 pros 4 novos valores;
-- não mexe em dado nenhum já gravado.
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE planos_acao_tags DROP CONSTRAINT IF EXISTS planos_acao_tags_sdg_indicador_check;
ALTER TABLE planos_acao_tags ADD CONSTRAINT planos_acao_tags_sdg_indicador_check
  CHECK (sdg_indicador IN (
    'ebitda', 'adm-geral', 'despesa-adm', 'vales', 'multas',
    'vales-financeiros', 'vales-fisicos', 'refugo', 'quebras'
  ));

ALTER TABLE sdg_justificativas DROP CONSTRAINT IF EXISTS sdg_justificativas_indicador_check;
ALTER TABLE sdg_justificativas ADD CONSTRAINT sdg_justificativas_indicador_check
  CHECK (indicador IN (
    'ebitda', 'adm-geral', 'despesa-adm', 'vales', 'multas',
    'vales-financeiros', 'vales-fisicos', 'refugo', 'quebras'
  ));

-- Seed das 4 novas tags padrão, já vinculadas ao indicador correspondente.
INSERT INTO planos_acao_tags (nome, ativo, ordem, sdg_indicador) VALUES
  ('Vales Financeiros', true, 6, 'vales-financeiros'),
  ('Vales Físicos', true, 7, 'vales-fisicos'),
  ('Refugo', true, 8, 'refugo'),
  ('Quebras', true, 9, 'quebras')
ON CONFLICT (nome) DO NOTHING;

NOTIFY pgrst, 'reload schema';
