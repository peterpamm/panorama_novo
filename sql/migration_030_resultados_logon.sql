-- Migration 030: resultados mensais do indicador LogOn (segurança) — %
-- de Aderência Total da Trilha, importado direto da planilha por unidade
-- (já vem pronto, ao contrário do GSD/DTO T1, que calculam a partir de
-- colaborador por colaborador). `negocio` separa ROTA/ARMAZEM quando a
-- planilha traz as duas operações da mesma unidade (ex: CDL CAMAÇARI ×
-- CDR BAHIA, ambas Camaçari) — CONS quando a unidade não abre por negócio.
-- Rodar no SQL Editor do Supabase.
-- Observação: "logon"/"rv_logon_meta" ficaram livres depois da migration_025,
-- que renomeou o indicador que usava esse nome por engano pra "dto_t2".

CREATE TABLE IF NOT EXISTS resultados_logon (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  negocio    text NOT NULL DEFAULT 'CONS',
  ano        int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor      numeric(8,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, negocio, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_resultados_logon_lookup ON resultados_logon(unidade, ano);

ALTER TABLE resultados_logon ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_resultados_logon"   ON resultados_logon;
DROP POLICY IF EXISTS "unidade_resultados_logon" ON resultados_logon;

-- Admin/AMBEV: lê e escreve tudo
CREATE POLICY "admin_resultados_logon" ON resultados_logon
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Usuário de unidade: só lê a própria
CREATE POLICY "unidade_resultados_logon" ON resultados_logon
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

DROP TRIGGER IF EXISTS resultados_logon_updated_at ON resultados_logon;
CREATE TRIGGER resultados_logon_updated_at
  BEFORE UPDATE ON resultados_logon FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
