-- Migration 033: acerta os dados de resultados_logon depois do ajuste de
-- negócio:
-- 1. O código usava "ARMAZEM" como rótulo do negócio do prefixo CDR; agora
--    usa "ARM", igual ao padrão do DTO T1/T2 — renomeia o que já foi
--    importado com o rótulo antigo.
-- 2. Antes da migration_032, linhas já importadas (sem coluna negocio)
--    foram preenchidas com 'CONS' por padrão. Pra unidade/ano/mês que já
--    foram reimportados com o split certo (ROTA/ARM), a linha CONS antiga
--    ficou órfã (sobra do teste anterior) — remove ela.
-- Idempotente, pode rodar mais de uma vez. Rodar no SQL Editor do Supabase.

UPDATE resultados_logon SET negocio = 'ARM' WHERE negocio = 'ARMAZEM';

DELETE FROM resultados_logon rl
WHERE rl.negocio = 'CONS'
AND EXISTS (
  SELECT 1 FROM resultados_logon rl2
  WHERE rl2.unidade = rl.unidade AND rl2.ano = rl.ano AND rl2.mes = rl.mes AND rl2.negocio <> 'CONS'
);

NOTIFY pgrst, 'reload schema';
