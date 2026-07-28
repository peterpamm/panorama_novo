-- Migration 041: meta (R$) e peso dos indicadores Desconto CIVF e Desconto
-- Stress Test (frota) — cadastro único de cada um, uma linha só, valendo
-- pra todas as unidades (mesmo formato do DTO T2/GSD/LogOn/TRI, mas com o
-- campo de meta em R$). Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_desconto_civf_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_valor numeric(12,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_desconto_civf_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_desconto_civf_meta"   ON rv_desconto_civf_meta;
DROP POLICY IF EXISTS "leitura_rv_desconto_civf_meta" ON rv_desconto_civf_meta;

CREATE POLICY "admin_rv_desconto_civf_meta" ON rv_desconto_civf_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_rv_desconto_civf_meta" ON rv_desconto_civf_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_desconto_civf_meta_updated_at ON rv_desconto_civf_meta;
CREATE TRIGGER rv_desconto_civf_meta_updated_at
  BEFORE UPDATE ON rv_desconto_civf_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS rv_desconto_stress_test_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_valor numeric(12,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_desconto_stress_test_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_desconto_stress_test_meta"   ON rv_desconto_stress_test_meta;
DROP POLICY IF EXISTS "leitura_rv_desconto_stress_test_meta" ON rv_desconto_stress_test_meta;

CREATE POLICY "admin_rv_desconto_stress_test_meta" ON rv_desconto_stress_test_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_rv_desconto_stress_test_meta" ON rv_desconto_stress_test_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_desconto_stress_test_meta_updated_at ON rv_desconto_stress_test_meta;
CREATE TRIGGER rv_desconto_stress_test_meta_updated_at
  BEFORE UPDATE ON rv_desconto_stress_test_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
