-- ============================================================
-- MIGRAÇÃO 078 — Histórico do Resumo Geral vira acumulado até um mês de corte
--
-- A planilha real de histórico só tem 2 colunas (Unidade, Resultado) — um
-- acumulado até um mês (ex: até Junho), não um detalhamento mês a mês. A
-- partir do mês seguinte ao corte, o cálculo ao vivo dos 6 setores retoma
-- normalmente (Ranking Anual = acumulado importado + soma ao vivo dos meses
-- restantes do ano — nunca conta o mesmo mês duas vezes).
--
-- Substitui o desenho anterior (pontuacao_setores/pontos_extras/
-- pontuacao_final por mês) por um único valor por unidade+ano + o mês de
-- corte. Como só existiam dados de teste, recria do zero.
--
-- COMO RODAR: cole no SQL Editor do Supabase e execute tudo de uma vez.
-- ============================================================

DROP TABLE IF EXISTS resumo_geral_historico CASCADE;

CREATE TABLE resumo_geral_historico (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade              text NOT NULL REFERENCES unidades(codigo),
  ano                  int  NOT NULL,
  mes_final            int  NOT NULL CHECK (mes_final BETWEEN 1 AND 12),
  pontuacao_acumulada  numeric(8,2) NOT NULL,
  UNIQUE (unidade, ano)
);

ALTER TABLE resumo_geral_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_resumo_geral_historico" ON resumo_geral_historico
  FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

NOTIFY pgrst, 'reload schema';
