-- Migration 060: resultado e metas/pesos dos indicadores do Armazém T1
-- (só ESTÂNCIA e CDR BAHIA) — TMA, Disponibilidade de Gente, Presenteísmo AL
-- e Quebras. Cadastro totalmente separado do T2, mesmo quando o nome do
-- indicador é igual (TMA e Presenteísmo AL existem nos dois, mas com meta,
-- peso e resultado próprios) — indicadores e pesos do T1 vão divergir do T2.
--
--   TMA, Disponibilidade de Gente e Presenteísmo AL: resultado vem de uma
--     planilha do BI própria do T1 (resultados_armazem_t1_bi, indicador nas
--     linhas — mesmo esquema do resultados_armazem_bi do T2). Meta mensal
--     por unidade nos três (muda todo mês, ao contrário do T2) — TMA em
--     minutos (conversão HH:MM, igual ao TMA do T2), os outros dois em %.
--   Quebras: sem importação automática ainda (igual T2) — meta (R$, quanto
--     menor melhor) e peso únicos, valem pras duas unidades.
-- Rodar no SQL Editor do Supabase.

-- ── Resultado (BI do T1: TMA, Disponibilidade de Gente, Presenteísmo AL) ──
CREATE TABLE IF NOT EXISTS resultados_armazem_t1_bi (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador  text NOT NULL CHECK (indicador IN ('tma', 'disponibilidade_gente', 'presenteismo_al')),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  negocio    text NOT NULL DEFAULT 'CONS',
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(10,4) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (indicador, unidade, negocio, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_resultados_armazem_t1_bi_lookup ON resultados_armazem_t1_bi(indicador, unidade, ano, mes);

ALTER TABLE resultados_armazem_t1_bi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_resultados_armazem_t1_bi"   ON resultados_armazem_t1_bi;
DROP POLICY IF EXISTS "leitura_resultados_armazem_t1_bi" ON resultados_armazem_t1_bi;
CREATE POLICY "admin_resultados_armazem_t1_bi" ON resultados_armazem_t1_bi
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_resultados_armazem_t1_bi" ON resultados_armazem_t1_bi
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS resultados_armazem_t1_bi_updated_at ON resultados_armazem_t1_bi;
CREATE TRIGGER resultados_armazem_t1_bi_updated_at
  BEFORE UPDATE ON resultados_armazem_t1_bi FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── TMA (mensal, por unidade, minutos) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS metas_armazem_t1_tma (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(8,2) NOT NULL, -- minutos totais (conversão HH:MM)
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_metas_armazem_t1_tma_lookup ON metas_armazem_t1_tma(unidade, ano, mes);

ALTER TABLE metas_armazem_t1_tma ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_metas_armazem_t1_tma"   ON metas_armazem_t1_tma;
DROP POLICY IF EXISTS "leitura_metas_armazem_t1_tma" ON metas_armazem_t1_tma;
CREATE POLICY "admin_metas_armazem_t1_tma" ON metas_armazem_t1_tma
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_metas_armazem_t1_tma" ON metas_armazem_t1_tma
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS metas_armazem_t1_tma_updated_at ON metas_armazem_t1_tma;
CREATE TRIGGER metas_armazem_t1_tma_updated_at
  BEFORE UPDATE ON metas_armazem_t1_tma FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS rv_armazem_t1_tma_peso (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_armazem_t1_tma_peso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_rv_armazem_t1_tma_peso"   ON rv_armazem_t1_tma_peso;
DROP POLICY IF EXISTS "leitura_rv_armazem_t1_tma_peso" ON rv_armazem_t1_tma_peso;
CREATE POLICY "admin_rv_armazem_t1_tma_peso" ON rv_armazem_t1_tma_peso
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_rv_armazem_t1_tma_peso" ON rv_armazem_t1_tma_peso
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS rv_armazem_t1_tma_peso_updated_at ON rv_armazem_t1_tma_peso;
CREATE TRIGGER rv_armazem_t1_tma_peso_updated_at
  BEFORE UPDATE ON rv_armazem_t1_tma_peso FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Disponibilidade de Gente (mensal, por unidade, %) ───────────────────
CREATE TABLE IF NOT EXISTS metas_armazem_t1_disponibilidade_gente (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(5,2) NOT NULL, -- em % (ex: 90 = 90%)
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_metas_armazem_t1_disponibilidade_gente_lookup ON metas_armazem_t1_disponibilidade_gente(unidade, ano, mes);

ALTER TABLE metas_armazem_t1_disponibilidade_gente ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_metas_armazem_t1_disponibilidade_gente"   ON metas_armazem_t1_disponibilidade_gente;
DROP POLICY IF EXISTS "leitura_metas_armazem_t1_disponibilidade_gente" ON metas_armazem_t1_disponibilidade_gente;
CREATE POLICY "admin_metas_armazem_t1_disponibilidade_gente" ON metas_armazem_t1_disponibilidade_gente
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_metas_armazem_t1_disponibilidade_gente" ON metas_armazem_t1_disponibilidade_gente
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS metas_armazem_t1_disponibilidade_gente_updated_at ON metas_armazem_t1_disponibilidade_gente;
CREATE TRIGGER metas_armazem_t1_disponibilidade_gente_updated_at
  BEFORE UPDATE ON metas_armazem_t1_disponibilidade_gente FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS rv_armazem_t1_disponibilidade_gente_peso (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_armazem_t1_disponibilidade_gente_peso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_rv_armazem_t1_disponibilidade_gente_peso"   ON rv_armazem_t1_disponibilidade_gente_peso;
DROP POLICY IF EXISTS "leitura_rv_armazem_t1_disponibilidade_gente_peso" ON rv_armazem_t1_disponibilidade_gente_peso;
CREATE POLICY "admin_rv_armazem_t1_disponibilidade_gente_peso" ON rv_armazem_t1_disponibilidade_gente_peso
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_rv_armazem_t1_disponibilidade_gente_peso" ON rv_armazem_t1_disponibilidade_gente_peso
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS rv_armazem_t1_disponibilidade_gente_peso_updated_at ON rv_armazem_t1_disponibilidade_gente_peso;
CREATE TRIGGER rv_armazem_t1_disponibilidade_gente_peso_updated_at
  BEFORE UPDATE ON rv_armazem_t1_disponibilidade_gente_peso FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Presenteísmo AL (mensal, por unidade, %) — cadastro separado do T2 ──
CREATE TABLE IF NOT EXISTS metas_armazem_t1_presenteismo_al (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(5,2) NOT NULL, -- em % (ex: 3 = 3%)
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_metas_armazem_t1_presenteismo_al_lookup ON metas_armazem_t1_presenteismo_al(unidade, ano, mes);

ALTER TABLE metas_armazem_t1_presenteismo_al ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_metas_armazem_t1_presenteismo_al"   ON metas_armazem_t1_presenteismo_al;
DROP POLICY IF EXISTS "leitura_metas_armazem_t1_presenteismo_al" ON metas_armazem_t1_presenteismo_al;
CREATE POLICY "admin_metas_armazem_t1_presenteismo_al" ON metas_armazem_t1_presenteismo_al
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_metas_armazem_t1_presenteismo_al" ON metas_armazem_t1_presenteismo_al
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS metas_armazem_t1_presenteismo_al_updated_at ON metas_armazem_t1_presenteismo_al;
CREATE TRIGGER metas_armazem_t1_presenteismo_al_updated_at
  BEFORE UPDATE ON metas_armazem_t1_presenteismo_al FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS rv_armazem_t1_presenteismo_al_peso (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_armazem_t1_presenteismo_al_peso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_rv_armazem_t1_presenteismo_al_peso"   ON rv_armazem_t1_presenteismo_al_peso;
DROP POLICY IF EXISTS "leitura_rv_armazem_t1_presenteismo_al_peso" ON rv_armazem_t1_presenteismo_al_peso;
CREATE POLICY "admin_rv_armazem_t1_presenteismo_al_peso" ON rv_armazem_t1_presenteismo_al_peso
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_rv_armazem_t1_presenteismo_al_peso" ON rv_armazem_t1_presenteismo_al_peso
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS rv_armazem_t1_presenteismo_al_peso_updated_at ON rv_armazem_t1_presenteismo_al_peso;
CREATE TRIGGER rv_armazem_t1_presenteismo_al_peso_updated_at
  BEFORE UPDATE ON rv_armazem_t1_presenteismo_al_peso FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Quebras (meta + peso únicos, R$, quanto menor melhor) ───────────────
CREATE TABLE IF NOT EXISTS rv_armazem_t1_quebras_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_valor numeric(12,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_armazem_t1_quebras_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_rv_armazem_t1_quebras_meta"   ON rv_armazem_t1_quebras_meta;
DROP POLICY IF EXISTS "leitura_rv_armazem_t1_quebras_meta" ON rv_armazem_t1_quebras_meta;
CREATE POLICY "admin_rv_armazem_t1_quebras_meta" ON rv_armazem_t1_quebras_meta
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_rv_armazem_t1_quebras_meta" ON rv_armazem_t1_quebras_meta
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS rv_armazem_t1_quebras_meta_updated_at ON rv_armazem_t1_quebras_meta;
CREATE TRIGGER rv_armazem_t1_quebras_meta_updated_at
  BEFORE UPDATE ON rv_armazem_t1_quebras_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
