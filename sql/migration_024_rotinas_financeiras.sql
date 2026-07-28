-- Migration 024: Rotinas Financeiras (subpágina da Área Financeira) —
-- substitui o GOP de rotinas em planilha. Duas tabelas: o catálogo (nome e
-- prazo editáveis, sem afetar o histórico) e o status mensal por unidade,
-- que referencia o catálogo por ID em vez de por texto — renomear uma
-- rotina não quebra mais o acompanhamento já registrado.
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rotinas_financeiras (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor      text NOT NULL,
  nome       text NOT NULL,
  prazo      text NOT NULL DEFAULT '', -- texto livre, ex: "Dia 10", "4º dia útil", "1 dia após envio da matriz"
  ordem      int  NOT NULL DEFAULT 0,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rotinas_financeiras_status (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina_id  uuid NOT NULL REFERENCES rotinas_financeiras(id) ON DELETE CASCADE,
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  status     text CHECK (status IN ('OK', 'NOK', 'N/A')), -- null = ainda não preenchido
  observacao text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rotina_id, unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_rotinas_fin_status_periodo ON rotinas_financeiras_status(ano, mes);

ALTER TABLE rotinas_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotinas_financeiras_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rotinas_financeiras" ON rotinas_financeiras;
DROP POLICY IF EXISTS "admin_rotinas_financeiras_status" ON rotinas_financeiras_status;

-- Só o time financeiro (admin) enxerga essa área — nada de acesso por unidade.
CREATE POLICY "admin_rotinas_financeiras" ON rotinas_financeiras
  FOR ALL TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY "admin_rotinas_financeiras_status" ON rotinas_financeiras_status
  FOR ALL TO authenticated
  USING (auth_role() = 'admin');

DROP TRIGGER IF EXISTS rotinas_financeiras_updated_at ON rotinas_financeiras;
CREATE TRIGGER rotinas_financeiras_updated_at
  BEFORE UPDATE ON rotinas_financeiras FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS rotinas_financeiras_status_updated_at ON rotinas_financeiras_status;
CREATE TRIGGER rotinas_financeiras_status_updated_at
  BEFORE UPDATE ON rotinas_financeiras_status FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
