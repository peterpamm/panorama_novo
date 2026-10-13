-- Migration 117: Scorecard passa a ser um resultado ÚNICO por unidade, não
-- mais um por unidade × negócio (a migration_098 criou com essa quebra por
-- negócio; agora o próprio painel de origem do Scorecard já traz o
-- resultado consolidado da unidade, sem canal/negócio). Cada importação
-- continua substituindo o snapshot inteiro (ver ImportarScorecardDialog.tsx).
--
-- Meta também mudou de 80% pra 65% (`META_SCORECARD` em farol-gerentes.ts) —
-- isso é só código, não precisa de coluna nem migration pra isso.
--
-- CORRIGIDA pela migration_118: Camaçari/Ponta Grossa (gerentes diferentes
-- por negócio) precisam de um Scorecard por negócio, não um só por unidade
-- — essa migration ficou registrada como rodou de verdade (não editar; ver
-- migration_118 pra reintroduzir a coluna `negocio`).
--
-- O snapshot antigo tem várias linhas por unidade (uma por negócio), o que
-- quebra a UNIQUE(unidade) nova — como cada importação sempre substitui o
-- conteúdo inteiro (ver ImportarScorecardDialog.tsx), essas linhas antigas
-- não servem mais de qualquer forma: limpa a tabela antes de criar a
-- constraint, e a próxima importação já repovoa no formato novo.
--
-- Rodar no SQL Editor do Supabase.

DELETE FROM scorecard_acumulado;
ALTER TABLE scorecard_acumulado DROP COLUMN IF EXISTS negocio;
ALTER TABLE scorecard_acumulado ADD CONSTRAINT scorecard_acumulado_unidade_key UNIQUE (unidade);

NOTIFY pgrst, 'reload schema';
