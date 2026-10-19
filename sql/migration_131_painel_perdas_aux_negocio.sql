-- Migration 131: negócio em painel_perdas_aux (Indisponibilidade/Devolução).
--
-- Unidades com 2 gerentes reais (Camaçari: CDL=Rota, CDR=Armazém) só
-- conseguiam gravar UMA linha por unidade/ano/mês/indicador — a coluna
-- NEGOCIO do arquivo era descartada no parser (migration_006: "sempre
-- CONS"). Na prática, subir o CDR depois do CDL sobrescrevia o CDL (mesma
-- chave unidade+ano+mes+indicador), e o gerente do Armazém via o resultado
-- do Rota (ou vice-versa) no SDG Gerentes, já que o filtro de negócio do
-- cabeçalho não tinha como separar os dois.
--
-- Dados já importados ficam com negocio='CONS' (default) — não dá pra saber
-- retroativamente se eram CDL ou CDR; precisam ser reimportados pra valer
-- por negócio. Novos uploads já gravam separado (parser agora lê a coluna
-- NEGOCIO via `negocioPorPrefixo`, mesma convenção CDL=ROTA/CDR=ARM usada
-- em outros importadores).
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE painel_perdas_aux ADD COLUMN IF NOT EXISTS negocio text NOT NULL DEFAULT 'CONS';

ALTER TABLE painel_perdas_aux DROP CONSTRAINT IF EXISTS painel_perdas_aux_unidade_ano_mes_indicador_key;
ALTER TABLE painel_perdas_aux ADD CONSTRAINT painel_perdas_aux_unidade_negocio_ano_mes_indicador_key
  UNIQUE (unidade, negocio, ano, mes, indicador);

NOTIFY pgrst, 'reload schema';
