-- Migration 071: participante/resultado da Reunião Resultados por
-- unidade+negócio, não só unidade — Camaçari passa a valer como 2
-- lideranças/participantes distintos (ROTA e ARMAZÉM) nos setores que não
-- sejam Financeiro (que fica consolidado, negocio 'CONS' sempre, igual hoje).
-- DEFAULT 'CONS' preserva o comportamento atual sem precisar de backfill.
-- Rodar no SQL Editor do Supabase.

ALTER TABLE reuniao_resultados_participantes ADD COLUMN IF NOT EXISTS negocio text NOT NULL DEFAULT 'CONS';
ALTER TABLE reuniao_resultados_mensais       ADD COLUMN IF NOT EXISTS negocio text NOT NULL DEFAULT 'CONS';

ALTER TABLE reuniao_resultados_participantes DROP CONSTRAINT IF EXISTS reuniao_resultados_participantes_pkey;
ALTER TABLE reuniao_resultados_participantes ADD PRIMARY KEY (indicador_id, unidade, negocio);

ALTER TABLE reuniao_resultados_mensais DROP CONSTRAINT IF EXISTS reuniao_resultados_mensais_indicador_id_unidade_mes_key;
ALTER TABLE reuniao_resultados_mensais ADD CONSTRAINT reuniao_resultados_mensais_unico UNIQUE (indicador_id, unidade, negocio, mes);

NOTIFY pgrst, 'reload schema';
