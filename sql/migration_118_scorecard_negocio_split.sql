-- Migration 118: corrige a migration_117 — Scorecard NÃO pode ser um único
-- valor por unidade de verdade: Camaçari tem 2 gerentes (um por negócio),
-- com Scorecards DIFERENTES cada um, então precisa continuar com uma linha
-- por negócio (ROTA/ARM). As demais unidades — inclusive Ponta Grossa, que
-- é split noutros indicadores mas tem 1 Scorecard só — seguem com 1
-- resultado, gravado com negocio = 'CONS'. A leitura (`buscarScorecard` em
-- farol-gerentes.ts) tenta a chave unidade|negócio do card primeiro e cai
-- pra unidade|CONS se não achar — é assim que Ponta Grossa (2 cards, ambos
-- sem Scorecard próprio por negócio) enxerga o mesmo valor CONS nos 2.
--
-- Reintroduz a coluna `negocio` removida na migration_117. Como cada
-- importação sempre substitui o conteúdo inteiro (ver
-- ImportarScorecardDialog.tsx), não tem dado pra migrar — só recriar a
-- coluna/constraint e deixar a próxima importação repovoar tudo certo.
--
-- Rodar no SQL Editor do Supabase.

-- Apaga tudo primeiro (tabela some vazia) — sem isso, ADD COLUMN ... NOT
-- NULL sem default falharia pra linha já existente.
DELETE FROM scorecard_acumulado;
ALTER TABLE scorecard_acumulado DROP CONSTRAINT IF EXISTS scorecard_acumulado_unidade_key;
ALTER TABLE scorecard_acumulado ADD COLUMN negocio text NOT NULL CHECK (negocio IN ('ARM', 'ROTA', 'EMP', 'CONS'));
ALTER TABLE scorecard_acumulado ADD CONSTRAINT scorecard_acumulado_unidade_negocio_key UNIQUE (unidade, negocio);

NOTIFY pgrst, 'reload schema';
