-- Migration 112: indicador combinado (nome/nome_t1, ex: "ON TIME"/"TMV") pode
-- ter FORMATOS diferentes entre as duas unidades de medida, não só rótulos
-- diferentes — ON TIME é % e TMV é duração (HH:MM:SS), mas até aqui só
-- existia um `formato` por indicador, então TMV (e Tempo de Rendição, e
-- qualquer outro par %/duração) era exibido com o formato de ON TIME (%),
-- virando um número sem sentido na tela. `formato_t1` é opcional — null
-- (padrão) continua usando `formato` pros dois lados, igual hoje, pra não
-- quebrar nenhum indicador combinado que já é % dos dois lados (ex: DEV
-- PDV/GTY).
--
-- Pra fonte 'importado', a planilha diz por LINHA se aquele resultado é do
-- lado nome ou nome_t1 (coluna Indicador) — então o formato efetivo também
-- precisa ficar gravado por linha em `reuniao_resultados_mensais`, não só no
-- indicador (a mesma unidade podia, em teoria, trocar de lado de um mês pro
-- outro). Rodar no SQL Editor do Supabase.

ALTER TABLE reuniao_resultados_indicadores ADD COLUMN IF NOT EXISTS formato_t1 text;
ALTER TABLE reuniao_resultados_indicadores
  DROP CONSTRAINT IF EXISTS reuniao_indicadores_formato_t1_check;
ALTER TABLE reuniao_resultados_indicadores
  ADD CONSTRAINT reuniao_indicadores_formato_t1_check
  CHECK (formato_t1 IS NULL OR formato_t1 IN ('percentual', 'monetario', 'duracao', 'numero'));

ALTER TABLE reuniao_resultados_mensais ADD COLUMN IF NOT EXISTS formato text;
ALTER TABLE reuniao_resultados_mensais
  DROP CONSTRAINT IF EXISTS reuniao_mensais_formato_check;
ALTER TABLE reuniao_resultados_mensais
  ADD CONSTRAINT reuniao_mensais_formato_check
  CHECK (formato IS NULL OR formato IN ('percentual', 'monetario', 'duracao', 'numero'));

NOTIFY pgrst, 'reload schema';
