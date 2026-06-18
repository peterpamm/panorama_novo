-- ============================================================
-- MIGRAÇÃO 001 — adiciona as colunas de AVO (meta mensal por
-- conta, exportada pelo próprio GInfo) em dre_lancamentos, e
-- recria vw_dre_longo para expor o avo também no formato longo.
--
-- Rode isso no SQL Editor se você já tinha criado o schema antes
-- desta mudança (não precisa rodar se está criando o banco do
-- zero — sql/schema.sql já vem com essas colunas).
-- ============================================================

ALTER TABLE dre_lancamentos
  ADD COLUMN IF NOT EXISTS jan_avo numeric(8,2),
  ADD COLUMN IF NOT EXISTS fev_avo numeric(8,2),
  ADD COLUMN IF NOT EXISTS mar_avo numeric(8,2),
  ADD COLUMN IF NOT EXISTS abr_avo numeric(8,2),
  ADD COLUMN IF NOT EXISTS mai_avo numeric(8,2),
  ADD COLUMN IF NOT EXISTS jun_avo numeric(8,2),
  ADD COLUMN IF NOT EXISTS jul_avo numeric(8,2),
  ADD COLUMN IF NOT EXISTS ago_avo numeric(8,2),
  ADD COLUMN IF NOT EXISTS set_avo numeric(8,2),
  ADD COLUMN IF NOT EXISTS out_avo numeric(8,2),
  ADD COLUMN IF NOT EXISTS nov_avo numeric(8,2),
  ADD COLUMN IF NOT EXISTS dez_avo numeric(8,2),
  ADD COLUMN IF NOT EXISTS total_avo numeric(8,2);

-- Recria a view com a coluna avo (DROP+CREATE em vez de CREATE OR
-- REPLACE porque o Postgres não permite inserir uma coluna no meio
-- da lista de colunas de uma view existente via REPLACE).
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

-- IMPORTANTE: os dados que você já importou ANTES desta migração têm o
-- valor do AVO gravado por engano na coluna *_avr (o parser antigo lia a
-- 4ª coluna do bloco como AVR, mas a 4ª coluna na verdade é o AVO quando o
-- bloco tem 5 colunas). Reimporte os arquivos já carregados depois de
-- atualizar o app para corrigir isso.
