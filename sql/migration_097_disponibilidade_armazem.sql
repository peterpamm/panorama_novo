-- Migration 097: Disponibilidade Armazém acumulada (Importação > Financeiro
-- > Dados auxiliares) — mesmo espírito da Disponibilidade Rota (migration_096),
-- snapshot único por unidade, sem ano/mês. Diferença: a planilha do Armazém
-- às vezes vem SEM a coluna de meta — nesse caso a importação preserva a
-- última meta já importada (só atualiza o realizado), por isso `meta` aqui
-- é opcional (nullable), diferente da Rota. Alimenta o "Disp. Armazém" do
-- Farol Gerentes.
--
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS disponibilidade_armazem_acumulada (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  meta       numeric,
  real       numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade)
);

ALTER TABLE disponibilidade_armazem_acumulada ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_disponibilidade_armazem" ON disponibilidade_armazem_acumulada;
CREATE POLICY "admin_disponibilidade_armazem" ON disponibilidade_armazem_acumulada
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

DROP POLICY IF EXISTS "unidade_disponibilidade_armazem" ON disponibilidade_armazem_acumulada;
CREATE POLICY "unidade_disponibilidade_armazem" ON disponibilidade_armazem_acumulada
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade IN (auth_unidade(), 'AMBEV'));

DROP TRIGGER IF EXISTS disponibilidade_armazem_acumulada_updated_at ON disponibilidade_armazem_acumulada;
CREATE TRIGGER disponibilidade_armazem_acumulada_updated_at
  BEFORE UPDATE ON disponibilidade_armazem_acumulada FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RPC sem restrição de unidade — o Farol Gerentes mostra Disp. Armazém de
-- todas as unidades pra qualquer usuário logado, mesmo padrão das
-- migrations 093/094/095/096.
CREATE OR REPLACE FUNCTION farol_gerentes_disponibilidade_armazem()
RETURNS SETOF disponibilidade_armazem_acumulada
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM disponibilidade_armazem_acumulada;
$$;

GRANT EXECUTE ON FUNCTION farol_gerentes_disponibilidade_armazem() TO authenticated;

NOTIFY pgrst, 'reload schema';
