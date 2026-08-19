-- Migration 102: usuário de unidade passa a enxergar a PRÓPRIA pontuação da
-- Reunião Resultados (aba "Detalhes da Unidade" do Resumo Geral).
--
-- O bug: liberar a página `reuniao_resumo_geral` pro gerente em
-- Administração > Usuários só destrava a tela — as tabelas continuavam
-- admin-only desde a migration 066 ("ferramenta interna do financeiro"),
-- então toda consulta voltava vazia e a aba abria sem dado nenhum, sem erro.
-- Quem é admin/dono não via problema, porque a policy antiga já valia pra
-- ele.
--
-- O que muda: cada tabela ganha uma policy de SELECT pra quem é 'unidade',
-- restrita às linhas da própria unidade (`auth_unidade()`). Escrita continua
-- só admin — as policies FOR ALL da 066/076 seguem intactas, e policy no
-- Postgres é permissiva (soma), não substitui.
--
-- Por que NÃO liberar tudo pra todo mundo (USING (true), como em rotinas):
-- a colocação no ranking é surpresa até a reunião mensal. Com leitura ampla,
-- bastaria olhar a API pra saber a pontuação das outras unidades antes da
-- hora — a tela esconde o card de Colocação, mas o dado vazaria assim mesmo.
--
-- O catálogo de indicadores é a exceção: não tem coluna de unidade (é a
-- regra do jogo — nome, meta, pontos), e o gerente precisa dele pra entender
-- a própria pontuação.
--
-- Rodar no SQL Editor do Supabase.

-- 1. Catálogo de indicadores — leitura pra qualquer usuário logado.
DROP POLICY IF EXISTS "leitura_reuniao_indicadores" ON reuniao_resultados_indicadores;
CREATE POLICY "leitura_reuniao_indicadores" ON reuniao_resultados_indicadores
  FOR SELECT TO authenticated
  USING (true);

-- 2. Participantes, resultados mensais e os dois do Resumo Geral — só as
--    linhas da própria unidade.
DROP POLICY IF EXISTS "unidade_reuniao_participantes" ON reuniao_resultados_participantes;
CREATE POLICY "unidade_reuniao_participantes" ON reuniao_resultados_participantes
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

DROP POLICY IF EXISTS "unidade_reuniao_mensais" ON reuniao_resultados_mensais;
CREATE POLICY "unidade_reuniao_mensais" ON reuniao_resultados_mensais
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

DROP POLICY IF EXISTS "unidade_resumo_geral_ranking_ambev" ON resumo_geral_ranking_ambev;
CREATE POLICY "unidade_resumo_geral_ranking_ambev" ON resumo_geral_ranking_ambev
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

DROP POLICY IF EXISTS "unidade_resumo_geral_historico" ON resumo_geral_historico;
CREATE POLICY "unidade_resumo_geral_historico" ON resumo_geral_historico
  FOR SELECT TO authenticated
  USING (auth_role() = 'unidade' AND unidade = auth_unidade());

NOTIFY pgrst, 'reload schema';
