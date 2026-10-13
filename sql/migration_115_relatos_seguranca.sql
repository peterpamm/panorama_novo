-- Migration 115: Relatos de Segurança (RELATOS/GSDPQ) — base da Pirâmide de
-- Segurança do SDG Gerentes. Um relato por linha da planilha (importação em
-- Área Financeira > SDG > SDG Gerentes > Importação): classificação
-- (Incidente, Ato Inseguro, Condição Insegura, Abordagem Positiva, e o que
-- mais aparecer — não é uma lista fechada, a pirâmide desenha o que vier) e
-- se é SIF (Situação de Alto Potencial de Gravidade/precursora de fatalidade
-- — coluna "SIF" da planilha, valor "NÃO" = não é, qualquer outro valor
-- preenchido = é).
--
-- `relato_id` é o ID da linha na planilha de origem (coluna "ID") — chave de
-- upsert, então reimportar o mesmo arquivo (ou um arquivo mais novo que
-- inclui linhas já importadas) atualiza em vez de duplicar.
--
-- Mesmo nível de acesso do resto do SDG Gerentes (migration 114): qualquer
-- admin lê/escreve tudo; usuário de unidade só a própria (os próprios
-- gerentes importam e apresentam).
--
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS relatos_seguranca (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relato_id       bigint NOT NULL UNIQUE,
  unidade         text NOT NULL REFERENCES unidades(codigo),
  data_ocorrencia date NOT NULL,
  ano             int NOT NULL,
  mes             int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  classificacao   text NOT NULL,
  sif             boolean NOT NULL DEFAULT false,
  tipo_relato     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relatos_seguranca_busca ON relatos_seguranca(unidade, ano, mes);

ALTER TABLE relatos_seguranca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_relatos_seguranca" ON relatos_seguranca;
CREATE POLICY "leitura_relatos_seguranca" ON relatos_seguranca
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin' OR unidade = auth_unidade());

DROP POLICY IF EXISTS "escrita_relatos_seguranca" ON relatos_seguranca;
CREATE POLICY "escrita_relatos_seguranca" ON relatos_seguranca
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'admin' OR unidade = auth_unidade());

DROP POLICY IF EXISTS "atualiza_relatos_seguranca" ON relatos_seguranca;
CREATE POLICY "atualiza_relatos_seguranca" ON relatos_seguranca
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin' OR unidade = auth_unidade())
  WITH CHECK (auth_role() = 'admin' OR unidade = auth_unidade());

DROP POLICY IF EXISTS "remocao_relatos_seguranca" ON relatos_seguranca;
CREATE POLICY "remocao_relatos_seguranca" ON relatos_seguranca
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin' OR unidade = auth_unidade());

DROP TRIGGER IF EXISTS trg_relatos_seguranca_updated_at ON relatos_seguranca;
CREATE TRIGGER trg_relatos_seguranca_updated_at
  BEFORE UPDATE ON relatos_seguranca FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
