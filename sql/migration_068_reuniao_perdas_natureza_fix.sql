-- Migration 068: corrige a natureza de indicadores da Reunião Resultados já
-- cadastrados com fonte='perdas' — foram gravados como 'custo', mas o valor
-- de um indicador de Painel de Perdas segue a convenção de sinal do DRE
-- (diferença = REAL − REMUNERADO: negativo é estouro, positivo é sobra), e
-- nessa convenção "menos negativo (ou positivo) é melhor" é sempre
-- performance, não custo — ver comentário em
-- src/lib/reuniao-resultados.ts (naturezaEFormatoAutomaticos). Rodar no SQL
-- Editor do Supabase.

UPDATE reuniao_resultados_indicadores
SET natureza = 'performance'
WHERE fonte = 'perdas' AND natureza <> 'performance';

NOTIFY pgrst, 'reload schema';
