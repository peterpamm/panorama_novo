-- Migration 072: limpeza de dados — participantes/resultados de Camaçari com
-- negocio='CONS' em setores diferentes de Financeiro. Esses registros foram
-- cadastrados ANTES da migration_071 (quando Camaçari ainda era 1
-- participante só, não split ROTA/ARMAZÉM) e ficaram órfãos: a tela de
-- Cadastro > Participantes não oferece mais um checkbox "Camaçari" puro fora
-- do Financeiro (só Rota/Armazém), então esse registro antigo não tem como
-- ser desmarcado pela UI — mas continua contando (e trazendo o AVR
-- consolidado no indicador automático), duplicando Camaçari 3x (Rota,
-- Armazém e o consolidado antigo). Rodar no SQL Editor do Supabase.
--
-- OBS: confirme que o código da unidade é mesmo 'CAMACARI' antes de rodar
-- (SELECT codigo, nome FROM unidades WHERE nome ILIKE '%camaçari%') — ajuste
-- abaixo se for diferente.

DELETE FROM reuniao_resultados_participantes p
USING reuniao_resultados_indicadores i
WHERE p.indicador_id = i.id
  AND i.setor <> 'financeiro'
  AND p.unidade = 'CAMACARI'
  AND p.negocio = 'CONS';

DELETE FROM reuniao_resultados_mensais m
USING reuniao_resultados_indicadores i
WHERE m.indicador_id = i.id
  AND i.setor <> 'financeiro'
  AND m.unidade = 'CAMACARI'
  AND m.negocio = 'CONS';

NOTIFY pgrst, 'reload schema';
