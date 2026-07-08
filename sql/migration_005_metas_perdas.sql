-- ============================================================
-- MIGRAÇÃO 005 — tabela de metas de Perdas (base do futuro
-- Painel de Perdas / Tabela de Perdas, recriando a aba Gerencial
-- > Painel de Perdas do painel antigo).
--
-- Formato diferente da tabela `metas` (que é por negócio/código de
-- pacote/mês, em %): aqui é só por unidade + ano, com duas metas —
-- percentual (sobre o faturamento) e financeira anual (R$) — igual
-- ao metas_perdas.csv do painel antigo (unidade;ano;meta;financeiro).
--
-- Rode isso no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS metas_perdas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade     text NOT NULL REFERENCES unidades(codigo),
  ano         int  NOT NULL,
  meta_pct    numeric(6,2)  NOT NULL,  -- % de perdas sobre o faturamento (negativo, ex: -2,42)
  meta_anual  numeric(14,2) NOT NULL,  -- meta financeira anual (R$, negativo)
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano)
);

CREATE INDEX IF NOT EXISTS idx_metas_perdas_lookup ON metas_perdas(unidade, ano);

ALTER TABLE metas_perdas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_metas_perdas"   ON metas_perdas;
DROP POLICY IF EXISTS "unidade_metas_perdas" ON metas_perdas;

-- Mesma regra da tabela `metas`: admin (ou usuário da própria AMBEV) lê/escreve
-- tudo; usuário de unidade só lê a própria + a AMBEV.
CREATE POLICY "admin_metas_perdas" ON metas_perdas
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "unidade_metas_perdas" ON metas_perdas
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade IN (auth_unidade(), 'AMBEV'));

DROP TRIGGER IF EXISTS metas_perdas_updated_at ON metas_perdas;
CREATE TRIGGER metas_perdas_updated_at
  BEFORE UPDATE ON metas_perdas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
