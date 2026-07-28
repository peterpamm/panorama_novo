-- Migration 028: resultados mensais do indicador GSD (segurança) — %
-- calculado a partir da planilha por colaborador (colunas Filial/Status):
-- (total de colaboradores − colaboradores com Status "FORA DO PRAZO") /
-- total. `negocio` separa ROTA/ARM quando a planilha traz as duas operações
-- da mesma unidade (ex: CDL CAMAÇARI × CDR BAHIA, ambas Camaçari) — CONS
-- quando a unidade não abre por negócio. Rodar no SQL Editor do Supabase.
-- Se você já rodou a versão antiga desta migration (sem a coluna negocio),
-- rode também a migration_034, que faz o ALTER TABLE nela (CREATE TABLE IF
-- NOT EXISTS não altera uma tabela que já existe).

CREATE TABLE IF NOT EXISTS resultados_gsd (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  negocio    text NOT NULL DEFAULT 'CONS',
  ano        int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor      numeric(8,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, negocio, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_resultados_gsd_lookup ON resultados_gsd(unidade, ano);

ALTER TABLE resultados_gsd ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_resultados_gsd"   ON resultados_gsd;
DROP POLICY IF EXISTS "unidade_resultados_gsd" ON resultados_gsd;

-- Admin/AMBEV: lê e escreve tudo
CREATE POLICY "admin_resultados_gsd" ON resultados_gsd
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Usuário de unidade: só lê a própria
CREATE POLICY "unidade_resultados_gsd" ON resultados_gsd
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

DROP TRIGGER IF EXISTS resultados_gsd_updated_at ON resultados_gsd;
CREATE TRIGGER resultados_gsd_updated_at
  BEFORE UPDATE ON resultados_gsd FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
