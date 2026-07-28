-- Migration 027: meta (%) e peso do indicador DTO T1 (segurança) — cadastro
-- por unidade (uma linha por unidade, ao contrário do DTO T2 que é único),
-- já que só ESTÂNCIA e CDR BAHIA se enquadram nesse indicador. Rodar no SQL
-- Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_dto_t1_meta (
  unidade    text PRIMARY KEY REFERENCES unidades(codigo),
  meta_pct   numeric(5,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_dto_t1_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_dto_t1_meta"   ON rv_dto_t1_meta;
DROP POLICY IF EXISTS "leitura_rv_dto_t1_meta" ON rv_dto_t1_meta;

-- Admin/AMBEV: lê e escreve
CREATE POLICY "admin_rv_dto_t1_meta" ON rv_dto_t1_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Qualquer usuário logado pode ler (o painel de RV das unidades precisa)
CREATE POLICY "leitura_rv_dto_t1_meta" ON rv_dto_t1_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_dto_t1_meta_updated_at ON rv_dto_t1_meta;
CREATE TRIGGER rv_dto_t1_meta_updated_at
  BEFORE UPDATE ON rv_dto_t1_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
