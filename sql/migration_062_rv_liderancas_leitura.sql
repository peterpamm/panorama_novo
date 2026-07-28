-- Migration 062: permite leitura de rv_liderancas pra qualquer usuário
-- autenticado (admin ou unidade) — precisa pro Painel Geral da Remuneração
-- Variável, onde o gerente de uma unidade vê o acompanhamento e o valor a
-- receber das lideranças da própria unidade. Antes só admin/AMBEV liam essa
-- tabela; o filtro por unidade continua sendo feito no cliente (resolvendo
-- a coluna `operacao` pra unidade, igual a apuração já faz — a tabela não
-- tem uma coluna `unidade` direta pra dar pra escrever uma policy exata),
-- mesmo padrão de leitura aberta já usado nas tabelas de resultado/meta da
-- RV (resultados_gente, rv_gsd_meta etc). O cadastro (escrita) continua só
-- admin/AMBEV.
-- Rodar no SQL Editor do Supabase.

DROP POLICY IF EXISTS "leitura_rv_liderancas" ON rv_liderancas;

CREATE POLICY "leitura_rv_liderancas" ON rv_liderancas
  FOR SELECT TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
