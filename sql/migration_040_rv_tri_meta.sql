-- Migration 040: meta (máximo de TRI) e peso do indicador TRI (acidente
-- grave) — cadastro único, uma linha só, valendo pra todas as unidades
-- (mesmo formato do DTO T2/GSD/LogOn). Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_tri_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_max   numeric(8,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_tri_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_tri_meta"   ON rv_tri_meta;
DROP POLICY IF EXISTS "leitura_rv_tri_meta" ON rv_tri_meta;

-- Admin/AMBEV: lê e escreve
CREATE POLICY "admin_rv_tri_meta" ON rv_tri_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Qualquer usuário logado pode ler (o painel de RV das unidades precisa)
CREATE POLICY "leitura_rv_tri_meta" ON rv_tri_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_tri_meta_updated_at ON rv_tri_meta;
CREATE TRIGGER rv_tri_meta_updated_at
  BEFORE UPDATE ON rv_tri_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
