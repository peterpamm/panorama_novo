-- Migration 059: metas e pesos dos indicadores do Armazém T2 — Presenteísmo
-- AL, EFC, TMA, Refugo (resultado importado em Importação > Armazém, ver
-- resultados_armazem_bi) + Quebras (ainda sem importação automática, só meta
-- e peso cadastrados aqui por enquanto). T1 (Estância/CDR Bahia) fica pra
-- depois — indicadores e pesos serão diferentes.
--
--   EFC e TMA: meta diferente por unidade, vale o ano todo (sem coluna de
--     ano, igual à Devolução) — TMA em minutos, igual à conversão HH:MM do
--     resultado importado. Peso único (rv_armazem_efc_peso / rv_armazem_tma_peso).
--   Presenteísmo AL: meta mensal por unidade (metas_armazem_presenteismo_al,
--     mesmo formato do metas_presenteismo_du) — importada em Importação >
--     Armazém. Peso único (rv_armazem_presenteismo_al_peso).
--   Refugo: meta (%) e peso únicos, valem pra todas as unidades
--     (rv_armazem_refugo_meta).
--   Quebras: meta (R$, quanto menor melhor) e peso únicos, valem pra todas
--     as unidades (rv_armazem_quebras_meta).
-- Rodar no SQL Editor do Supabase.

