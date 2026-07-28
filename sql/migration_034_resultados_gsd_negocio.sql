-- Migration 034: adiciona a coluna `negocio` em resultados_gsd pra quem já
-- tinha rodado a migration_028 ANTES do ajuste que separa Camaçari (CDL
-- rota / CDR armazém) por negócio — mesmo caso do resultados_logon
-- (migration_032). CREATE TABLE IF NOT EXISTS não altera tabela já existente,
-- por isso essa migration em separado. Idempotente — pode rodar mais de uma
-- vez. Rodar no SQL Editor do Supabase.

DO $$
BEGIN
  IF to_regclass('public.resultados_gsd') IS NULL THEN
    RAISE NOTICE 'Tabela resultados_gsd não existe — rode a migration_028 primeiro.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resultados_gsd' AND column_name = 'negocio'
  ) THEN
    ALTER TABLE resultados_gsd ADD COLUMN negocio text NOT NULL DEFAULT 'CONS';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resultados_gsd_unidade_ano_mes_key') THEN
    ALTER TABLE resultados_gsd DROP CONSTRAINT resultados_gsd_unidade_ano_mes_key;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resultados_gsd_unidade_negocio_ano_mes_key') THEN
    ALTER TABLE resultados_gsd ADD CONSTRAINT resultados_gsd_unidade_negocio_ano_mes_key UNIQUE (unidade, negocio, ano, mes);
  END IF;
END $$;

-- Limpeza: se alguma unidade/ano/mês já tiver sido reimportado com o split
-- certo (ROTA/ARM), remove a linha CONS órfã (sobra do teste anterior).
DELETE FROM resultados_gsd rg
WHERE rg.negocio = 'CONS'
AND EXISTS (
  SELECT 1 FROM resultados_gsd rg2
  WHERE rg2.unidade = rg.unidade AND rg2.ano = rg.ano AND rg2.mes = rg.mes AND rg2.negocio <> 'CONS'
);

NOTIFY pgrst, 'reload schema';
