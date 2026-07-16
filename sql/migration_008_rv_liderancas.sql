-- Migration 008: RV das lideranças (base pro futuro painel de RV do time)
-- Cadastro corrente (sem histórico por mês): 1 linha por liderança, atualizada por upsert no nome.
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_liderancas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao   text NOT NULL,           -- nome da operação como vem na planilha (ex: FRANCISCO BELTRÃO)
  setor      text NOT NULL,           -- ex: RH
  funcao     text NOT NULL,           -- ex: ANALISTA RH, COORD. RH, SUPERVISOR RH
  nome       text NOT NULL UNIQUE,    -- nome da liderança (chave do upsert)
  valor      numeric(12,2) NOT NULL,  -- valor da RV em R$
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rv_liderancas_operacao ON rv_liderancas(operacao);

ALTER TABLE rv_liderancas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_liderancas" ON rv_liderancas;

-- Admin/AMBEV: lê e escreve tudo (RV é dado sensível — sem acesso por unidade por enquanto)
CREATE POLICY "admin_rv_liderancas" ON rv_liderancas
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

DROP TRIGGER IF EXISTS rv_liderancas_updated_at ON rv_liderancas;
CREATE TRIGGER rv_liderancas_updated_at
  BEFORE UPDATE ON rv_liderancas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
