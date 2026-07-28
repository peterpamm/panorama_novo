-- Migration 036: meta (máximo de excessos) e peso do indicador Excesso de
-- Velocidade (segurança) — cadastro por unidade (uma linha por unidade,
-- igual ao DTO T1), já que o máximo permitido varia de unidade pra unidade.
-- Não vale pra ESTÂNCIA (a tela de metas já não lista essa unidade). Rodar
-- no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_excesso_velocidade_meta (
  unidade    text PRIMARY KEY REFERENCES unidades(codigo),
  meta_max   numeric(8,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_excesso_velocidade_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_excesso_velocidade_meta"   ON rv_excesso_velocidade_meta;
DROP POLICY IF EXISTS "leitura_rv_excesso_velocidade_meta" ON rv_excesso_velocidade_meta;

-- Admin/AMBEV: lê e escreve
CREATE POLICY "admin_rv_excesso_velocidade_meta" ON rv_excesso_velocidade_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Qualquer usuário logado pode ler (o painel de RV das unidades precisa)
CREATE POLICY "leitura_rv_excesso_velocidade_meta" ON rv_excesso_velocidade_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_excesso_velocidade_meta_updated_at ON rv_excesso_velocidade_meta;
CREATE TRIGGER rv_excesso_velocidade_meta_updated_at
  BEFORE UPDATE ON rv_excesso_velocidade_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
