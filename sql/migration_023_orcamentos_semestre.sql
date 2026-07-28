-- Migration 023: permite mes=13 (1º semestre) e mes=14 (2º semestre) na
-- tabela orcamentos — mesma convenção já usada na tabela `metas`. Esses
-- blocos são recalculados pela tela (botão "Recalcular semestres"), somando
-- o ORÇADO dos 6 meses de cada conta e recalculando o AV (Análise Vertical
-- acumulada) contra a Receita Líquida Operacional do mesmo período — não vêm
-- da planilha original. Rodar no SQL Editor do Supabase.

ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_mes_check;
ALTER TABLE orcamentos ADD CONSTRAINT orcamentos_mes_check CHECK (mes BETWEEN 0 AND 14);

NOTIFY pgrst, 'reload schema';
