-- Migration 084: Justificativa do SDG Financeiro + catálogo padrão de tags
-- do Plano de Ação.
--
-- 1) `planos_acao_tags` — catálogo fixo de tags (antes era texto livre com
--    datalist em PlanoAcaoFormDialog). Cada tag pode opcionalmente se ligar a
--    um dos 5 indicadores "de resultado" do SDG (`sdg_indicador`) — é assim
--    que o slide de cada indicador na apresentação sabe quais ações do Plano
--    de Ação mostrar (ex: tag "EBITDA" ligada a sdg_indicador='ebitda').
--    Tags sem vínculo continuam servindo só pra categorizar ações, sem
--    aparecer em nenhum slide.
-- 2) `sdg_justificativas` — o texto que a unidade escreve (Pontos Positivos /
--    Pontos Negativos) pra cada indicador × mês, editado numa tela própria
--    em Área Financeira > SDG Financeiro e só exibido (read-only) no modo
--    apresentação. Sem histórico/auditoria (diferente de EC/Plano de Ação) —
--    é só um texto de apoio pra reunião, não um status controlado.
--
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS planos_acao_tags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL UNIQUE,
  ativo         boolean NOT NULL DEFAULT true,
  ordem         int NOT NULL DEFAULT 0,
  sdg_indicador text CHECK (sdg_indicador IN ('ebitda', 'adm-geral', 'despesa-adm', 'vales', 'multas'))
);

ALTER TABLE planos_acao_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_planos_acao_tags" ON planos_acao_tags;
CREATE POLICY "leitura_planos_acao_tags" ON planos_acao_tags
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_planos_acao_tags" ON planos_acao_tags;
CREATE POLICY "admin_planos_acao_tags" ON planos_acao_tags
  FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

-- Seed dos 5 indicadores do SDG, já vinculados — o admin pode renomear ou
-- adicionar outras tags livremente depois (vinculadas ou não).
INSERT INTO planos_acao_tags (nome, ativo, ordem, sdg_indicador) VALUES
  ('EBITDA', true, 1, 'ebitda'),
  ('Despesa Administrativa', true, 2, 'adm-geral'),
  ('Despesas ADM Gerais', true, 3, 'despesa-adm'),
  ('Vales', true, 4, 'vales'),
  ('Multas', true, 5, 'multas')
ON CONFLICT (nome) DO NOTHING;

CREATE TABLE IF NOT EXISTS sdg_justificativas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade           text NOT NULL REFERENCES unidades(codigo),
  ano               int NOT NULL,
  mes               int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  indicador         text NOT NULL CHECK (indicador IN ('ebitda', 'adm-geral', 'despesa-adm', 'vales', 'multas')),
  pontos_positivos  text NOT NULL DEFAULT '',
  pontos_negativos  text NOT NULL DEFAULT '',
  updated_by_email  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes, indicador)
);

CREATE INDEX IF NOT EXISTS idx_sdg_justificativas_busca ON sdg_justificativas(unidade, ano, mes);

ALTER TABLE sdg_justificativas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_sdg_justificativas" ON sdg_justificativas;
CREATE POLICY "leitura_sdg_justificativas" ON sdg_justificativas
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin' OR unidade = auth_unidade());

-- Insert/update direto (sem function): não precisa de auditoria por mudança,
-- é só o texto de apoio da própria unidade (ou o admin ajustando em nome
-- dela). `unidade` no INSERT/UPDATE tem que bater com a própria pra não-admin.
DROP POLICY IF EXISTS "escrita_sdg_justificativas" ON sdg_justificativas;
CREATE POLICY "escrita_sdg_justificativas" ON sdg_justificativas
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'admin' OR unidade = auth_unidade());

DROP POLICY IF EXISTS "atualiza_sdg_justificativas" ON sdg_justificativas;
CREATE POLICY "atualiza_sdg_justificativas" ON sdg_justificativas
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin' OR unidade = auth_unidade())
  WITH CHECK (auth_role() = 'admin' OR unidade = auth_unidade());

DROP TRIGGER IF EXISTS trg_sdg_justificativas_updated_at ON sdg_justificativas;
CREATE TRIGGER trg_sdg_justificativas_updated_at
  BEFORE UPDATE ON sdg_justificativas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
