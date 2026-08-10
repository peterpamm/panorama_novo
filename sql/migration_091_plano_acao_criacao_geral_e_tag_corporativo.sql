-- Migration 091: dois ajustes no Plano de Ação (Área Financeira).
--
-- 1) Criar ação passa a ser liberado pra qualquer usuário logado, não só
--    admin — cada unidade só consegue criar pra ELA MESMA (unidade =
--    auth_unidade()); admin continua podendo criar pra qualquer unidade.
--    Editar/excluir uma ação já existente CONTINUA só admin (não mudou).
--
-- 2) Tag "Corporativo" — ações com essa tag só aparecem (e só podem ser
--    criadas/editadas/excluídas) pelo dono do sistema, mesmo que a pessoa
--    seja admin. É uma exceção estreita, só pra essa tag específica — o
--    resto do Plano de Ação continua com a regra de sempre. Pensado pra um
--    uso futuro (SDG Corp Fin, apresentação pra diretoria), mas a trava de
--    visibilidade já vale a partir de agora.
--
-- Rodar no SQL Editor do Supabase.

-- ───────────────────────────────────────────────────────────
-- 1. Tag "Corporativo" no catálogo
-- ───────────────────────────────────────────────────────────
INSERT INTO planos_acao_tags (nome, ativo, ordem, sdg_indicador) VALUES
  ('Corporativo', true, 11, NULL)
ON CONFLICT (nome) DO NOTHING;

-- ───────────────────────────────────────────────────────────
-- 2. RLS de planos_acao — leitura/escrita
-- ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "leitura_planos_acao" ON planos_acao;
CREATE POLICY "leitura_planos_acao" ON planos_acao
  FOR SELECT TO authenticated
  USING (
    (tag = 'Corporativo' AND auth_dono())
    OR (tag <> 'Corporativo' AND (auth_role() = 'admin' OR unidade = auth_unidade()))
  );

-- Criar: qualquer usuário logado, restrito à própria unidade (admin
-- continua sem restrição de unidade) — exceto tag "Corporativo", que só o
-- dono consegue criar (senão a pessoa cria e não consegue nem ver de novo).
DROP POLICY IF EXISTS "admin_insere_planos_acao" ON planos_acao;
CREATE POLICY "insere_planos_acao" ON planos_acao
  FOR INSERT TO authenticated
  WITH CHECK (
    (tag = 'Corporativo' AND auth_dono())
    OR (tag <> 'Corporativo' AND (auth_role() = 'admin' OR unidade = auth_unidade()))
  );

-- Editar/excluir direto a linha continua só admin — exceto tag
-- "Corporativo", que exige ser o dono (mesmo que a pessoa seja admin).
DROP POLICY IF EXISTS "admin_atualiza_planos_acao" ON planos_acao;
CREATE POLICY "admin_atualiza_planos_acao" ON planos_acao
  FOR UPDATE TO authenticated
  USING ((tag = 'Corporativo' AND auth_dono()) OR (tag <> 'Corporativo' AND auth_role() = 'admin'))
  WITH CHECK ((tag = 'Corporativo' AND auth_dono()) OR (tag <> 'Corporativo' AND auth_role() = 'admin'));

DROP POLICY IF EXISTS "admin_exclui_planos_acao" ON planos_acao;
CREATE POLICY "admin_exclui_planos_acao" ON planos_acao
  FOR DELETE TO authenticated
  USING ((tag = 'Corporativo' AND auth_dono()) OR (tag <> 'Corporativo' AND auth_role() = 'admin'));

-- ───────────────────────────────────────────────────────────
-- 3. registrar_status_plano_acao — mesma trava pro Follow (mudança de
--    status), que passa por essa function (SECURITY DEFINER, ignora as
--    policies acima) em vez de UPDATE direto.
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION registrar_status_plano_acao(
  p_plano_id    uuid,
  p_novo_status text,
  p_observacao  text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unidade      text;
  v_tag          text;
  v_status_atual text;
  v_role         text := auth_role();
  v_unidade_auth text := auth_unidade();
BEGIN
  IF p_observacao IS NULL OR btrim(p_observacao) = '' THEN
    RAISE EXCEPTION 'Observação é obrigatória';
  END IF;

  IF p_novo_status NOT IN ('pendente', 'em_andamento', 'concluido', 'validado') THEN
    RAISE EXCEPTION 'Status inválido: %', p_novo_status;
  END IF;

  SELECT unidade, tag, status INTO v_unidade, v_tag, v_status_atual
  FROM planos_acao WHERE id = p_plano_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ação não encontrada';
  END IF;

  IF v_tag = 'Corporativo' THEN
    IF NOT auth_dono() THEN
      RAISE EXCEPTION 'Sem permissão pra alterar essa ação';
    END IF;
  ELSIF v_role <> 'admin' AND v_unidade <> v_unidade_auth THEN
    RAISE EXCEPTION 'Sem permissão pra alterar essa ação';
  END IF;

  IF p_novo_status = 'validado' AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'Só o time financeiro pode validar uma ação';
  END IF;

  INSERT INTO planos_acao_historico
    (plano_id, status_anterior, status_novo, observacao, usuario_email, usuario_role, usuario_unidade)
  VALUES
    (p_plano_id, v_status_atual, p_novo_status, btrim(p_observacao), auth.jwt() ->> 'email', v_role, v_unidade_auth);

  UPDATE planos_acao SET status = p_novo_status, updated_at = now() WHERE id = p_plano_id;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_status_plano_acao(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
