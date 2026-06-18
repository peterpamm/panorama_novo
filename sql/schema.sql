-- ============================================================
-- PANORAMA FINANCEIRO — SQL COMPLETO PARA O SUPABASE
-- Cole e execute no SQL Editor do Supabase (supabase.com/dashboard).
-- Depois rode sql/seed_contas.sql (gerado por scripts/gerar_seed_contas.py).
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- TABELAS DE DOMÍNIO
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS unidades (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome   text NOT NULL,
  codigo text NOT NULL UNIQUE   -- ex: 'FOZ', 'DIADEMA' — usado em user_metadata.unidade
);

CREATE TABLE IF NOT EXISTS negocios (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,  -- 'CONS', 'ROTA', 'ARM', 'EMP'
  nome   text NOT NULL
);

-- Plano de contas mestre (280 linhas, fixas, extraídas do layout GInfo)
CREATE TABLE IF NOT EXISTS contas (
  codigo     text PRIMARY KEY,         -- '001'..'282' (3 dígitos, zero-padded)
  descricao  text NOT NULL,
  ordem      int  NOT NULL,            -- ordem de exibição (linha original no Excel)
  nivel      int  NOT NULL DEFAULT 0,  -- nível hierárquico inferido pela indentação
  ativo      boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_contas_ordem ON contas(ordem);

-- ───────────────────────────────────────────────────────────
-- TABELA WIDE — DRE anual por unidade/negócio/conta
-- Reflete a estrutura do Excel de origem: 1 linha = 1 conta de 1
-- ano de 1 unidade/negócio, com colunas largas por mês + bloco TOTAL.
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dre_lancamentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade         text NOT NULL REFERENCES unidades(codigo),
  negocio         text NOT NULL REFERENCES negocios(codigo),
  ano             int  NOT NULL,
  conta_codigo    text NOT NULL REFERENCES contas(codigo),

  -- avo = meta mensal por conta, conforme exportada pelo próprio GInfo (distinta
  -- da meta por pacote da tabela `metas`, usada pelo Farol de Metas)
  jan_remunerado  numeric(16,2), jan_realizado numeric(16,2), jan_diferenca numeric(16,2), jan_avo numeric(8,2), jan_avr numeric(8,2),
  fev_remunerado  numeric(16,2), fev_realizado numeric(16,2), fev_diferenca numeric(16,2), fev_avo numeric(8,2), fev_avr numeric(8,2),
  mar_remunerado  numeric(16,2), mar_realizado numeric(16,2), mar_diferenca numeric(16,2), mar_avo numeric(8,2), mar_avr numeric(8,2),
  abr_remunerado  numeric(16,2), abr_realizado numeric(16,2), abr_diferenca numeric(16,2), abr_avo numeric(8,2), abr_avr numeric(8,2),
  mai_remunerado  numeric(16,2), mai_realizado numeric(16,2), mai_diferenca numeric(16,2), mai_avo numeric(8,2), mai_avr numeric(8,2),
  jun_remunerado  numeric(16,2), jun_realizado numeric(16,2), jun_diferenca numeric(16,2), jun_avo numeric(8,2), jun_avr numeric(8,2),
  jul_remunerado  numeric(16,2), jul_realizado numeric(16,2), jul_diferenca numeric(16,2), jul_avo numeric(8,2), jul_avr numeric(8,2),
  ago_remunerado  numeric(16,2), ago_realizado numeric(16,2), ago_diferenca numeric(16,2), ago_avo numeric(8,2), ago_avr numeric(8,2),
  set_remunerado  numeric(16,2), set_realizado numeric(16,2), set_diferenca numeric(16,2), set_avo numeric(8,2), set_avr numeric(8,2),
  out_remunerado  numeric(16,2), out_realizado numeric(16,2), out_diferenca numeric(16,2), out_avo numeric(8,2), out_avr numeric(8,2),
  nov_remunerado  numeric(16,2), nov_realizado numeric(16,2), nov_diferenca numeric(16,2), nov_avo numeric(8,2), nov_avr numeric(8,2),
  dez_remunerado  numeric(16,2), dez_realizado numeric(16,2), dez_diferenca numeric(16,2), dez_avo numeric(8,2), dez_avr numeric(8,2),

  -- Bloco TOTAL (acumulado até o último mês disponível no arquivo de origem)
  total_remunerado numeric(16,2), total_realizado numeric(16,2), total_diferenca numeric(16,2), total_avo numeric(8,2), total_avr numeric(8,2),

  importacao_id   uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (unidade, negocio, ano, conta_codigo)
);

