-- Migration 128: amplia o CHECK de `planos_acao_tags.sdg_indicador` pros 8
-- indicadores novos do SDG Gerentes (prefixo "gerentes-", ver `SdgIndicador`
-- em src/types/index.ts e `SDG_INDICADORES_GERENTES` em sdg-indicadores.ts)
-- — esqueci de rodar isso junto com o código que já usa esses valores,
-- travando a criação de tag com "new row ... violates check constraint
-- planos_acao_tags_sdg_indicador_check". Não mexe em dado nenhum já
-- gravado, só amplia o conjunto aceito (mesmo padrão de migration_085/086).
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE planos_acao_tags DROP CONSTRAINT IF EXISTS planos_acao_tags_sdg_indicador_check;
ALTER TABLE planos_acao_tags ADD CONSTRAINT planos_acao_tags_sdg_indicador_check
  CHECK (sdg_indicador IN (
    'ebitda', 'adm-geral', 'despesa-adm', 'vales', 'multas',
    'vales-financeiros', 'vales-fisicos', 'refugo', 'quebras', 'encontro-contas',
    'gerentes-receita', 'gerentes-ebitda', 'gerentes-gastos-totais',
    'gerentes-pacote-de-gente', 'gerentes-pacote-de-frota', 'gerentes-despesa-adm',
    'gerentes-custos-freteiros', 'gerentes-pacote-de-perdas'
  ));

NOTIFY pgrst, 'reload schema';
