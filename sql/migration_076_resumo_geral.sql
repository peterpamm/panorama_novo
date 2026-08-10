-- ============================================================
-- MIGRAÇÃO 076 — Resumo Geral e Ranking Corporativo
--
-- Consolida a pontuação dos 6 setores da Reunião Resultados por unidade,
-- soma bonificações extras (EBITDA batido + Ranking Ambev, lançado manual)
-- e define o vencedor do mês/ano. Módulo restrito a role='admin' — nenhuma
-- liderança acessa nenhuma tela dele.
--
-- resumo_geral_ranking_ambev: posição da unidade no Ranking Ambev — existem
-- 3 rankings Ambev independentes (Gente, Frota, Segurança), cada um com sua
-- própria colocação no mês (ex: 1º no de Gente, 3º no de Frota, sem posição
-- no de Segurança). Camaçari também varia por negócio — CDL (Rota) e CDR
-- (Armazém) têm colocações diferentes entre si, por isso a coluna `negocio`
-- (igual ao resto da Reunião Resultados: 'CONS' pra quem não separa). Bônus
-- computado em código por posição (1º=+50, 2º-5º=+30, resto=0) e somado os
-- 3 — não guardado aqui.
--
-- resumo_geral_historico: acumulado até um mês de corte (ex: até Junho),
-- importado de planilha — Unidade + uma coluna por setor (a coluna Total da
-- planilha é só informativa, recalculada em código) — a partir do mês
-- seguinte o cálculo ao vivo dos 6 setores retoma normalmente (ver
-- migration_079).
--
-- COMO RODAR: cole no SQL Editor do Supabase e execute tudo de uma vez.
-- ============================================================

CREATE TABLE IF NOT EXISTS resumo_geral_ranking_ambev (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade  text NOT NULL REFERENCES unidades(codigo),
  negocio  text NOT NULL DEFAULT 'CONS',
  ano      int  NOT NULL,
  mes      int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  setor    text NOT NULL CHECK (setor IN ('gente', 'frota', 'seguranca')),
  posicao  int  NOT NULL CHECK (posicao > 0),
  UNIQUE (unidade, negocio, ano, mes, setor)
);

CREATE TABLE IF NOT EXISTS resumo_geral_historico (
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

ALTER TABLE resumo_geral_ranking_ambev ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumo_geral_historico     ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão admin-only de reuniao_resultados_* (migration_066).
DROP POLICY IF EXISTS "admin_resumo_geral_ranking_ambev" ON resumo_geral_ranking_ambev;
CREATE POLICY "admin_resumo_geral_ranking_ambev" ON resumo_geral_ranking_ambev
  FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

DROP POLICY IF EXISTS "admin_resumo_geral_historico" ON resumo_geral_historico;
CREATE POLICY "admin_resumo_geral_historico" ON resumo_geral_historico
  FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

-- Página nova na matriz de permissões (migration_065) — backfill igual o de
-- lá, senão quem já é admin hoje ficaria sem essa página até o dono ir
-- liberar manualmente.
INSERT INTO permissoes_paginas (user_id, email, pagina)
SELECT u.id, u.email, 'reuniao_resumo_geral'
FROM auth.users u
WHERE u.raw_user_meta_data->>'role' = 'admin'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
