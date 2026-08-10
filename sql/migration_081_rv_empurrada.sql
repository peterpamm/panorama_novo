-- Migration 081: RV de Empurrada — novo setor da Remuneração Variável, só
-- pra Estância (única unidade de Empurrada com RV). 5 indicadores, todos com
-- meta/peso únicos (uma linha só, vale só pra Empurrada):
--   - Indisponibilidade: mesmo dado do Painel de Perdas que a Distribuição já
--     usa (painel_perdas_aux, indicador='indisponibilidade'), meta/peso
--     próprios (não compartilha o peso da Distribuição).
--   - GTY/TMV/Tempo de Rendição: só peso — o resultado/meta já vêm
--     importados na Reunião Resultados (reuniao_resultados_mensais), sem
--     tabela de resultado própria aqui.
--   - Avaria de Transporte: mesmo resultado do indicador Vales (soma da
--     diferença do DRE, contas 051/052, independente do negócio), mas com
--     meta direta em R$ (não % da Meta de Perdas anual como
--     Distribuição/Financeiro usam) — meta/peso únicos, mesmo shape de
--     rv_empurrada_indisponibilidade_meta.
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_empurrada_indisponibilidade_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_valor numeric(12,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_empurrada_indisponibilidade_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_empurrada_indisponibilidade_meta"   ON rv_empurrada_indisponibilidade_meta;
DROP POLICY IF EXISTS "leitura_rv_empurrada_indisponibilidade_meta" ON rv_empurrada_indisponibilidade_meta;

CREATE POLICY "admin_rv_empurrada_indisponibilidade_meta" ON rv_empurrada_indisponibilidade_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_rv_empurrada_indisponibilidade_meta" ON rv_empurrada_indisponibilidade_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_empurrada_indisponibilidade_meta_updated_at ON rv_empurrada_indisponibilidade_meta;
CREATE TRIGGER rv_empurrada_indisponibilidade_meta_updated_at
  BEFORE UPDATE ON rv_empurrada_indisponibilidade_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Avaria de Transporte — mesmo resultado do indicador Vales (DRE 051/052),
-- mas meta direta em R$ (não % da Meta de Perdas anual); rótulo exibido é
-- "Avaria de Transporte", não "Vales".
CREATE TABLE IF NOT EXISTS rv_empurrada_avaria_transporte_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_valor numeric(12,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_empurrada_avaria_transporte_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_empurrada_avaria_transporte_meta"   ON rv_empurrada_avaria_transporte_meta;
DROP POLICY IF EXISTS "leitura_rv_empurrada_avaria_transporte_meta" ON rv_empurrada_avaria_transporte_meta;

CREATE POLICY "admin_rv_empurrada_avaria_transporte_meta" ON rv_empurrada_avaria_transporte_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_rv_empurrada_avaria_transporte_meta" ON rv_empurrada_avaria_transporte_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_empurrada_avaria_transporte_meta_updated_at ON rv_empurrada_avaria_transporte_meta;
CREATE TRIGGER rv_empurrada_avaria_transporte_meta_updated_at
  BEFORE UPDATE ON rv_empurrada_avaria_transporte_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- GTY, TMV e Tempo de Rendição — só peso: resultado/meta já vêm importados
-- na Reunião Resultados (reuniao_resultados_mensais), sem reimportar nada
-- aqui.
CREATE TABLE IF NOT EXISTS rv_empurrada_gty_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_empurrada_gty_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_empurrada_gty_meta"   ON rv_empurrada_gty_meta;
DROP POLICY IF EXISTS "leitura_rv_empurrada_gty_meta" ON rv_empurrada_gty_meta;

CREATE POLICY "admin_rv_empurrada_gty_meta" ON rv_empurrada_gty_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_rv_empurrada_gty_meta" ON rv_empurrada_gty_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_empurrada_gty_meta_updated_at ON rv_empurrada_gty_meta;
CREATE TRIGGER rv_empurrada_gty_meta_updated_at
  BEFORE UPDATE ON rv_empurrada_gty_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS rv_empurrada_tmv_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_empurrada_tmv_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_empurrada_tmv_meta"   ON rv_empurrada_tmv_meta;
DROP POLICY IF EXISTS "leitura_rv_empurrada_tmv_meta" ON rv_empurrada_tmv_meta;

CREATE POLICY "admin_rv_empurrada_tmv_meta" ON rv_empurrada_tmv_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_rv_empurrada_tmv_meta" ON rv_empurrada_tmv_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_empurrada_tmv_meta_updated_at ON rv_empurrada_tmv_meta;
CREATE TRIGGER rv_empurrada_tmv_meta_updated_at
  BEFORE UPDATE ON rv_empurrada_tmv_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS rv_empurrada_rendicao_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_empurrada_rendicao_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_empurrada_rendicao_meta"   ON rv_empurrada_rendicao_meta;
DROP POLICY IF EXISTS "leitura_rv_empurrada_rendicao_meta" ON rv_empurrada_rendicao_meta;

CREATE POLICY "admin_rv_empurrada_rendicao_meta" ON rv_empurrada_rendicao_meta
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_rv_empurrada_rendicao_meta" ON rv_empurrada_rendicao_meta
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_empurrada_rendicao_meta_updated_at ON rv_empurrada_rendicao_meta;
CREATE TRIGGER rv_empurrada_rendicao_meta_updated_at
  BEFORE UPDATE ON rv_empurrada_rendicao_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
