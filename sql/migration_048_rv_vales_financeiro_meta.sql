-- Migration 048: peso e % da Meta de Perdas do indicador Vales da RV do
-- Financeiro — mesma regra da RV de Distribuição (migration 047): a
-- liderança tem que gastar no máximo X% (ex: 95%) do que a Meta de Perdas de
-- Vales permite no mês (metas_perdas_indicadores, indicador='vales',
-- anual/12). Substitui a regra antiga (dispersão ≥ 0) do indicador VALES que
-- antes vinha de RV_FINANCEIRO_DRE/rv_financeiro_pesos_dre. Meta única —
-- vale pra todas as unidades e lideranças do Financeiro.
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_vales_financeiro_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  peso       numeric(5,2)  NOT NULL DEFAULT 0, -- em % (ex: 30 = 30%)
  pct_meta   numeric(5,2)  NOT NULL DEFAULT 0, -- % da Meta de Perdas de Vales que pode gastar (ex: 95)
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_vales_financeiro_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_vales_financeiro_meta"   ON rv_vales_financeiro_meta;
DROP POLICY IF EXISTS "leitura_rv_vales_financeiro_meta" ON rv_vales_financeiro_meta;

-- Admin/AMBEV: lê e escreve
CREATE POLICY "admin_rv_vales_financeiro_meta" ON rv_vales_financeiro_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Qualquer usuário logado pode ler (o painel de RV das unidades precisa)
CREATE POLICY "leitura_rv_vales_financeiro_meta" ON rv_vales_financeiro_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_vales_financeiro_meta_updated_at ON rv_vales_financeiro_meta;
CREATE TRIGGER rv_vales_financeiro_meta_updated_at
  BEFORE UPDATE ON rv_vales_financeiro_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Remove o peso antigo de VALES em rv_financeiro_pesos_dre (o indicador saiu
-- de RV_FINANCEIRO_DRE — cadastre o novo peso em rv_vales_financeiro_meta).
DELETE FROM rv_financeiro_pesos_dre WHERE codigo = 'VALES';

NOTIFY pgrst, 'reload schema';
