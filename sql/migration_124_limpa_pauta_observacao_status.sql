-- Migration 124: Limpa Pauta — campo de observação geral do chamado (acima
-- do bloco de aprovações internas, pra lembrar do que se trata) e renomeia
-- o status "pendente" das aprovações (GOD/GEO/RPO) pra "em_analise" —
-- "pendente" ficava ambíguo depois que o "Status" da lista passou a
-- mostrar o status atual pela hierarquia de aprovação (RPO > GEO > GOD),
-- não mais o status cru do Freightech.
--
-- Ordem importa aqui: a CHECK constraint antiga (só aceita 'pendente'/'ok'/
-- 'nok') precisa sair ANTES do UPDATE que grava 'em_analise' — na primeira
-- versão isso estava invertido e o próprio UPDATE violava a constraint
-- antiga ainda ativa ("new row ... violates check constraint", erro de
-- UPDATE, não de validação do ALTER TABLE).

ALTER TABLE limpa_pauta
  ADD COLUMN IF NOT EXISTS observacao text NOT NULL DEFAULT '';

ALTER TABLE limpa_pauta DROP CONSTRAINT IF EXISTS limpa_pauta_status_god_check;
ALTER TABLE limpa_pauta DROP CONSTRAINT IF EXISTS limpa_pauta_status_geo_check;
ALTER TABLE limpa_pauta DROP CONSTRAINT IF EXISTS limpa_pauta_status_rpo_check;

UPDATE limpa_pauta SET status_god = 'em_analise' WHERE status_god = 'pendente';
UPDATE limpa_pauta SET status_geo = 'em_analise' WHERE status_geo = 'pendente';
UPDATE limpa_pauta SET status_rpo = 'em_analise' WHERE status_rpo = 'pendente';

ALTER TABLE limpa_pauta
  ALTER COLUMN status_god SET DEFAULT 'em_analise',
  ALTER COLUMN status_geo SET DEFAULT 'em_analise',
  ALTER COLUMN status_rpo SET DEFAULT 'em_analise';

ALTER TABLE limpa_pauta
  ADD CONSTRAINT limpa_pauta_status_god_check CHECK (status_god IN ('em_analise', 'ok', 'nok')),
  ADD CONSTRAINT limpa_pauta_status_geo_check CHECK (status_geo IN ('em_analise', 'ok', 'nok')),
  ADD CONSTRAINT limpa_pauta_status_rpo_check CHECK (status_rpo IN ('em_analise', 'ok', 'nok'));

NOTIFY pgrst, 'reload schema';
