-- Migration 052: meta mensal (%) por unidade do indicador Presenteísmo DU da
-- RV de Distribuição — importada todo mês (igual ao Presenteísmo geral de
-- Metas de Gente), mas em cadastro separado (metas_presenteismo_du) — peso
-- único, vale pra todas (rv_presenteismo_du_peso). Resultado vem de
-- resultados_distribuicao_bi (indicador='presenteismo_du'), quanto menor
-- melhor (presenteísmo é ruim — menos é melhor).
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS metas_presenteismo_du (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(5,2) NOT NULL, -- em % (ex: 3 = 3%)
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_metas_presenteismo_du_lookup ON metas_presenteismo_du(unidade, ano, mes);

ALTER TABLE metas_presenteismo_du ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_metas_presenteismo_du"   ON metas_presenteismo_du;
DROP POLICY IF EXISTS "leitura_metas_presenteismo_du" ON metas_presenteismo_du;

CREATE POLICY "admin_metas_presenteismo_du" ON metas_presenteismo_du
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_metas_presenteismo_du" ON metas_presenteismo_du
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS metas_presenteismo_du_updated_at ON metas_presenteismo_du;
CREATE TRIGGER metas_presenteismo_du_updated_at
  BEFORE UPDATE ON metas_presenteismo_du FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS rv_presenteismo_du_peso (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  peso       numeric(5,2) NOT NULL DEFAULT 0, -- em % (ex: 10 = 10%)
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_presenteismo_du_peso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_presenteismo_du_peso"   ON rv_presenteismo_du_peso;
DROP POLICY IF EXISTS "leitura_rv_presenteismo_du_peso" ON rv_presenteismo_du_peso;

CREATE POLICY "admin_rv_presenteismo_du_peso" ON rv_presenteismo_du_peso
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_rv_presenteismo_du_peso" ON rv_presenteismo_du_peso
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_presenteismo_du_peso_updated_at ON rv_presenteismo_du_peso;
CREATE TRIGGER rv_presenteismo_du_peso_updated_at
  BEFORE UPDATE ON rv_presenteismo_du_peso FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
