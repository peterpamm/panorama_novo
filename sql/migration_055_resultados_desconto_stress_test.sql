-- Migration 055: resultado mensal (R$) do indicador Desconto Stress Test da
-- RV de Frota — importado da planilha (aba "Resultado", coluna TT STRESS
-- TEST), unidade pela coluna CDD GINFO. Compara contra a meta única em
-- rv_desconto_stress_test_meta.
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS resultados_desconto_stress_test (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(12,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_resultados_desconto_stress_test_lookup ON resultados_desconto_stress_test(unidade, ano, mes);

ALTER TABLE resultados_desconto_stress_test ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_resultados_desconto_stress_test"   ON resultados_desconto_stress_test;
DROP POLICY IF EXISTS "leitura_resultados_desconto_stress_test" ON resultados_desconto_stress_test;

CREATE POLICY "admin_resultados_desconto_stress_test" ON resultados_desconto_stress_test
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_resultados_desconto_stress_test" ON resultados_desconto_stress_test
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS resultados_desconto_stress_test_updated_at ON resultados_desconto_stress_test;
CREATE TRIGGER resultados_desconto_stress_test_updated_at
  BEFORE UPDATE ON resultados_desconto_stress_test FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
