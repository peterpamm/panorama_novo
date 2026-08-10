-- ============================================================
-- MIGRAÇÃO 077 — Ranking Ambev por negócio (Camaçari Rota ≠ Armazém)
--
-- Corrige resumo_geral_ranking_ambev: além de ter uma colocação
-- independente por setor (Gente/Frota/Segurança), Camaçari tem colocações
-- DIFERENTES pro CDL (Rota, T2) e pro CDR (Armazém, T1) — precisa de uma
-- coluna `negocio` (igual ao resto da Reunião Resultados: 'CONS' pra
-- unidade sem split, 'ROTA'/'ARM' só pra Camaçari).
--
-- A versão anterior da 076 já foi rodada sem a coluna `setor` (por isso o
-- erro "Could not find the 'setor' column") — como nenhuma linha chegou a
-- salvar de verdade (todo INSERT/UPSERT com `setor` falhava), recria a
-- tabela do zero na forma final, sem tentar preservar/migrar dado nenhum.
--
-- COMO RODAR: cole no SQL Editor do Supabase e execute tudo de uma vez.
-- ============================================================

DROP TABLE IF EXISTS resumo_geral_ranking_ambev CASCADE;

CREATE TABLE resumo_geral_ranking_ambev (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade  text NOT NULL REFERENCES unidades(codigo),
  negocio  text NOT NULL DEFAULT 'CONS',
  ano      int  NOT NULL,
  mes      int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  setor    text NOT NULL CHECK (setor IN ('gente', 'frota', 'seguranca')),
  posicao  int  NOT NULL CHECK (posicao > 0),
  UNIQUE (unidade, negocio, ano, mes, setor)
);

ALTER TABLE resumo_geral_ranking_ambev ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_resumo_geral_ranking_ambev" ON resumo_geral_ranking_ambev
  FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

NOTIFY pgrst, 'reload schema';