CREATE INDEX IF NOT EXISTS idx_dre_lanc_unid_neg_ano ON dre_lancamentos(unidade, negocio, ano);
CREATE INDEX IF NOT EXISTS idx_dre_lanc_conta        ON dre_lancamentos(conta_codigo);

-- ───────────────────────────────────────────────────────────
-- METAS
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS metas (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade   text NOT NULL REFERENCES unidades(codigo),
  negocio   text NOT NULL REFERENCES negocios(codigo),
  ano       int  NOT NULL,
  codigo    text NOT NULL,             -- código do PACOTE (ex: '232'), não necessariamente em `contas`
  mes       int  NOT NULL DEFAULT 0,   -- 0 = meta anual; 1-12 = meta mensal (regime pós-2026)
  meta_avr  numeric(8,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, negocio, ano, codigo, mes)
);

CREATE INDEX IF NOT EXISTS idx_metas_lookup ON metas(unidade, negocio, ano, codigo, mes);

-- ───────────────────────────────────────────────────────────
-- IMPORTAÇÕES (auditoria de upload do DRE anual)
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS importacoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  arquivo_nome text NOT NULL,
  unidade      text NOT NULL,
  negocio      text NOT NULL,
  ano          int  NOT NULL,
  total_linhas int  NOT NULL DEFAULT 0,
  meses_no_arquivo int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dre_lancamentos
  DROP CONSTRAINT IF EXISTS fk_dre_lanc_importacao;
ALTER TABLE dre_lancamentos
  ADD CONSTRAINT fk_dre_lanc_importacao
  FOREIGN KEY (importacao_id) REFERENCES importacoes(id) ON DELETE SET NULL;

-- ───────────────────────────────────────────────────────────
-- TRIGGER updated_at
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS dre_lancamentos_updated_at ON dre_lancamentos;
CREATE TRIGGER dre_lancamentos_updated_at
  BEFORE UPDATE ON dre_lancamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS metas_updated_at ON metas;
CREATE TRIGGER metas_updated_at
  BEFORE UPDATE ON metas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ───────────────────────────────────────────────────────────
-- VIEW DE DESPIVOTAGEM (wide → long), equivalente ao
-- historico_dre.csv antigo. Gera 1 linha MENSAL por mês presente
-- (não-nulo) por conta, mais 1 linha ACUMULADO_ANO (a partir do
-- bloco TOTAL), ancorada no mês mais alto presente naquele
-- unidade/negócio/ano.
-- ───────────────────────────────────────────────────────────

