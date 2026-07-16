-- Migration 018: peso (%) dos indicadores da RV de Segurança com origem no
-- DRE (EPI's 074 e Uniformes 075 — os mesmos do Farol de Metas, por AVR vs
-- meta do Farol). Cadastro manual na aba Metas de Segurança; peso único por
-- indicador (vale pra todas as unidades).
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_seguranca_pesos_dre (
  codigo     text PRIMARY KEY,                -- chave do indicador (ex: '074')
  peso       numeric(5,2) NOT NULL DEFAULT 0, -- em % (ex: 30 = 30%)
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_seguranca_pesos_dre ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_seguranca_pesos_dre"   ON rv_seguranca_pesos_dre;
DROP POLICY IF EXISTS "leitura_rv_seguranca_pesos_dre" ON rv_seguranca_pesos_dre;

-- Admin/AMBEV: lê e escreve
CREATE POLICY "admin_rv_seguranca_pesos_dre" ON rv_seguranca_pesos_dre
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Qualquer usuário logado pode ler (o painel de RV das unidades precisa)
CREATE POLICY "leitura_rv_seguranca_pesos_dre" ON rv_seguranca_pesos_dre
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_seguranca_pesos_dre_updated_at ON rv_seguranca_pesos_dre;
CREATE TRIGGER rv_seguranca_pesos_dre_updated_at
  BEFORE UPDATE ON rv_seguranca_pesos_dre FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
