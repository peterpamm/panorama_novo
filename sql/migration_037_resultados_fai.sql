-- Migration 037: resultados mensais do indicador FAI (segurança) —
-- contagem de ocorrências com TIPO = "FAI" por unidade. Só ESTÂNCIA e CDR
-- BAHIA (Camaçari ARM) se enquadram — é o indicador que compensa essas duas
-- unidades, que ficam de fora do Excesso de Velocidade. Rodar no SQL Editor
-- do Supabase.

CREATE TABLE IF NOT EXISTS resultados_fai (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor      numeric(8,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_resultados_fai_lookup ON resultados_fai(unidade, ano);

ALTER TABLE resultados_fai ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_resultados_fai"   ON resultados_fai;
DROP POLICY IF EXISTS "unidade_resultados_fai" ON resultados_fai;

-- Admin/AMBEV: lê e escreve tudo
CREATE POLICY "admin_resultados_fai" ON resultados_fai
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Usuário de unidade: só lê a própria
CREATE POLICY "unidade_resultados_fai" ON resultados_fai
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

DROP TRIGGER IF EXISTS resultados_fai_updated_at ON resultados_fai;
CREATE TRIGGER resultados_fai_updated_at
  BEFORE UPDATE ON resultados_fai FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
