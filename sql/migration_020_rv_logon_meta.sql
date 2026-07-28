-- Migration 020: meta (%) e peso do indicador DTO T2 (segurança) — cadastro
-- único, uma linha só, valendo pra todas as unidades (ao contrário dos
-- indicadores do BI de Gente, que têm meta por operação/mês). O truque do
-- "id boolean primary key default true" garante no máximo uma linha na
-- tabela. Rodar no SQL Editor do Supabase.
-- Renomeado de "logon" pra "dto_t2" na migration_025 — LogOn vai ser um
-- indicador diferente, com planilha própria.

CREATE TABLE IF NOT EXISTS rv_dto_t2_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_pct   numeric(5,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_dto_t2_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_dto_t2_meta"   ON rv_dto_t2_meta;
DROP POLICY IF EXISTS "leitura_rv_dto_t2_meta" ON rv_dto_t2_meta;

-- Admin/AMBEV: lê e escreve
CREATE POLICY "admin_rv_dto_t2_meta" ON rv_dto_t2_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Qualquer usuário logado pode ler (o painel de RV das unidades precisa)
CREATE POLICY "leitura_rv_dto_t2_meta" ON rv_dto_t2_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_dto_t2_meta_updated_at ON rv_dto_t2_meta;
CREATE TRIGGER rv_dto_t2_meta_updated_at
  BEFORE UPDATE ON rv_dto_t2_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
