-- Migration 049: resultado mensal dos indicadores da RV de Distribuição que
-- vêm do BI por planilha compartilhada (indicador nas linhas, uma planilha só
-- com vários indicadores empilhados — coluna INDICADOR filtra qual é qual):
-- LogOn DU (aderência), Devolução (PDV) e Presenteísmo DU. Um indicador só
-- pode não valer negócio-nenhum (CONS) ou abrir por ROTA/ARM (CDL/CDR),
-- igual ao LogOn de Segurança.
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS resultados_distribuicao_bi (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador  text NOT NULL CHECK (indicador IN ('aderencia_logon_du', 'devolucao_pdv', 'presenteismo_du')),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  negocio    text NOT NULL DEFAULT 'CONS',
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(8,4) NOT NULL, -- % (ex: 96 = 96%)
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (indicador, unidade, negocio, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_resultados_distribuicao_bi_lookup ON resultados_distribuicao_bi(indicador, unidade, ano, mes);

ALTER TABLE resultados_distribuicao_bi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_resultados_distribuicao_bi"   ON resultados_distribuicao_bi;
DROP POLICY IF EXISTS "leitura_resultados_distribuicao_bi" ON resultados_distribuicao_bi;

CREATE POLICY "admin_resultados_distribuicao_bi" ON resultados_distribuicao_bi
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_resultados_distribuicao_bi" ON resultados_distribuicao_bi
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS resultados_distribuicao_bi_updated_at ON resultados_distribuicao_bi;
CREATE TRIGGER resultados_distribuicao_bi_updated_at
  BEFORE UPDATE ON resultados_distribuicao_bi FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
