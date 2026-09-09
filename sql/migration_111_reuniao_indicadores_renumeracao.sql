-- Migration 111: corrige `reuniao_resultados_indicadores.fonte_chave` depois
-- do cutover da numeração nova do DRE (migration 110).
--
-- Indicadores de fonte 'farol_pacote' guardam o id do pacote (a chave de
-- `PACOTES`, ex: '157' = Despesa Administrativa) em `fonte_chave` — escolhido
-- num <select> na Cadastro de Indicadores da Reunião de Resultados. Esses ids
-- foram atualizados pra numeração nova em `src/lib/constants.ts` (migration
-- 110 já renomeou o mesmo id nas tabelas de peso/meta), mas os indicadores já
-- cadastrados na Reunião de Resultados ficaram apontando pro id ANTIGO —
-- `PACOTES['157']` não existe mais (agora é '158'), então
-- `valorFarolPacoteUnidadeMes` não acha nada e o indicador (ex: "Despesa ADM"
-- do Financeiro) fica sem resultado/meta.
--
-- `fonte_chave` é só uma coluna texto solta (sem PK/UNIQUE nela — a tabela é
-- chaveada por `id`), então não tem risco de violar constraint nenhuma. Mas
-- a ORDEM ainda importa: como as UPDATE rodam em sequência e várias cadeias
-- são adjacentes (ex: 157→158→159→160), teria que ser sempre da mais alta
-- pra mais baixa — senão uma linha que era '157' vira '158' na primeira
-- UPDATE e cai de novo na UPDATE seguinte (158→159), sendo deslocada duas
-- vezes por engano. Mesma ordem usada na migration 110.
--
-- Rodar no SQL Editor do Supabase. Idempotente (UPDATE é no-op se já tiver
-- sido aplicada, já que WHERE fonte_chave = '<antigo>' não acha mais nada
-- depois da primeira execução).

UPDATE reuniao_resultados_indicadores SET fonte_chave = '233' WHERE fonte = 'farol_pacote' AND fonte_chave = '232';
UPDATE reuniao_resultados_indicadores SET fonte_chave = '276' WHERE fonte = 'farol_pacote' AND fonte_chave = '275';
UPDATE reuniao_resultados_indicadores SET fonte_chave = '219' WHERE fonte = 'farol_pacote' AND fonte_chave = '218';
UPDATE reuniao_resultados_indicadores SET fonte_chave = '218' WHERE fonte = 'farol_pacote' AND fonte_chave = '217';
UPDATE reuniao_resultados_indicadores SET fonte_chave = '160' WHERE fonte = 'farol_pacote' AND fonte_chave = '159';
UPDATE reuniao_resultados_indicadores SET fonte_chave = '159' WHERE fonte = 'farol_pacote' AND fonte_chave = '158';
UPDATE reuniao_resultados_indicadores SET fonte_chave = '158' WHERE fonte = 'farol_pacote' AND fonte_chave = '157';
UPDATE reuniao_resultados_indicadores SET fonte_chave = '191' WHERE fonte = 'farol_pacote' AND fonte_chave = '190';
UPDATE reuniao_resultados_indicadores SET fonte_chave = '114' WHERE fonte = 'farol_pacote' AND fonte_chave = '113';
UPDATE reuniao_resultados_indicadores SET fonte_chave = '118' WHERE fonte = 'farol_pacote' AND fonte_chave = '117';
UPDATE reuniao_resultados_indicadores SET fonte_chave = '132' WHERE fonte = 'farol_pacote' AND fonte_chave = '131';
UPDATE reuniao_resultados_indicadores SET fonte_chave = '116' WHERE fonte = 'farol_pacote' AND fonte_chave = '115';
UPDATE reuniao_resultados_indicadores SET fonte_chave = '076' WHERE fonte = 'farol_pacote' AND fonte_chave = '075';
UPDATE reuniao_resultados_indicadores SET fonte_chave = '075' WHERE fonte = 'farol_pacote' AND fonte_chave = '074';
UPDATE reuniao_resultados_indicadores SET fonte_chave = '074' WHERE fonte = 'farol_pacote' AND fonte_chave = '073';

NOTIFY pgrst, 'reload schema';
