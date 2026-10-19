-- Migration 132: negócio em sdg_justificativas (Resumo Executivo do SDG
-- Gerentes, indicador 'assuntos-gerais-gerentes').
--
-- Unidades com 2 gerentes reais (Camaçari: CDL=Rota, CDR=Armazém; Ponta
-- Grossa: Empurrada/Armazém — Estância não entra aqui, é 1 gerente só pros
-- 2 negócios) tinham só UMA linha de Resumo Executivo por unidade/ano/mês,
-- compartilhada entre os dois gerentes — cada um sobrescrevia o texto do
-- outro. Agora cada negócio vira uma linha própria, mesmo padrão já usado
-- em painel_perdas_aux (migration_131).
--
-- Dados já gravados ficam com negocio='CONS' (default) — não dá pra saber
-- retroativamente se eram do CDL ou do CDR; quem escreveu por último "venceu"
-- e fica só nessa linha CONS. Os gerentes reescrevem cada um a partir de
-- agora, já separado.
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE sdg_justificativas ADD COLUMN IF NOT EXISTS negocio text NOT NULL DEFAULT 'CONS';

ALTER TABLE sdg_justificativas DROP CONSTRAINT IF EXISTS sdg_justificativas_unidade_ano_mes_indicador_key;
ALTER TABLE sdg_justificativas ADD CONSTRAINT sdg_justificativas_unidade_negocio_ano_mes_indicador_key
  UNIQUE (unidade, negocio, ano, mes, indicador);

NOTIFY pgrst, 'reload schema';
