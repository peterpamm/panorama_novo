-- Migration 086: Encontro de Contas ganha Justificativa/Plano de Ação
-- próprio no SDG — a Ambev às vezes desconta errado e a unidade precisa
-- abrir uma ação no Plano de Ação pra pedir ressarcimento e acompanhar.
-- Só amplia o CHECK das duas tabelas pro novo indicador; não mexe em dado
-- nenhum já gravado.
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE planos_acao_tags DROP CONSTRAINT IF EXISTS planos_acao_tags_sdg_indicador_check;
ALTER TABLE planos_acao_tags ADD CONSTRAINT planos_acao_tags_sdg_indicador_check
  CHECK (sdg_indicador IN (
    'ebitda', 'adm-geral', 'despesa-adm', 'vales', 'multas',
    'vales-financeiros', 'vales-fisicos', 'refugo', 'quebras', 'encontro-contas'
  ));

ALTER TABLE sdg_justificativas DROP CONSTRAINT IF EXISTS sdg_justificativas_indicador_check;
ALTER TABLE sdg_justificativas ADD CONSTRAINT sdg_justificativas_indicador_check
  CHECK (indicador IN (
    'ebitda', 'adm-geral', 'despesa-adm', 'vales', 'multas',
    'vales-financeiros', 'vales-fisicos', 'refugo', 'quebras', 'encontro-contas'
  ));

-- Seed da tag padrão, já vinculada.
INSERT INTO planos_acao_tags (nome, ativo, ordem, sdg_indicador) VALUES
  ('Encontro de Contas', true, 10, 'encontro-contas')
ON CONFLICT (nome) DO NOTHING;

NOTIFY pgrst, 'reload schema';
