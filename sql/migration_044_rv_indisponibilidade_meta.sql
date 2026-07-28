-- Migration 044: meta (R$) e peso do indicador Indisponibilidade
-- (Distribuição) — cadastro único, uma linha só, valendo pra todas as
-- unidades (mesmo formato do Desconto CIVF/Stress Test da Frota). O
-- resultado mensal não precisa de importação própria: já vem da mesma
-- planilha de Indisponibilidade importada no Painel de Perdas
-- (tabela painel_perdas_aux, indicador = 'indisponibilidade'). Rodar no SQL
-- Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_indisponibilidade_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_valor numeric(12,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_indisponibilidade_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_indisponibilidade_meta"   ON rv_indisponibilidade_meta;
DROP POLICY IF EXISTS "leitura_rv_indisponibilidade_meta" ON rv_indisponibilidade_meta;

CREATE POLICY "admin_rv_indisponibilidade_meta" ON rv_indisponibilidade_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_rv_indisponibilidade_meta" ON rv_indisponibilidade_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_indisponibilidade_meta_updated_at ON rv_indisponibilidade_meta;
CREATE TRIGGER rv_indisponibilidade_meta_updated_at
  BEFORE UPDATE ON rv_indisponibilidade_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
