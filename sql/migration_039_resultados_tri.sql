-- Migration 039: resultados mensais do indicador TRI (acidente grave) —
-- registrado manualmente (não tem planilha, acidente grave é raro). Vale
-- pra todas as unidades. Mês sem registro conta como zero na apuração (ver
-- RvApuracao.tsx). Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS resultados_tri (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor      numeric(8,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_resultados_tri_lookup ON resultados_tri(unidade, ano);

ALTER TABLE resultados_tri ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_resultados_tri"   ON resultados_tri;
DROP POLICY IF EXISTS "unidade_resultados_tri" ON resultados_tri;

-- Admin/AMBEV: lê e escreve tudo
CREATE POLICY "admin_resultados_tri" ON resultados_tri
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Usuário de unidade: só lê a própria
CREATE POLICY "unidade_resultados_tri" ON resultados_tri
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

DROP TRIGGER IF EXISTS resultados_tri_updated_at ON resultados_tri;
CREATE TRIGGER resultados_tri_updated_at
  BEFORE UPDATE ON resultados_tri FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
