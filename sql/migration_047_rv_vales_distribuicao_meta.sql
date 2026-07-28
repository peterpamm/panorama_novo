-- Migration 047: peso e % da Meta de Perdas do indicador Vales da RV de
-- Distribuição — a liderança tem que gastar no máximo X% (ex: 95%) do que a
-- Meta de Perdas de Vales permite no mês (metas_perdas_indicadores,
-- indicador='vales', anual/12). Meta única — vale pra todas as unidades e
-- lideranças da Distribuição, independente do negócio.
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_vales_distribuicao_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  peso       numeric(5,2)  NOT NULL DEFAULT 0, -- em % (ex: 30 = 30%)
  pct_meta   numeric(5,2)  NOT NULL DEFAULT 0, -- % da Meta de Perdas de Vales que pode gastar (ex: 95)
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_vales_distribuicao_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_vales_distribuicao_meta"   ON rv_vales_distribuicao_meta;
DROP POLICY IF EXISTS "leitura_rv_vales_distribuicao_meta" ON rv_vales_distribuicao_meta;

-- Admin/AMBEV: lê e escreve
CREATE POLICY "admin_rv_vales_distribuicao_meta" ON rv_vales_distribuicao_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Qualquer usuário logado pode ler (o painel de RV das unidades precisa)
CREATE POLICY "leitura_rv_vales_distribuicao_meta" ON rv_vales_distribuicao_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_vales_distribuicao_meta_updated_at ON rv_vales_distribuicao_meta;
CREATE TRIGGER rv_vales_distribuicao_meta_updated_at
  BEFORE UPDATE ON rv_vales_distribuicao_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
