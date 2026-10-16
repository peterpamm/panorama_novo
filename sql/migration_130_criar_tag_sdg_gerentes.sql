-- Migration 130: function pra criar tag "SDG Gerentes · X" sob demanda.
--
-- `PlanoAcaoFormDialog.tsx` (resolverTagFinal) cria a tag do indicador SDG
-- Gerentes na hora, na primeira vez que alguém usa aquele indicador — só que
-- isso é um INSERT direto em `planos_acao_tags`, cuja RLS (migration_084)
-- restringe escrita a admin ("admin_planos_acao_tags"). Criar ação já é
-- liberado a qualquer usuário (migration_091), então um usuário de unidade
-- tentando usar um indicador "SDG Gerentes" ainda sem tag caía em "new row
-- violates row-level security policy for table planos_acao_tags".
--
-- Em vez de abrir a RLS da tabela pra qualquer authenticated (deixaria
-- qualquer usuário criar/adulterar tags fora do fluxo "SDG Gerentes"), essa
-- function SECURITY DEFINER só cria exatamente esse tipo de tag, com os
-- mesmos valores fixos que o client já usava (ativo=true, ordem=0) — mesmo
-- padrão de `registrar_status_plano_acao` (migration_091). Idempotente: se
-- outro usuário criou a tag daquele indicador entre o SELECT do client e
-- esse INSERT, retorna a já existente em vez de duplicar/erro.
--
-- Rodar no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION criar_tag_sdg_gerentes(p_indicador text, p_nome text)
RETURNS planos_acao_tags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag planos_acao_tags;
BEGIN
  IF p_indicador NOT LIKE 'gerentes-%' THEN
    RAISE EXCEPTION 'Indicador inválido: %', p_indicador;
  END IF;

  SELECT * INTO v_tag FROM planos_acao_tags WHERE sdg_indicador = p_indicador LIMIT 1;
  IF FOUND THEN
    RETURN v_tag;
  END IF;

  INSERT INTO planos_acao_tags (nome, ativo, ordem, sdg_indicador)
  VALUES (btrim(p_nome), true, 0, p_indicador)
  ON CONFLICT (nome) DO NOTHING
  RETURNING * INTO v_tag;

  IF v_tag.id IS NULL THEN
    SELECT * INTO v_tag FROM planos_acao_tags WHERE nome = btrim(p_nome);
  END IF;

  RETURN v_tag;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_tag_sdg_gerentes(text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
