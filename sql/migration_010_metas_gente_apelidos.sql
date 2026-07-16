-- Migration 010: apelidos de unidade (nomes alternativos do BI da Ambev) + metas de gente
-- Rodar no SQL Editor do Supabase.

-- 1) Apelidos: nomes alternativos pra reconhecer a unidade em arquivos externos
--    (ex: CAMACARI ← "CDL CAMAÇARI" (rota) e "CDR BAHIA"; ARACAJU ← "CDD ARACAJU", "CD ARACAJU")
ALTER TABLE unidades
  ADD COLUMN IF NOT EXISTS apelidos text[] NOT NULL DEFAULT '{}';

-- 2) Metas de gente: indicador × unidade × ano × mês (valores em %, vindos do BI)
CREATE TABLE IF NOT EXISTS metas_gente (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador  text NOT NULL,           -- ex: DISP GENTE DU/EMP, DISP GENTE AL
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor      numeric(8,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (indicador, unidade, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_metas_gente_lookup ON metas_gente(unidade, ano, indicador);

ALTER TABLE metas_gente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_metas_gente"   ON metas_gente;
DROP POLICY IF EXISTS "unidade_metas_gente" ON metas_gente;

-- Admin/AMBEV: lê e escreve tudo
CREATE POLICY "admin_metas_gente" ON metas_gente
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

-- Usuário de unidade: só lê a própria
CREATE POLICY "unidade_metas_gente" ON metas_gente
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

DROP TRIGGER IF EXISTS metas_gente_updated_at ON metas_gente;
CREATE TRIGGER metas_gente_updated_at
  BEFORE UPDATE ON metas_gente FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Atualiza o cache de schema do PostgREST na hora
NOTIFY pgrst, 'reload schema';
