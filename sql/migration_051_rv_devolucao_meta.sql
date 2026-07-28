-- Migration 051: meta (%) por unidade e peso único do indicador Devolução da
-- RV de Distribuição — meta diferente por unidade (rv_devolucao_meta), peso
-- único vale pra todas (rv_devolucao_peso). Resultado vem de
-- resultados_distribuicao_bi (indicador='devolucao_pdv'), quanto menor
-- melhor (devolução é perda — menos devolução é melhor).
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_devolucao_meta (
  unidade    text PRIMARY KEY REFERENCES unidades(codigo),
  meta_pct   numeric(5,2) NOT NULL DEFAULT 0, -- em % (ex: 3 = 3%)
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_devolucao_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_devolucao_meta"   ON rv_devolucao_meta;
DROP POLICY IF EXISTS "leitura_rv_devolucao_meta" ON rv_devolucao_meta;

CREATE POLICY "admin_rv_devolucao_meta" ON rv_devolucao_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_rv_devolucao_meta" ON rv_devolucao_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_devolucao_meta_updated_at ON rv_devolucao_meta;
CREATE TRIGGER rv_devolucao_meta_updated_at
  BEFORE UPDATE ON rv_devolucao_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS rv_devolucao_peso (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  peso       numeric(5,2) NOT NULL DEFAULT 0, -- em % (ex: 10 = 10%)
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_devolucao_peso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_devolucao_peso"   ON rv_devolucao_peso;
DROP POLICY IF EXISTS "leitura_rv_devolucao_peso" ON rv_devolucao_peso;

CREATE POLICY "admin_rv_devolucao_peso" ON rv_devolucao_peso
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_rv_devolucao_peso" ON rv_devolucao_peso
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_devolucao_peso_updated_at ON rv_devolucao_peso;
CREATE TRIGGER rv_devolucao_peso_updated_at
  BEFORE UPDATE ON rv_devolucao_peso FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
