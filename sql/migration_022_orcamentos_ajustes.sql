-- Migration 022: ajustes na tabela orcamentos depois do primeiro teste de
-- importação —
-- 1) o bloco TOTAL da planilha também passa a ser importado (mes=0 = meta do
--    ano), então o CHECK de mes foi ampliado pra aceitar 0;
-- 2) o nome da conta vem direto da planilha de orçamento — ela tem numeração
--    própria (menos linhas que o plano de contas do DRE) e não é garantido
--    que bate com a tabela `contas`, então a FK em conta_codigo foi removida
--    e entrou a coluna conta_nome.
-- Só roda se você já executou a migration_021 antes desse ajuste. Rodar no
-- SQL Editor do Supabase.

ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_conta_codigo_fkey;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS conta_nome text NOT NULL DEFAULT '';

ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_mes_check;
ALTER TABLE orcamentos ADD CONSTRAINT orcamentos_mes_check CHECK (mes BETWEEN 0 AND 12);

NOTIFY pgrst, 'reload schema';
