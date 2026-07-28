-- Migration 021: orçamento anual por unidade/negócio/mês/conta — espelha a
-- planilha "ORÇAMENTOS", um DRE resumido (só as contas orçadas) com o valor
-- orçado (R$) e o AVR orçado (%) de cada mês, mais o bloco TOTAL (mes=0, a
-- meta do ano). Base pra calcular metas de RV (semestral/anual) a partir do
-- orçamento. `conta_codigo`/`conta_nome` são os da própria planilha de
-- orçamento — numeração própria (menos linhas que o plano de contas do DRE),
-- sem FK pra `contas`. Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS orcamentos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade      text NOT NULL REFERENCES unidades(codigo),
  negocio      text NOT NULL REFERENCES negocios(codigo),
  ano          int  NOT NULL,
  mes          int  NOT NULL CHECK (mes BETWEEN 0 AND 14), -- 0 = anual (bloco TOTAL), 13/14 = 1º/2º semestre (recalculados, não vêm da planilha)
  conta_codigo text NOT NULL,
  conta_nome   text NOT NULL DEFAULT '',
  orcado       numeric(16,2) NOT NULL DEFAULT 0,
  av           numeric(8,2)  NOT NULL DEFAULT 0,
  ah           numeric(8,2)  NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, negocio, ano, mes, conta_codigo)
);

CREATE INDEX IF NOT EXISTS idx_orcamentos_lookup ON orcamentos(unidade, negocio, ano);

ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_orcamentos"   ON orcamentos;
DROP POLICY IF EXISTS "unidade_orcamentos" ON orcamentos;

-- Admin/AMBEV: lê e escreve tudo
CREATE POLICY "admin_orcamentos" ON orcamentos
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Usuário de unidade: só lê a própria
CREATE POLICY "unidade_orcamentos" ON orcamentos
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

DROP TRIGGER IF EXISTS orcamentos_updated_at ON orcamentos;
CREATE TRIGGER orcamentos_updated_at
  BEFORE UPDATE ON orcamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
