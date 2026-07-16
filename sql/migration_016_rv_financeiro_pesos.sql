-- Migration 016: peso (%) dos indicadores da RV do Financeiro — todos com
-- origem no DRE (Despesa ADM 157 e Custo Operacional 021 por AVR; Vales
-- 051+052 e Multas 137+222 por dispersão). Cadastro manual na aba Metas do
-- Financeiro; peso único por indicador (vale pra todas as unidades).
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_financeiro_pesos_dre (
  codigo     text PRIMARY KEY,                -- chave do indicador (ex: '157', 'VALES')
  peso       numeric(5,2) NOT NULL DEFAULT 0, -- em % (ex: 30 = 30%)
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_financeiro_pesos_dre ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_financeiro_pesos_dre"   ON rv_financeiro_pesos_dre;
DROP POLICY IF EXISTS "leitura_rv_financeiro_pesos_dre" ON rv_financeiro_pesos_dre;

-- Admin/AMBEV: lê e escreve
CREATE POLICY "admin_rv_financeiro_pesos_dre" ON rv_financeiro_pesos_dre
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Qualquer usuário logado pode ler (o painel de RV das unidades precisa)
CREATE POLICY "leitura_rv_financeiro_pesos_dre" ON rv_financeiro_pesos_dre
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_financeiro_pesos_dre_updated_at ON rv_financeiro_pesos_dre;
CREATE TRIGGER rv_financeiro_pesos_dre_updated_at
  BEFORE UPDATE ON rv_financeiro_pesos_dre FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
