-- Migration 058: resultado mensal dos indicadores do Armazém que vêm do BI
-- por planilha compartilhada (indicador nas linhas, uma planilha só com até
-- 4 indicadores empilhados — coluna INDICADOR filtra qual é qual): Presenteísmo
-- AL, EFC, TMA e Refugo. Mesmo esquema do resultados_distribuicao_bi.
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS resultados_armazem_bi (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador  text NOT NULL CHECK (indicador IN ('presenteismo_al', 'efc', 'tma', 'refugo')),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  negocio    text NOT NULL DEFAULT 'CONS',
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(10,4) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (indicador, unidade, negocio, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_resultados_armazem_bi_lookup ON resultados_armazem_bi(indicador, unidade, ano, mes);

ALTER TABLE resultados_armazem_bi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_resultados_armazem_bi"   ON resultados_armazem_bi;
DROP POLICY IF EXISTS "leitura_resultados_armazem_bi" ON resultados_armazem_bi;

CREATE POLICY "admin_resultados_armazem_bi" ON resultados_armazem_bi
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_resultados_armazem_bi" ON resultados_armazem_bi
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS resultados_armazem_bi_updated_at ON resultados_armazem_bi;
CREATE TRIGGER resultados_armazem_bi_updated_at
  BEFORE UPDATE ON resultados_armazem_bi FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
