-- Migration 014: resultados mensais dos indicadores de gente (realizado do BI),
-- importados mês a mês pelo corporativo de Gente. Par da metas_gente — o painel
-- de RV cruza resultado × meta por indicador + operação do BI + ano + mês.
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS resultados_gente (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador   text NOT NULL,
  unidade     text NOT NULL REFERENCES unidades(codigo),
  operacao_bi text NOT NULL,
  ano         int  NOT NULL,
  mes         int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor       numeric(8,2) NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (indicador, operacao_bi, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_resultados_gente_lookup ON resultados_gente(unidade, ano, indicador);

ALTER TABLE resultados_gente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_resultados_gente"   ON resultados_gente;
DROP POLICY IF EXISTS "unidade_resultados_gente" ON resultados_gente;

-- Admin/AMBEV: lê e escreve tudo
CREATE POLICY "admin_resultados_gente" ON resultados_gente
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Usuário de unidade: só lê a própria
CREATE POLICY "unidade_resultados_gente" ON resultados_gente
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

DROP TRIGGER IF EXISTS resultados_gente_updated_at ON resultados_gente;
CREATE TRIGGER resultados_gente_updated_at
  BEFORE UPDATE ON resultados_gente FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
