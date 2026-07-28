-- Migration 026: resultados mensais do indicador DTO T1 (segurança) — %
-- calculado a partir da planilha de inspeções por colaborador (só ESTÂNCIA e
-- CDR BAHIA se enquadram): (total de colaboradores − colaboradores com "Dias
-- Para Realizar Inspeção" negativo) / total. Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS resultados_dto_t1 (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor      numeric(8,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_resultados_dto_t1_lookup ON resultados_dto_t1(unidade, ano);

ALTER TABLE resultados_dto_t1 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_resultados_dto_t1"   ON resultados_dto_t1;
DROP POLICY IF EXISTS "unidade_resultados_dto_t1" ON resultados_dto_t1;

-- Admin/AMBEV: lê e escreve tudo
CREATE POLICY "admin_resultados_dto_t1" ON resultados_dto_t1
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Usuário de unidade: só lê a própria
CREATE POLICY "unidade_resultados_dto_t1" ON resultados_dto_t1
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

DROP TRIGGER IF EXISTS resultados_dto_t1_updated_at ON resultados_dto_t1;
CREATE TRIGGER resultados_dto_t1_updated_at
  BEFORE UPDATE ON resultados_dto_t1 FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
