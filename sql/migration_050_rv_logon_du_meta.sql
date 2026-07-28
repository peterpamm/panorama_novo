-- Migration 050: meta (%) e peso do indicador LogOn DU da RV de Distribuição
-- — meta única, vale pra todas as unidades (mesmo padrão do rv_logon_meta,
-- rv_dto_t2_meta, rv_gsd_meta). Resultado vem de resultados_distribuicao_bi
-- (indicador='aderencia_logon_du'), quanto maior melhor.
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_logon_du_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_pct   numeric(5,2) NOT NULL DEFAULT 0, -- em % (ex: 90 = 90%)
  peso       numeric(5,2) NOT NULL DEFAULT 0, -- em % (ex: 10 = 10%)
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_logon_du_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_logon_du_meta"   ON rv_logon_du_meta;
DROP POLICY IF EXISTS "leitura_rv_logon_du_meta" ON rv_logon_du_meta;

CREATE POLICY "admin_rv_logon_du_meta" ON rv_logon_du_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_rv_logon_du_meta" ON rv_logon_du_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_logon_du_meta_updated_at ON rv_logon_du_meta;
CREATE TRIGGER rv_logon_du_meta_updated_at
  BEFORE UPDATE ON rv_logon_du_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
