-- Migration 019: resultados mensais do indicador DTO T2 (segurança) — %
-- Realizado importado do BI, direto por unidade (sem operação/negócio, ao
-- contrário do BI de Gente). Rodar no SQL Editor do Supabase.
-- Renomeado de "logon" pra "dto_t2" na migration_025 — LogOn vai ser um
-- indicador diferente, com planilha própria.

CREATE TABLE IF NOT EXISTS resultados_dto_t2 (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor      numeric(8,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_resultados_dto_t2_lookup ON resultados_dto_t2(unidade, ano);

ALTER TABLE resultados_dto_t2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_resultados_dto_t2"   ON resultados_dto_t2;
DROP POLICY IF EXISTS "unidade_resultados_dto_t2" ON resultados_dto_t2;

-- Admin/AMBEV: lê e escreve tudo
CREATE POLICY "admin_resultados_dto_t2" ON resultados_dto_t2
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Usuário de unidade: só lê a própria
CREATE POLICY "unidade_resultados_dto_t2" ON resultados_dto_t2
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

DROP TRIGGER IF EXISTS resultados_dto_t2_updated_at ON resultados_dto_t2;
CREATE TRIGGER resultados_dto_t2_updated_at
  BEFORE UPDATE ON resultados_dto_t2 FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