DROP VIEW IF EXISTS vw_dre_longo;
CREATE VIEW vw_dre_longo AS
WITH meses AS (
  SELECT * FROM (VALUES
    (1,'jan'), (2,'fev'), (3,'mar'), (4,'abr'), (5,'mai'), (6,'jun'),
    (7,'jul'), (8,'ago'), (9,'set'), (10,'out'), (11,'nov'), (12,'dez')
  ) AS t(mes_num, prefixo)
),
mensal AS (
  SELECT
    d.unidade, d.negocio, d.ano, m.mes_num AS mes, 'MENSAL'::text AS tipo_periodo,
    d.conta_codigo,
    CASE m.prefixo
      WHEN 'jan' THEN d.jan_remunerado WHEN 'fev' THEN d.fev_remunerado WHEN 'mar' THEN d.mar_remunerado
      WHEN 'abr' THEN d.abr_remunerado WHEN 'mai' THEN d.mai_remunerado WHEN 'jun' THEN d.jun_remunerado
      WHEN 'jul' THEN d.jul_remunerado WHEN 'ago' THEN d.ago_remunerado WHEN 'set' THEN d.set_remunerado
      WHEN 'out' THEN d.out_remunerado WHEN 'nov' THEN d.nov_remunerado WHEN 'dez' THEN d.dez_remunerado
    END AS remunerado,
    CASE m.prefixo
      WHEN 'jan' THEN d.jan_realizado WHEN 'fev' THEN d.fev_realizado WHEN 'mar' THEN d.mar_realizado
      WHEN 'abr' THEN d.abr_realizado WHEN 'mai' THEN d.mai_realizado WHEN 'jun' THEN d.jun_realizado
      WHEN 'jul' THEN d.jul_realizado WHEN 'ago' THEN d.ago_realizado WHEN 'set' THEN d.set_realizado
      WHEN 'out' THEN d.out_realizado WHEN 'nov' THEN d.nov_realizado WHEN 'dez' THEN d.dez_realizado
    END AS realizado,
    CASE m.prefixo
      WHEN 'jan' THEN d.jan_diferenca WHEN 'fev' THEN d.fev_diferenca WHEN 'mar' THEN d.mar_diferenca
      WHEN 'abr' THEN d.abr_diferenca WHEN 'mai' THEN d.mai_diferenca WHEN 'jun' THEN d.jun_diferenca
      WHEN 'jul' THEN d.jul_diferenca WHEN 'ago' THEN d.ago_diferenca WHEN 'set' THEN d.set_diferenca
      WHEN 'out' THEN d.out_diferenca WHEN 'nov' THEN d.nov_diferenca WHEN 'dez' THEN d.dez_diferenca
    END AS diferenca,
    CASE m.prefixo
      WHEN 'jan' THEN d.jan_avo WHEN 'fev' THEN d.fev_avo WHEN 'mar' THEN d.mar_avo
      WHEN 'abr' THEN d.abr_avo WHEN 'mai' THEN d.mai_avo WHEN 'jun' THEN d.jun_avo
      WHEN 'jul' THEN d.jul_avo WHEN 'ago' THEN d.ago_avo WHEN 'set' THEN d.set_avo
      WHEN 'out' THEN d.out_avo WHEN 'nov' THEN d.nov_avo WHEN 'dez' THEN d.dez_avo
    END AS avo,
    CASE m.prefixo
      WHEN 'jan' THEN d.jan_avr WHEN 'fev' THEN d.fev_avr WHEN 'mar' THEN d.mar_avr
      WHEN 'abr' THEN d.abr_avr WHEN 'mai' THEN d.mai_avr WHEN 'jun' THEN d.jun_avr
      WHEN 'jul' THEN d.jul_avr WHEN 'ago' THEN d.ago_avr WHEN 'set' THEN d.set_avr
      WHEN 'out' THEN d.out_avr WHEN 'nov' THEN d.nov_avr WHEN 'dez' THEN d.dez_avr
    END AS avr
  FROM dre_lancamentos d
  CROSS JOIN meses m
),
mensal_existente AS (
  SELECT * FROM mensal
  WHERE remunerado IS NOT NULL OR realizado IS NOT NULL OR diferenca IS NOT NULL OR avo IS NOT NULL OR avr IS NOT NULL
),
ultimo_mes AS (
  SELECT unidade, negocio, ano, MAX(mes) AS mes_max
  FROM mensal_existente
  GROUP BY unidade, negocio, ano
),
acumulado AS (
  SELECT
    d.unidade, d.negocio, d.ano, u.mes_max AS mes, 'ACUMULADO_ANO'::text AS tipo_periodo,
    d.conta_codigo,
    d.total_remunerado AS remunerado,
    d.total_realizado  AS realizado,
    d.total_diferenca  AS diferenca,
    d.total_avo        AS avo,
    d.total_avr        AS avr
  FROM dre_lancamentos d
  JOIN ultimo_mes u
    ON u.unidade = d.unidade AND u.negocio = d.negocio AND u.ano = d.ano
)
SELECT unidade, negocio, ano, mes, tipo_periodo, conta_codigo, remunerado, realizado, diferenca, avo, avr
FROM mensal_existente
UNION ALL
SELECT unidade, negocio, ano, mes, tipo_periodo, conta_codigo, remunerado, realizado, diferenca, avo, avr
FROM acumulado;

-- ───────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────

ALTER TABLE dre_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE importacoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE negocios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas          ENABLE ROW LEVEL SECURITY;

