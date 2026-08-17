-- Migration 098: Scorecard por unidade × negócio (Importação > Financeiro >
-- Dados auxiliares) — mesmo espírito das Disponibilidades (migrations
-- 096/097), snapshot único sem ano/mês, mas com uma linha POR NEGÓCIO: a
-- planilha vem como unidade/canal/score, e o canal é traduzido pro negócio
-- do app na importação ("Apoio Logístico" = ARM, "Distribuição Urbana" =
-- ROTA, "Empurrada" = EMP, ver scorecard-parser.ts). Alimenta as linhas
-- "Scorecard Rota./Arm./Empur." do Farol Gerentes. A meta é fixa em 80% no
-- código (não tem coluna de meta na planilha nem cadastro), por isso não
-- existe coluna `meta` aqui.
--
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS scorecard_acumulado (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  negocio    text NOT NULL CHECK (negocio IN ('ARM', 'ROTA', 'EMP')),
  score      numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, negocio)
);

ALTER TABLE scorecard_acumulado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_scorecard" ON scorecard_acumulado;
CREATE POLICY "admin_scorecard" ON scorecard_acumulado
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

DROP POLICY IF EXISTS "unidade_scorecard" ON scorecard_acumulado;
CREATE POLICY "unidade_scorecard" ON scorecard_acumulado
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade IN (auth_unidade(), 'AMBEV'));

DROP TRIGGER IF EXISTS scorecard_acumulado_updated_at ON scorecard_acumulado;
CREATE TRIGGER scorecard_acumulado_updated_at
  BEFORE UPDATE ON scorecard_acumulado FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RPC sem restrição de unidade — o Farol Gerentes mostra o Scorecard de
-- todas as unidades pra qualquer usuário logado, mesmo padrão das
-- migrations 093/094/095/096/097.
CREATE OR REPLACE FUNCTION farol_gerentes_scorecard()
RETURNS SETOF scorecard_acumulado
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM scorecard_acumulado;
$$;

GRANT EXECUTE ON FUNCTION farol_gerentes_scorecard() TO authenticated;

NOTIFY pgrst, 'reload schema';
