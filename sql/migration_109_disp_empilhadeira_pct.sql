-- Migration 109: Disponibilidade Empilhadeira (RV de Frota T1, só CDR Bahia)
-- é % (não R$ como as migrations 107/108 assumiram) — informação errada que
-- veio no material original. Quanto MAIOR melhor.
--
-- rv_frota_disp_empilhadeira_meta: coluna `meta_valor` (R$) vira `meta_pct`
-- (%). resultados_disp_empilhadeira_frota não muda de estrutura (a coluna
-- `valor` já era genérica) — só o significado passa a ser %, não R$; reimporte
-- a planilha de Frota depois de rodar esta migration pra corrigir os valores
-- já importados (antes eram lidos como R$ puro, sem a conversão de fração do
-- Excel que os indicadores de % usam).
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE rv_frota_disp_empilhadeira_meta RENAME COLUMN meta_valor TO meta_pct;
ALTER TABLE rv_frota_disp_empilhadeira_meta ALTER COLUMN meta_pct TYPE numeric(5,2);

ALTER TABLE resultados_disp_empilhadeira_frota ALTER COLUMN valor TYPE numeric(5,2);

NOTIFY pgrst, 'reload schema';