-- Helpers para ler user_metadata do JWT (mesmo padrão do painel_multas)

CREATE OR REPLACE FUNCTION auth_role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.jwt()->'user_metadata'->>'role', '');
$$;

CREATE OR REPLACE FUNCTION auth_unidade() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.jwt()->'user_metadata'->>'unidade', '');
$$;

-- dre_lancamentos: admin (ou unidade=AMBEV) vê tudo; demais usuários só
-- veem a própria unidade + AMBEV (paridade com a regra do Python: usuário
-- comum tem acesso a ["AMBEV", username]).

DROP POLICY IF EXISTS "admin_dre"   ON dre_lancamentos;
DROP POLICY IF EXISTS "unidade_dre" ON dre_lancamentos;

CREATE POLICY "admin_dre" ON dre_lancamentos
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "unidade_dre" ON dre_lancamentos
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade IN (auth_unidade(), 'AMBEV'));

-- metas: mesma regra

DROP POLICY IF EXISTS "admin_metas"   ON metas;
DROP POLICY IF EXISTS "unidade_metas" ON metas;

CREATE POLICY "admin_metas" ON metas
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "unidade_metas" ON metas
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade IN (auth_unidade(), 'AMBEV'));

-- importacoes: admin only

DROP POLICY IF EXISTS "admin_importacoes" ON importacoes;
CREATE POLICY "admin_importacoes" ON importacoes
  FOR ALL TO authenticated USING (auth_role() = 'admin');

-- unidades / negocios / contas: leitura para todos autenticados, escrita só admin

DROP POLICY IF EXISTS "read_unidades" ON unidades;
DROP POLICY IF EXISTS "admin_unidades" ON unidades;
CREATE POLICY "read_unidades" ON unidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_unidades" ON unidades FOR ALL TO authenticated USING (auth_role() = 'admin');

DROP POLICY IF EXISTS "read_negocios" ON negocios;
DROP POLICY IF EXISTS "admin_negocios" ON negocios;
CREATE POLICY "read_negocios" ON negocios FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_negocios" ON negocios FOR ALL TO authenticated USING (auth_role() = 'admin');

DROP POLICY IF EXISTS "read_contas" ON contas;
DROP POLICY IF EXISTS "admin_contas" ON contas;
CREATE POLICY "read_contas" ON contas FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_contas" ON contas FOR ALL TO authenticated USING (auth_role() = 'admin');

-- A view vw_dre_longo herda a RLS de dre_lancamentos automaticamente
-- (view simples, sem SECURITY DEFINER) — validar com um usuário não-admin
-- antes de liberar a tela do Farol.

-- ───────────────────────────────────────────────────────────
-- SEED: unidades e negócios
-- ───────────────────────────────────────────────────────────

INSERT INTO negocios (codigo, nome) VALUES
  ('CONS', 'Consolidado'), ('ROTA', 'Rota'), ('ARM', 'Armazém'), ('EMP', 'Empurrada')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO unidades (nome, codigo) VALUES
  ('Foz',          'FOZ'),       ('Diadema',      'DIADEMA'),
  ('Cascavel',     'CASCAVEL'),  ('Londrina',     'LONDRINA'),
  ('Litoral',      'LITORAL'),   ('Rio',          'RIO'),
  ('Beltrão',      'BELTRAO'),   ('Ponta Grossa', 'PG'),
  ('Petrópolis',   'PETROPOLIS'),('Vidros',       'VIDROS'),
  ('Ambev',        'AMBEV')
ON CONFLICT (codigo) DO NOTHING;

-- O seed do plano de contas (280 linhas) está em sql/seed_contas.sql,
-- gerado por scripts/gerar_seed_contas.py — rodar depois deste arquivo.

-- ============================================================
-- CRIAR PRIMEIRO USUÁRIO ADMIN (mesmo fluxo do painel_multas)
-- Crie o usuário em Authentication > Users > Add user, copie o UUID,
-- e rode (trocando role/unidade conforme o caso):
-- ============================================================
/*
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role":"admin"}'::jsonb
WHERE id = 'SEU-UUID-AQUI';

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role":"unidade","unidade":"FOZ"}'::jsonb
WHERE id = 'SEU-UUID-AQUI';
*/
