-- Migration 063: Plano de Ação (Área Financeira) — cadastro de ações
-- atribuídas a uma unidade, com prazo/tag e fluxo de status (pendente →
-- em_andamento → concluido → validado). Toda mudança de status passa pela
-- function `registrar_status_plano_acao`, que grava o histórico (com
-- observação obrigatória) e só então atualiza o status — atômico, e é o
-- ÚNICO jeito de mudar o status (a tabela de histórico não tem policy de
-- INSERT direto, só a function, que roda como SECURITY DEFINER).
--
-- Cadastro (criar ação, editar título/descrição/prazo/tag/unidade, excluir)
-- é só admin. Cada unidade só enxerga e só muda o status das próprias ações
-- — nunca pode validar (mover pro histórico), isso é sempre admin. Rodar no
-- SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS planos_acao (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade          text NOT NULL REFERENCES unidades(codigo),
  titulo           text NOT NULL,
  descricao        text NOT NULL DEFAULT '',
  tag              text NOT NULL DEFAULT '',
  prazo            date NOT NULL,
  status           text NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'validado')),
  criado_por_email text,
  criado_por_role  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planos_acao_unidade ON planos_acao(unidade);
CREATE INDEX IF NOT EXISTS idx_planos_acao_status  ON planos_acao(status);

-- Histórico append-only: cada linha é uma mudança de status com observação
-- obrigatória e quem fez (email/role/unidade denormalizados — não existe
-- tabela de perfis nesse app, e o client não consegue ler auth.users).
CREATE TABLE IF NOT EXISTS planos_acao_historico (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id        uuid NOT NULL REFERENCES planos_acao(id) ON DELETE CASCADE,
  status_anterior text NOT NULL,
  status_novo     text NOT NULL,
  observacao      text NOT NULL,
  usuario_email   text,
  usuario_role    text,
  usuario_unidade text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planos_acao_hist_plano ON planos_acao_historico(plano_id, created_at);

ALTER TABLE planos_acao           ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos_acao_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_planos_acao" ON planos_acao;
CREATE POLICY "leitura_planos_acao" ON planos_acao
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin' OR unidade = auth_unidade());

DROP POLICY IF EXISTS "admin_insere_planos_acao" ON planos_acao;
CREATE POLICY "admin_insere_planos_acao" ON planos_acao
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'admin');

-- Só admin edita direto a linha (título/descrição/prazo/tag/unidade). Mudar
-- status é sempre via `registrar_status_plano_acao`, nunca por UPDATE direto
-- — assim toda mudança de status (inclusive as do próprio admin) fica
-- registrada no histórico com observação.
DROP POLICY IF EXISTS "admin_atualiza_planos_acao" ON planos_acao;
CREATE POLICY "admin_atualiza_planos_acao" ON planos_acao
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

DROP POLICY IF EXISTS "admin_exclui_planos_acao" ON planos_acao;
CREATE POLICY "admin_exclui_planos_acao" ON planos_acao
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin');

DROP TRIGGER IF EXISTS trg_planos_acao_updated_at ON planos_acao;
CREATE TRIGGER trg_planos_acao_updated_at
  BEFORE UPDATE ON planos_acao FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Histórico: só leitura (admin vê tudo, unidade só o histórico das próprias
-- ações). Sem policy de INSERT/UPDATE/DELETE — só a function abaixo escreve.
DROP POLICY IF EXISTS "leitura_planos_acao_historico" ON planos_acao_historico;
CREATE POLICY "leitura_planos_acao_historico" ON planos_acao_historico
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'admin'
    OR plano_id IN (SELECT id FROM planos_acao WHERE unidade = auth_unidade())
  );

-- Única porta de entrada pra mudar o status: grava o histórico (com
-- observação obrigatória) e só então atualiza `planos_acao.status`, os dois
-- na mesma transação. SECURITY DEFINER pra poder inserir no histórico (que
-- não tem policy de INSERT pra ninguém) — as checagens de permissão são
-- feitas manualmente aqui dentro, usando auth_role()/auth_unidade() (que
-- continuam refletindo o JWT de quem chamou, SECURITY DEFINER não muda
-- isso).
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

  SELECT unidade, status INTO v_unidade, v_status_atual
  FROM planos_acao WHERE id = p_plano_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ação não encontrada';
  END IF;

  IF v_role <> 'admin' AND v_unidade <> v_unidade_auth THEN
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
