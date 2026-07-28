-- Migration 035: resultados mensais do indicador Excesso de Velocidade
-- (segurança) — contagem de excessos (linhas da planilha onde EXCESSO >
-- LIMIAR) por unidade. Não vale pra ESTÂNCIA nem pra Camaçari ARM (a
-- importação já filtra essas linhas fora, então não precisa de coluna
-- negocio aqui — o valor de Camaçari é só da ROTA). Rodar no SQL Editor do
-- Supabase.

CREATE TABLE IF NOT EXISTS resultados_excesso_velocidade (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor      numeric(8,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_resultados_excesso_velocidade_lookup ON resultados_excesso_velocidade(unidade, ano);

ALTER TABLE resultados_excesso_velocidade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_resultados_excesso_velocidade"   ON resultados_excesso_velocidade;
DROP POLICY IF EXISTS "unidade_resultados_excesso_velocidade" ON resultados_excesso_velocidade;

-- Admin/AMBEV: lê e escreve tudo
CREATE POLICY "admin_resultados_excesso_velocidade" ON resultados_excesso_velocidade
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Usuário de unidade: só lê a própria
CREATE POLICY "unidade_resultados_excesso_velocidade" ON resultados_excesso_velocidade
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

DROP TRIGGER IF EXISTS resultados_excesso_velocidade_updated_at ON resultados_excesso_velocidade;
CREATE TRIGGER resultados_excesso_velocidade_updated_at
  BEFORE UPDATE ON resultados_excesso_velocidade FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
