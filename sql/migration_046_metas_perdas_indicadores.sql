-- Migration 046: meta anual (R$) por indicador da Meta de Perdas — upgrade
-- do metas_perdas (que só guardava o total): agora cada indicador que
-- compõe o total (Devolução, Indisponibilidade, Vales, Multas, Processos
-- Trabalhistas, Desconto CIVF, Sinistro de Frota, BNS — mesma lista de
-- INDICADORES_PERDAS em painel-perdas-calculations.ts) tem sua própria meta,
-- importada da planilha "ACUMULADO". metas_perdas continua intacta — meta_anual
-- e meta_pct dela vêm das linhas TOTAL e "Perdas (sem OC) Acumulado" da mesma
-- planilha, e continuam a base do cálculo mensal existente.
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS metas_perdas_indicadores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade     text NOT NULL REFERENCES unidades(codigo),
  ano         int  NOT NULL,
  indicador   text NOT NULL CHECK (indicador IN ('indisponibilidade', 'devolucao', 'vales', 'multas', 'proc_trab', 'civif', 'sinistro_frota', 'bns')),
  meta_anual  numeric(14,2) NOT NULL DEFAULT 0, -- máximo a perder no ano (R$, negativo) — 0 = sem meta pra perder
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, indicador)
);

CREATE INDEX IF NOT EXISTS idx_metas_perdas_indicadores_lookup ON metas_perdas_indicadores(unidade, ano);

ALTER TABLE metas_perdas_indicadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_metas_perdas_indicadores"   ON metas_perdas_indicadores;
DROP POLICY IF EXISTS "unidade_metas_perdas_indicadores" ON metas_perdas_indicadores;

-- Mesma regra da metas_perdas: admin (ou usuário da própria AMBEV) lê/escreve
-- tudo; usuário de unidade só lê a própria + a AMBEV.
CREATE POLICY "admin_metas_perdas_indicadores" ON metas_perdas_indicadores
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "unidade_metas_perdas_indicadores" ON metas_perdas_indicadores
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade IN (auth_unidade(), 'AMBEV'));

DROP TRIGGER IF EXISTS metas_perdas_indicadores_updated_at ON metas_perdas_indicadores;
CREATE TRIGGER metas_perdas_indicadores_updated_at
  BEFORE UPDATE ON metas_perdas_indicadores FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
