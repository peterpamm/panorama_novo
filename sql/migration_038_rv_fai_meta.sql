-- Migration 038: meta (máximo de FAI) e peso do indicador FAI (segurança) —
-- cadastro por unidade (uma linha por unidade, igual ao DTO T1), já que só
-- ESTÂNCIA e CDR BAHIA se enquadram. Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_fai_meta (
  unidade    text PRIMARY KEY REFERENCES unidades(codigo),
  meta_max   numeric(8,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_fai_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_fai_meta"   ON rv_fai_meta;
DROP POLICY IF EXISTS "leitura_rv_fai_meta" ON rv_fai_meta;

-- Admin/AMBEV: lê e escreve
CREATE POLICY "admin_rv_fai_meta" ON rv_fai_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Qualquer usuário logado pode ler (o painel de RV das unidades precisa)
CREATE POLICY "leitura_rv_fai_meta" ON rv_fai_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_fai_meta_updated_at ON rv_fai_meta;
CREATE TRIGGER rv_fai_meta_updated_at
  BEFORE UPDATE ON rv_fai_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
