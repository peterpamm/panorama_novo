-- ============================================================
-- MIGRAÇÃO 006 — tabela auxiliar do Painel de Perdas
-- (Indisponibilidade e Devolução — os 2 indicadores que NÃO
-- vêm da DRE: no painel antigo eram lidos do painel_de_perdas.csv).
--
-- Formato do CSV de importação (herdado do painel antigo):
--   INDICADOR;NEGOCIO;ANO;MES;UNIDADE;VALOR
-- A coluna NEGOCIO é ignorada (sempre CONS); aqui só armazenamos
-- os dados necessários.
--
-- Rode isso no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS painel_perdas_aux (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  indicador  text NOT NULL CHECK (indicador IN ('indisponibilidade', 'devolucao')),
  valor      numeric(14,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes, indicador)
);

CREATE INDEX IF NOT EXISTS idx_painel_perdas_aux_lookup ON painel_perdas_aux(unidade, ano, mes);

ALTER TABLE painel_perdas_aux ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_painel_perdas_aux"   ON painel_perdas_aux;
DROP POLICY IF EXISTS "unidade_painel_perdas_aux" ON painel_perdas_aux;

-- Admin/AMBEV: lê e escreve tudo
CREATE POLICY "admin_painel_perdas_aux" ON painel_perdas_aux
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Usuário de unidade: só lê a própria
CREATE POLICY "unidade_painel_perdas_aux" ON painel_perdas_aux
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

DROP TRIGGER IF EXISTS painel_perdas_aux_updated_at ON painel_perdas_aux;
CREATE TRIGGER painel_perdas_aux_updated_at
  BEFORE UPDATE ON painel_perdas_aux FOR EACH ROW EXECUTE FUNCTION update_updated_at();
