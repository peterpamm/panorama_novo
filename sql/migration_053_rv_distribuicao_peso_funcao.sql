-- Migration 053: peso por função das lideranças de Distribuição — COORD. DU
-- e SUPERVISOR DU passam a ter pesos próprios pra cada indicador (telas
-- Metas Coordenadores / Metas Supervisor DU), mas a META de cada indicador
-- continua única e compartilhada entre as duas funções — só o peso muda.
-- Substitui o peso único que hoje mora em rv_indisponibilidade_meta,
-- rv_distribuicao_pesos_dre (Pacote de Gente), rv_vales_distribuicao_meta,
-- rv_logon_du_meta, rv_devolucao_peso e rv_presenteismo_du_peso — o seed
-- abaixo copia o valor atual de cada um como ponto de partida (ajuste os
-- pesos depois na tela). LogOn DU e Pacote de Gente só valem pra COORD. DU;
-- Vales só vale pra SUPERVISOR DU — sem linha pra essas combinações de
-- propósito.
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rv_distribuicao_peso_funcao (
  funcao     text NOT NULL CHECK (funcao IN ('COORD. DU', 'SUPERVISOR DU')),
  indicador  text NOT NULL CHECK (indicador IN ('indisponibilidade', 'pacote_gente', 'vales', 'logon_du', 'devolucao', 'presenteismo_du')),
  peso       numeric(5,2) NOT NULL DEFAULT 0, -- em % (ex: 10 = 10%)
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (funcao, indicador)
);

ALTER TABLE rv_distribuicao_peso_funcao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rv_distribuicao_peso_funcao"   ON rv_distribuicao_peso_funcao;
DROP POLICY IF EXISTS "leitura_rv_distribuicao_peso_funcao" ON rv_distribuicao_peso_funcao;

CREATE POLICY "admin_rv_distribuicao_peso_funcao" ON rv_distribuicao_peso_funcao
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "leitura_rv_distribuicao_peso_funcao" ON rv_distribuicao_peso_funcao
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rv_distribuicao_peso_funcao_updated_at ON rv_distribuicao_peso_funcao;
CREATE TRIGGER rv_distribuicao_peso_funcao_updated_at
  BEFORE UPDATE ON rv_distribuicao_peso_funcao FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed: copia o peso único já cadastrado de cada indicador pras duas
-- funções (ponto de partida — ajuste os valores na tela depois).
INSERT INTO rv_distribuicao_peso_funcao (funcao, indicador, peso)
SELECT f.funcao, 'indisponibilidade', COALESCE((SELECT peso FROM rv_indisponibilidade_meta LIMIT 1), 0)
FROM (VALUES ('COORD. DU'), ('SUPERVISOR DU')) AS f(funcao)
ON CONFLICT (funcao, indicador) DO NOTHING;

-- Pacote de Gente só pra COORD. DU — sem linha pra SUPERVISOR DU de propósito.
INSERT INTO rv_distribuicao_peso_funcao (funcao, indicador, peso)
SELECT 'COORD. DU', 'pacote_gente', COALESCE((SELECT peso FROM rv_distribuicao_pesos_dre WHERE codigo = '158'), 0)
ON CONFLICT (funcao, indicador) DO NOTHING;

-- Vales só pra SUPERVISOR DU — sem linha pra COORD. DU de propósito.
INSERT INTO rv_distribuicao_peso_funcao (funcao, indicador, peso)
SELECT 'SUPERVISOR DU', 'vales', COALESCE((SELECT peso FROM rv_vales_distribuicao_meta LIMIT 1), 0)
ON CONFLICT (funcao, indicador) DO NOTHING;

-- LogOn DU só pra COORD. DU — sem linha pra SUPERVISOR DU de propósito.
INSERT INTO rv_distribuicao_peso_funcao (funcao, indicador, peso)
SELECT 'COORD. DU', 'logon_du', COALESCE((SELECT peso FROM rv_logon_du_meta LIMIT 1), 0)
ON CONFLICT (funcao, indicador) DO NOTHING;

INSERT INTO rv_distribuicao_peso_funcao (funcao, indicador, peso)
SELECT f.funcao, 'devolucao', COALESCE((SELECT peso FROM rv_devolucao_peso LIMIT 1), 0)
FROM (VALUES ('COORD. DU'), ('SUPERVISOR DU')) AS f(funcao)
ON CONFLICT (funcao, indicador) DO NOTHING;

INSERT INTO rv_distribuicao_peso_funcao (funcao, indicador, peso)
SELECT f.funcao, 'presenteismo_du', COALESCE((SELECT peso FROM rv_presenteismo_du_peso LIMIT 1), 0)
FROM (VALUES ('COORD. DU'), ('SUPERVISOR DU')) AS f(funcao)
ON CONFLICT (funcao, indicador) DO NOTHING;

-- Remove os pesos únicos antigos — a partir de agora só rv_distribuicao_peso_funcao.
ALTER TABLE rv_indisponibilidade_meta DROP COLUMN IF EXISTS peso;
ALTER TABLE rv_vales_distribuicao_meta DROP COLUMN IF EXISTS peso;
ALTER TABLE rv_logon_du_meta DROP COLUMN IF EXISTS peso;
DROP TABLE IF EXISTS rv_devolucao_peso;
DROP TABLE IF EXISTS rv_presenteismo_du_peso;
DROP TABLE IF EXISTS rv_distribuicao_pesos_dre;

NOTIFY pgrst, 'reload schema';
