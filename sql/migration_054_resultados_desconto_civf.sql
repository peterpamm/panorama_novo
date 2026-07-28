-- Migration 054: resultado mensal (R$) do indicador Desconto CIVF da RV de
-- Frota — importado da planilha (aba "Resultado", coluna CIVF), unidade pela
-- coluna CDD GINFO. Compara contra a meta única em rv_desconto_civf_meta.
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS resultados_desconto_civf (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(12,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_resultados_desconto_civf_lookup ON resultados_desconto_civf(unidade, ano, mes);

ALTER TABLE resultados_desconto_civf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_resultados_desconto_civf"   ON resultados_desconto_civf;
DROP POLICY IF EXISTS "leitura_resultados_desconto_civf" ON resultados_desconto_civf;

CREATE POLICY "admin_resultados_desconto_civf" ON resultados_desconto_civf
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_resultados_desconto_civf" ON resultados_desconto_civf
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS resultados_desconto_civf_updated_at ON resultados_desconto_civf;
CREATE TRIGGER resultados_desconto_civf_updated_at
  BEFORE UPDATE ON resultados_desconto_civf FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
