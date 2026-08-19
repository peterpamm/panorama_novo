-- Migration 105: evento do Calendário passa a aceitar mais de uma unidade
-- (Área Financeira > Rotinas > Calendário > Novo evento) — antes era uma
-- unidade só (ou '*' pra todas), agora é uma lista, pra não precisar
-- cadastrar o mesmo RPS/visita várias vezes quando ele vale pra um grupo de
-- unidades (ex: só Diadema e Camaçari).
--
-- Troca a coluna `unidade text` por `unidades text[]` — a sentinela '*' (=
-- todas, migration 100/101) agora é um elemento possível da lista
-- (`unidades = ARRAY['*']`), em vez do valor da coluna inteira.
--
-- Idempotente — pode rodar de novo mesmo já tendo rodado antes (a migração
-- dos dados de `unidade` só roda se essa coluna ainda existir).
--
-- Rodar no SQL Editor do Supabase.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendario_eventos' AND column_name = 'unidades'
  ) THEN
    ALTER TABLE calendario_eventos ADD COLUMN unidades text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- Migra o valor antigo (uma unidade só) pra dentro da lista nova — só roda
-- enquanto a coluna `unidade` ainda existir (primeira vez rodando).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendario_eventos' AND column_name = 'unidade'
  ) THEN
    UPDATE calendario_eventos SET unidades = ARRAY[unidade] WHERE unidades = '{}';
    ALTER TABLE calendario_eventos DROP COLUMN unidade;
  END IF;
END $$;

COMMENT ON COLUMN calendario_eventos.unidades IS
  'Códigos das unidades que o evento vale — pode ter mais de uma; [''*''] = todas (mesma sentinela da migration 100/101).';

DROP INDEX IF EXISTS idx_calendario_eventos_unidade;
CREATE INDEX IF NOT EXISTS idx_calendario_eventos_unidades ON calendario_eventos USING GIN (unidades);

NOTIFY pgrst, 'reload schema';
