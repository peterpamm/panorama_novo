-- Migration 032: adiciona a coluna `negocio` em resultados_logon pra quem já
-- tinha rodado a migration_030 ANTES do ajuste que separa Camaçari (CDL
-- rota / CDR armazém) por negócio.
--
-- O que aconteceu: a migration_030 usa "CREATE TABLE IF NOT EXISTS" — se a
-- tabela resultados_logon já existia (criada pela versão antiga do script,
-- sem a coluna negocio), rodar a versão nova de novo não alterou a tabela:
-- ela só roda o CREATE TABLE quando a tabela NÃO existe ainda. Por isso a
-- coluna negocio ficou faltando e apareceu "undefined" na tela.
--
-- Esta migration conserta isso direto (idempotente — pode rodar quantas
-- vezes quiser, não dá erro se já tiver sido aplicada). Rodar no SQL Editor
-- do Supabase.

DO $$
BEGIN
  IF to_regclass('public.resultados_logon') IS NULL THEN
    RAISE NOTICE 'Tabela resultados_logon não existe — rode a migration_030 primeiro.';
    RETURN;
  END IF;

  -- Adiciona a coluna se ainda não existir (backfill automático pra 'CONS' nas linhas já importadas).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resultados_logon' AND column_name = 'negocio'
  ) THEN
    ALTER TABLE resultados_logon ADD COLUMN negocio text NOT NULL DEFAULT 'CONS';
  END IF;

  -- Troca a chave única antiga (unidade, ano, mes) pela nova (unidade, negocio, ano, mes).
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resultados_logon_unidade_ano_mes_key') THEN
    ALTER TABLE resultados_logon DROP CONSTRAINT resultados_logon_unidade_ano_mes_key;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resultados_logon_unidade_negocio_ano_mes_key') THEN
    ALTER TABLE resultados_logon ADD CONSTRAINT resultados_logon_unidade_negocio_ano_mes_key UNIQUE (unidade, negocio, ano, mes);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
