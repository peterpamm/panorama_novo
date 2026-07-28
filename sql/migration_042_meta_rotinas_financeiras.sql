-- Migration 042: meta (% de aderência) das Rotinas Financeiras — cadastro
-- único, uma linha só, usado no Dashboard de Rotinas (tabela acumulado +
-- ranking) pra colorir verde/vermelho em vez de comparar só com a média do
-- período. Fica em "Metas > Financeiro > Metas de Resultado" — não é uma
-- tabela de RV (sem peso), só o valor da meta. Rodar no SQL Editor do
-- Supabase.

CREATE TABLE IF NOT EXISTS meta_rotinas_financeiras (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_pct   numeric(5,2) NOT NULL DEFAULT 90,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meta_rotinas_financeiras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_meta_rotinas_financeiras"   ON meta_rotinas_financeiras;
DROP POLICY IF EXISTS "leitura_meta_rotinas_financeiras" ON meta_rotinas_financeiras;

-- Admin/AMBEV: lê e escreve
CREATE POLICY "admin_meta_rotinas_financeiras" ON meta_rotinas_financeiras
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Qualquer usuário logado pode ler (o dashboard de Rotinas precisa)
CREATE POLICY "leitura_meta_rotinas_financeiras" ON meta_rotinas_financeiras
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS meta_rotinas_financeiras_updated_at ON meta_rotinas_financeiras;
CREATE TRIGGER meta_rotinas_financeiras_updated_at
  BEFORE UPDATE ON meta_rotinas_financeiras FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO meta_rotinas_financeiras (id, meta_pct) VALUES (true, 90) ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
