-- Migration 096: Disponibilidade Rota acumulada (Importação > Financeiro >
-- Dados auxiliares) — snapshot único por unidade (não tem ano/mês, é
-- sempre "o último número importado", já vem acumulado da fonte). Cada
-- importação nova SUBSTITUI o conteúdo inteiro da tabela (apaga tudo e
-- insere de novo) — é assim de propósito, não é histórico.
--
-- Alimenta só o indicador "Disp. Rota" do Farol Gerentes por enquanto.
--
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS disponibilidade_rota_acumulada (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  meta       numeric NOT NULL,
  real       numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade)
);

ALTER TABLE disponibilidade_rota_acumulada ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_disponibilidade_rota" ON disponibilidade_rota_acumulada;
CREATE POLICY "admin_disponibilidade_rota" ON disponibilidade_rota_acumulada
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

DROP POLICY IF EXISTS "unidade_disponibilidade_rota" ON disponibilidade_rota_acumulada;
CREATE POLICY "unidade_disponibilidade_rota" ON disponibilidade_rota_acumulada
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade IN (auth_unidade(), 'AMBEV'));

DROP TRIGGER IF EXISTS disponibilidade_rota_acumulada_updated_at ON disponibilidade_rota_acumulada;
CREATE TRIGGER disponibilidade_rota_acumulada_updated_at
  BEFORE UPDATE ON disponibilidade_rota_acumulada FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RPC sem restrição de unidade — o Farol Gerentes mostra Disp. Rota de
-- todas as unidades pra qualquer usuário logado, mesmo padrão das
-- migrations 093/094/095.
CREATE OR REPLACE FUNCTION farol_gerentes_disponibilidade_rota()
RETURNS SETOF disponibilidade_rota_acumulada
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM disponibilidade_rota_acumulada;
$$;

GRANT EXECUTE ON FUNCTION farol_gerentes_disponibilidade_rota() TO authenticated;

NOTIFY pgrst, 'reload schema';