-- ── EFC ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rv_armazem_efc_meta (
  unidade    text PRIMARY KEY REFERENCES unidades(codigo),
  meta_pct   numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_armazem_efc_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_rv_armazem_efc_meta"   ON rv_armazem_efc_meta;
DROP POLICY IF EXISTS "leitura_rv_armazem_efc_meta" ON rv_armazem_efc_meta;
CREATE POLICY "admin_rv_armazem_efc_meta" ON rv_armazem_efc_meta
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_rv_armazem_efc_meta" ON rv_armazem_efc_meta
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS rv_armazem_efc_meta_updated_at ON rv_armazem_efc_meta;
CREATE TRIGGER rv_armazem_efc_meta_updated_at
  BEFORE UPDATE ON rv_armazem_efc_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS rv_armazem_efc_peso (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_armazem_efc_peso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_rv_armazem_efc_peso"   ON rv_armazem_efc_peso;
DROP POLICY IF EXISTS "leitura_rv_armazem_efc_peso" ON rv_armazem_efc_peso;
CREATE POLICY "admin_rv_armazem_efc_peso" ON rv_armazem_efc_peso
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_rv_armazem_efc_peso" ON rv_armazem_efc_peso
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS rv_armazem_efc_peso_updated_at ON rv_armazem_efc_peso;
CREATE TRIGGER rv_armazem_efc_peso_updated_at
  BEFORE UPDATE ON rv_armazem_efc_peso FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── TMA ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rv_armazem_tma_meta (
  unidade      text PRIMARY KEY REFERENCES unidades(codigo),
  meta_minutos numeric(8,2) NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_armazem_tma_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_rv_armazem_tma_meta"   ON rv_armazem_tma_meta;
DROP POLICY IF EXISTS "leitura_rv_armazem_tma_meta" ON rv_armazem_tma_meta;
CREATE POLICY "admin_rv_armazem_tma_meta" ON rv_armazem_tma_meta
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_rv_armazem_tma_meta" ON rv_armazem_tma_meta
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS rv_armazem_tma_meta_updated_at ON rv_armazem_tma_meta;
CREATE TRIGGER rv_armazem_tma_meta_updated_at
  BEFORE UPDATE ON rv_armazem_tma_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS rv_armazem_tma_peso (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_armazem_tma_peso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_rv_armazem_tma_peso"   ON rv_armazem_tma_peso;
DROP POLICY IF EXISTS "leitura_rv_armazem_tma_peso" ON rv_armazem_tma_peso;
CREATE POLICY "admin_rv_armazem_tma_peso" ON rv_armazem_tma_peso
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_rv_armazem_tma_peso" ON rv_armazem_tma_peso
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS rv_armazem_tma_peso_updated_at ON rv_armazem_tma_peso;
CREATE TRIGGER rv_armazem_tma_peso_updated_at
  BEFORE UPDATE ON rv_armazem_tma_peso FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Presenteísmo AL (mensal, por unidade) ───────────────────────────────
CREATE TABLE IF NOT EXISTS metas_armazem_presenteismo_al (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(5,2) NOT NULL, -- em % (ex: 3 = 3%)
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_metas_armazem_presenteismo_al_lookup ON metas_armazem_presenteismo_al(unidade, ano, mes);

ALTER TABLE metas_armazem_presenteismo_al ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_metas_armazem_presenteismo_al"   ON metas_armazem_presenteismo_al;
DROP POLICY IF EXISTS "leitura_metas_armazem_presenteismo_al" ON metas_armazem_presenteismo_al;
CREATE POLICY "admin_metas_armazem_presenteismo_al" ON metas_armazem_presenteismo_al
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_metas_armazem_presenteismo_al" ON metas_armazem_presenteismo_al
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS metas_armazem_presenteismo_al_updated_at ON metas_armazem_presenteismo_al;
CREATE TRIGGER metas_armazem_presenteismo_al_updated_at
  BEFORE UPDATE ON metas_armazem_presenteismo_al FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS rv_armazem_presenteismo_al_peso (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_armazem_presenteismo_al_peso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_rv_armazem_presenteismo_al_peso"   ON rv_armazem_presenteismo_al_peso;
DROP POLICY IF EXISTS "leitura_rv_armazem_presenteismo_al_peso" ON rv_armazem_presenteismo_al_peso;
CREATE POLICY "admin_rv_armazem_presenteismo_al_peso" ON rv_armazem_presenteismo_al_peso
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_rv_armazem_presenteismo_al_peso" ON rv_armazem_presenteismo_al_peso
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS rv_armazem_presenteismo_al_peso_updated_at ON rv_armazem_presenteismo_al_peso;
CREATE TRIGGER rv_armazem_presenteismo_al_peso_updated_at
  BEFORE UPDATE ON rv_armazem_presenteismo_al_peso FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Refugo (meta + peso únicos, %) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS rv_armazem_refugo_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_pct   numeric(5,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_armazem_refugo_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_rv_armazem_refugo_meta"   ON rv_armazem_refugo_meta;
DROP POLICY IF EXISTS "leitura_rv_armazem_refugo_meta" ON rv_armazem_refugo_meta;
CREATE POLICY "admin_rv_armazem_refugo_meta" ON rv_armazem_refugo_meta
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_rv_armazem_refugo_meta" ON rv_armazem_refugo_meta
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS rv_armazem_refugo_meta_updated_at ON rv_armazem_refugo_meta;
CREATE TRIGGER rv_armazem_refugo_meta_updated_at
  BEFORE UPDATE ON rv_armazem_refugo_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Quebras (meta + peso únicos, R$, quanto menor melhor) ───────────────
CREATE TABLE IF NOT EXISTS rv_armazem_quebras_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_valor numeric(12,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rv_armazem_quebras_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_rv_armazem_quebras_meta"   ON rv_armazem_quebras_meta;
DROP POLICY IF EXISTS "leitura_rv_armazem_quebras_meta" ON rv_armazem_quebras_meta;
CREATE POLICY "admin_rv_armazem_quebras_meta" ON rv_armazem_quebras_meta
  FOR ALL TO authenticated USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');
CREATE POLICY "leitura_rv_armazem_quebras_meta" ON rv_armazem_quebras_meta
  FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS rv_armazem_quebras_meta_updated_at ON rv_armazem_quebras_meta;
CREATE TRIGGER rv_armazem_quebras_meta_updated_at
  BEFORE UPDATE ON rv_armazem_quebras_meta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
