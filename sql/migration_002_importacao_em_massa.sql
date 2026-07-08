-- ============================================================
-- MIGRAÇÃO 002 — suporte à importação em massa da DRE:
--   1. coluna nome_ginfo em unidades (alias do nome completo que
--      vem no arquivo do GInfo, ex: "FOZ_DO_IGUACU"), pra
--      reconhecimento automático nas próximas importações.
--   2. tabela importacoes_alteracoes — log das alterações
--      retroativas detectadas (mês já encerrado com valor
--      diferente do que já estava importado).
--   3. função renomear_unidade_codigo — troca o código de uma
--      unidade já cadastrada (ex: FOZ -> FOZ_DO_IGUACU), arrastando
--      as linhas de dre_lancamentos/metas que já referenciam o
--      código antigo (não há ON UPDATE CASCADE nas FKs).
--
-- Rode isso no SQL Editor do Supabase. Não precisa rodar se está
-- criando o banco do zero depois desta mudança — schema.sql já
-- viria com isso (mas hoje ainda não vem, então rode sempre).
-- ============================================================

ALTER TABLE unidades
  ADD COLUMN IF NOT EXISTS nome_ginfo text UNIQUE;

CREATE TABLE IF NOT EXISTS importacoes_alteracoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid REFERENCES importacoes(id) ON DELETE CASCADE,
  unidade       text NOT NULL,
  negocio       text NOT NULL,
  ano           int  NOT NULL,
  conta_codigo  text NOT NULL,
  campo         text NOT NULL, -- ex: 'jan_realizado'
  valor_antigo  numeric(16,2),
  valor_novo    numeric(16,2),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE importacoes_alteracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_importacoes_alteracoes" ON importacoes_alteracoes;
CREATE POLICY "admin_importacoes_alteracoes" ON importacoes_alteracoes
  FOR ALL TO authenticated USING (auth_role() = 'admin');

-- Troca o código de uma unidade já cadastrada de forma atômica:
-- cria uma linha nova com o código novo (mantendo nome/nome_ginfo),
-- reatribui as linhas filhas pro código novo, e só então remove a
-- linha antiga. IMPORTANTE: isso não atualiza o metadata de login
-- de usuários já vinculados ao código antigo (raw_user_meta_data
-- ->> 'unidade') — se existir usuário assim, atualize manualmente
-- depois (mesmo processo de UPDATE auth.users já documentado em
-- schema.sql), senão esse usuário perde acesso à própria unidade.
CREATE OR REPLACE FUNCTION renomear_unidade_codigo(p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO unidades (nome, codigo, nome_ginfo)
  SELECT nome, p_novo, nome_ginfo FROM unidades WHERE codigo = p_antigo;

  UPDATE dre_lancamentos SET unidade = p_novo WHERE unidade = p_antigo;
  UPDATE metas           SET unidade = p_novo WHERE unidade = p_antigo;

  DELETE FROM unidades WHERE codigo = p_antigo;
END;
$$;
