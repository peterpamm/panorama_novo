-- ============================================================
-- MIGRAÇÃO 079 — Histórico do Resumo Geral por setor
--
-- A planilha real de histórico tem uma coluna por setor (Gente, Frota,
-- Segurança, Financeiro, Distribuição, Armazém) além de Filial — não um
-- total único. A coluna Total da planilha é só informativa (soma das 6),
-- recalculada em código, não guardada.
--
-- Continua "acumulado até um mês de corte" (ver migration_078) — só troca
-- o valor único por 6 valores, um por setor. Como só existiam dados de
-- teste, recria do zero.
--
-- COMO RODAR: cole no SQL Editor do Supabase e execute tudo de uma vez.
-- ============================================================

DROP TABLE IF EXISTS resumo_geral_historico CASCADE;

CREATE TABLE resumo_geral_historico (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade       text NOT NULL REFERENCES unidades(codigo),
  ano           int  NOT NULL,
  mes_final     int  NOT NULL CHECK (mes_final BETWEEN 1 AND 12),
  financeiro    numeric(8,2) NOT NULL DEFAULT 0,
  gente         numeric(8,2) NOT NULL DEFAULT 0,
  frota         numeric(8,2) NOT NULL DEFAULT 0,
  seguranca     numeric(8,2) NOT NULL DEFAULT 0,
  distribuicao  numeric(8,2) NOT NULL DEFAULT 0,
  armazem       numeric(8,2) NOT NULL DEFAULT 0,
  UNIQUE (unidade, ano)
);

ALTER TABLE resumo_geral_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_resumo_geral_historico" ON resumo_geral_historico
  FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

NOTIFY pgrst, 'reload schema';
