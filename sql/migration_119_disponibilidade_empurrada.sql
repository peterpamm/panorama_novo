-- Migration 119: Disponibilidade Empurrada acumulada (Importação >
-- Financeiro > Dados auxiliares) — mesmo espírito da migration_096
-- (Disponibilidade Rota): snapshot único por unidade (sem ano/mês, sempre
-- "o último número importado", já vem acumulado da fonte). Cada importação
-- SUBSTITUI o conteúdo inteiro da tabela (apaga tudo e insere de novo) —
-- não é histórico. Na prática só Ponta Grossa e Estância usam esse
-- indicador (únicas unidades com negócio Empurrada, ver
-- `disponibilidadesDaUnidade` em farol-gerentes.ts), mas a tabela aceita
-- qualquer unidade.
--
-- Alimenta o indicador "Disp. Empurrada" do Farol Gerentes (antes sempre
-- "pendente", sem fonte de dado nenhuma).
--
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS disponibilidade_empurrada_acumulada (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  meta       numeric NOT NULL,
  real       numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade)
);

ALTER TABLE disponibilidade_empurrada_acumulada ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_disponibilidade_empurrada" ON disponibilidade_empurrada_acumulada;
CREATE POLICY "admin_disponibilidade_empurrada" ON disponibilidade_empurrada_acumulada
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

DROP POLICY IF EXISTS "unidade_disponibilidade_empurrada" ON disponibilidade_empurrada_acumulada;
CREATE POLICY "unidade_disponibilidade_empurrada" ON disponibilidade_empurrada_acumulada
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade IN (auth_unidade(), 'AMBEV'));

DROP TRIGGER IF EXISTS disponibilidade_empurrada_acumulada_updated_at ON disponibilidade_empurrada_acumulada;
CREATE TRIGGER disponibilidade_empurrada_acumulada_updated_at
  BEFORE UPDATE ON disponibilidade_empurrada_acumulada FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RPC sem restrição de unidade — o Farol Gerentes mostra Disp. Empurrada de
-- todas as unidades pra qualquer usuário logado, mesmo padrão das
-- migrations 093/094/095/096/097/098.
CREATE OR REPLACE FUNCTION farol_gerentes_disponibilidade_empurrada()
RETURNS SETOF disponibilidade_empurrada_acumulada
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM disponibilidade_empurrada_acumulada;
$$;

GRANT EXECUTE ON FUNCTION farol_gerentes_disponibilidade_empurrada() TO authenticated;

NOTIFY pgrst, 'reload schema';
