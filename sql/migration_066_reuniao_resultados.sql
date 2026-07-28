-- Migration 066: Reunião Resultados — ranking de pontos por setor (começa só
-- com Financeiro). Mensalmente a LOG20 elege a melhor liderança de cada
-- setor por pontos (até 200), divididos entre indicadores próprios; cada
-- indicador tem sua meta e vale X pontos (tudo ou nada — bateu a meta ganha
-- os pontos cheios, não bateu ganha 0). Nem toda unidade concorre em todo
-- indicador, daí a tabela de participantes (many-to-many). Rodar no SQL
-- Editor do Supabase.

CREATE TABLE IF NOT EXISTS reuniao_resultados_indicadores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor      text NOT NULL,
  ano        int  NOT NULL,
  nome       text NOT NULL,
  meta       numeric(14,2) NOT NULL,
  formato    text NOT NULL CHECK (formato IN ('percentual', 'monetario', 'duracao', 'numero')),
  natureza   text NOT NULL CHECK (natureza IN ('custo', 'performance')),
  pontos     numeric(6,2) NOT NULL,
  ordem      int  NOT NULL DEFAULT 0,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reuniao_indicadores_setor_ano ON reuniao_resultados_indicadores(setor, ano);

CREATE TABLE IF NOT EXISTS reuniao_resultados_participantes (
  indicador_id uuid NOT NULL REFERENCES reuniao_resultados_indicadores(id) ON DELETE CASCADE,
  unidade      text NOT NULL REFERENCES unidades(codigo),
  PRIMARY KEY (indicador_id, unidade)
);

CREATE TABLE IF NOT EXISTS reuniao_resultados_mensais (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL REFERENCES reuniao_resultados_indicadores(id) ON DELETE CASCADE,
  unidade      text NOT NULL REFERENCES unidades(codigo),
  mes          int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  resultado    numeric(14,2),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (indicador_id, unidade, mes)
);

CREATE INDEX IF NOT EXISTS idx_reuniao_mensais_indicador ON reuniao_resultados_mensais(indicador_id);

ALTER TABLE reuniao_resultados_indicadores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reuniao_resultados_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reuniao_resultados_mensais       ENABLE ROW LEVEL SECURITY;

-- Ferramenta interna do time financeiro (não é dado de unidade) — mesmo
-- padrão admin-only de rotinas_financeiras (migration_024).
DROP POLICY IF EXISTS "admin_reuniao_indicadores" ON reuniao_resultados_indicadores;
CREATE POLICY "admin_reuniao_indicadores" ON reuniao_resultados_indicadores
  FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

DROP POLICY IF EXISTS "admin_reuniao_participantes" ON reuniao_resultados_participantes;
CREATE POLICY "admin_reuniao_participantes" ON reuniao_resultados_participantes
  FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

DROP POLICY IF EXISTS "admin_reuniao_mensais" ON reuniao_resultados_mensais;
CREATE POLICY "admin_reuniao_mensais" ON reuniao_resultados_mensais
  FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

DROP TRIGGER IF EXISTS trg_reuniao_indicadores_updated_at ON reuniao_resultados_indicadores;
CREATE TRIGGER trg_reuniao_indicadores_updated_at
  BEFORE UPDATE ON reuniao_resultados_indicadores FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_reuniao_mensais_updated_at ON reuniao_resultados_mensais;
CREATE TRIGGER trg_reuniao_mensais_updated_at
  BEFORE UPDATE ON reuniao_resultados_mensais FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Página nova na matriz de permissões (migration_065) — backfill igual o de
-- lá, senão quem já é admin hoje ficaria sem essa página até o dono ir
-- liberar manualmente.
INSERT INTO permissoes_paginas (user_id, email, pagina)
SELECT u.id, u.email, 'reuniao_financeiro'
FROM auth.users u
WHERE u.raw_user_meta_data->>'role' = 'admin'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
