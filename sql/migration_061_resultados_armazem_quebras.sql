-- Migration 061: resultado mensal das Quebras do Armazém — não vem de
-- nenhuma planilha (nem T2 nem T1), cadastro totalmente manual direto na
-- tela (Importação > Armazém > Quebras), uma célula editável por
-- unidade×mês. Cobre todas as unidades cadastradas, inclusive Estância e
-- CDR Bahia (T1) — a mesma tabela serve de resultado tanto pra comparar
-- com a meta do T2 (rv_armazem_quebras_meta) quanto com a do T1
-- (rv_armazem_t1_quebras_meta).
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS resultados_armazem_quebras (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_resultados_armazem_quebras_lookup ON resultados_armazem_quebras(unidade, ano, mes);

ALTER TABLE resultados_armazem_quebras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_resultados_armazem_quebras"   ON resultados_armazem_quebras;
DROP POLICY IF EXISTS "leitura_resultados_armazem_quebras" ON resultados_armazem_quebras;

CREATE POLICY "admin_resultados_armazem_quebras" ON resultados_armazem_quebras
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_resultados_armazem_quebras" ON resultados_armazem_quebras
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS resultados_armazem_quebras_updated_at ON resultados_armazem_quebras;
CREATE TRIGGER resultados_armazem_quebras_updated_at
  BEFORE UPDATE ON resultados_armazem_quebras FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
