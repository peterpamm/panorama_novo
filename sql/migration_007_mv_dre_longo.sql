-- ============================================================
-- MIGRAÇÃO 007 — View materializada de dre_longo
--
-- PROBLEMA: vw_dre_longo faz CROSS JOIN dre_lancamentos × 12 meses
-- a cada query, recalculando tudo do zero. Com 176k linhas isso gera
-- queries de vários segundos antes de qualquer dado chegar ao app.
--
-- SOLUÇÃO:
--   _mv_dre_longo_raw  — view materializada (dados pré-computados, sem RLS)
--   mv_dre_longo       — view regular por cima, com filtro de segurança
--                        (mesmo nome que o app já usa — nenhuma mudança de código)
--
-- Views materializadas no Postgres não suportam RLS diretamente.
-- O padrão correto é: materializar tudo em uma view interna sem acesso
-- público, e expor via view regular com WHERE dinâmico usando auth_role()
-- e auth_unidade() — as mesmas funções que dre_lancamentos já usa.
--
-- COMO RODAR: cole no SQL Editor do Supabase e execute tudo de uma vez.
-- ============================================================

-- Limpa o que pode ter sobrado de execuções anteriores
DROP MATERIALIZED VIEW IF EXISTS mv_dre_longo CASCADE;
DROP VIEW             IF EXISTS mv_dre_longo CASCADE;
DROP MATERIALIZED VIEW IF EXISTS _mv_dre_longo_raw CASCADE;

-- ── 1. View materializada interna (sem acesso público) ──────────────────
CREATE MATERIALIZED VIEW _mv_dre_longo_raw AS
SELECT * FROM vw_dre_longo;

-- Revoga qualquer acesso direto — segurança aplicada pela view wrapper abaixo
REVOKE ALL ON _mv_dre_longo_raw FROM PUBLIC;
REVOKE ALL ON _mv_dre_longo_raw FROM anon;
REVOKE ALL ON _mv_dre_longo_raw FROM authenticated;

-- ── 2. Índices ──────────────────────────────────────────────────────────
-- Busca por unidade (página do Farol, useDreLongo)
CREATE INDEX idx_mv_dre_longo_unidade
  ON _mv_dre_longo_raw (unidade, negocio, tipo_periodo, ano, mes);

-- Busca global sem filtro de unidade (Ranking, Painel de Perdas)
CREATE INDEX idx_mv_dre_longo_negocio_tipo
  ON _mv_dre_longo_raw (negocio, tipo_periodo);

-- ── 3. View de segurança (mesmo nome que o app usa) ─────────────────────
-- auth_role() e auth_unidade() já existem no schema.sql do projeto.
-- Esta view aplica o mesmo filtro de dre_lancamentos, mas em tempo de leitura.
CREATE OR REPLACE VIEW mv_dre_longo AS
SELECT * FROM _mv_dre_longo_raw
WHERE auth_role() = 'admin'
   OR auth_unidade() = 'AMBEV'
   OR (auth_role() = 'unidade' AND unidade IN (auth_unidade(), 'AMBEV'));

GRANT SELECT ON mv_dre_longo TO authenticated;

-- ── 4. Função de refresh ─────────────────────────────────────────────────
-- Chamada automaticamente pelo app após cada importação de DRE.
-- SECURITY DEFINER: roda como postgres (ignora RLS do usuário logado),
-- garantindo que a view materializada sempre tenha todos os dados.
CREATE OR REPLACE FUNCTION refresh_mv_dre_longo()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  REFRESH MATERIALIZED VIEW _mv_dre_longo_raw;
$$;

GRANT EXECUTE ON FUNCTION refresh_mv_dre_longo() TO authenticated;

-- ── 5. Primeiro refresh (popula a view agora) ────────────────────────────
SELECT refresh_mv_dre_longo();
