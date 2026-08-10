-- Migration 080: Encontro de Contas (Área Financeira) — controle dos
-- descontos (ECs) que a Ambev lança via chamado, com tratativa por unidade
-- e validação do financeiro. Mesmo desenho do Plano de Ação
-- (migration_063): status muda só via function (histórico com observação
-- obrigatória, nunca UPDATE direto), unidade nunca valida. Diferença nova
-- aqui: `validado_por_email` (Plano de Ação não tem isso) e uma segunda
-- function pra unidade editar só a própria justificativa (Motivo/ND/Unidade
-- são admin-only, então não precisam de function — só UPDATE direto do
-- admin). Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS encontro_contas_motivos (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome  text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS encontro_contas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data               date NOT NULL,
  descricao_original text NOT NULL,
  numero_chamado     text NOT NULL,
  solicitante        text NOT NULL,
  valor              numeric(12,2) NOT NULL,
  unidade            text REFERENCES unidades(codigo),
  tem_evidencia      boolean NOT NULL DEFAULT false,
  motivo             text,
  justificativa      text NOT NULL DEFAULT '',
  nota_debito        text NOT NULL DEFAULT 'N/A' CHECK (nota_debito IN ('OK', 'NOK', 'N/A')),
  status             text NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'validado')),
  validado_por_email text,
  criado_por_email   text,
  criado_por_role    text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encontro_contas_unidade ON encontro_contas(unidade);
CREATE INDEX IF NOT EXISTS idx_encontro_contas_status  ON encontro_contas(status);
CREATE INDEX IF NOT EXISTS idx_encontro_contas_chamado ON encontro_contas(numero_chamado);

CREATE TABLE IF NOT EXISTS encontro_contas_historico (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ec_id           uuid NOT NULL REFERENCES encontro_contas(id) ON DELETE CASCADE,
  status_anterior text NOT NULL,
  status_novo     text NOT NULL,
  observacao      text NOT NULL,
  usuario_email   text,
  usuario_role    text,
  usuario_unidade text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encontro_contas_hist_ec ON encontro_contas_historico(ec_id, created_at);

ALTER TABLE encontro_contas_motivos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE encontro_contas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE encontro_contas_historico ENABLE ROW LEVEL SECURITY;

-- Motivos: leitura pra todo autenticado (é um dropdown usado por unidade e
-- admin), escrita só admin — mesmo padrão de unidades/negocios/contas.
DROP POLICY IF EXISTS "leitura_encontro_contas_motivos" ON encontro_contas_motivos;
CREATE POLICY "leitura_encontro_contas_motivos" ON encontro_contas_motivos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_encontro_contas_motivos" ON encontro_contas_motivos;
CREATE POLICY "admin_encontro_contas_motivos" ON encontro_contas_motivos
  FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

DROP POLICY IF EXISTS "leitura_encontro_contas" ON encontro_contas;
CREATE POLICY "leitura_encontro_contas" ON encontro_contas
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin' OR unidade = auth_unidade());

DROP POLICY IF EXISTS "admin_insere_encontro_contas" ON encontro_contas;
CREATE POLICY "admin_insere_encontro_contas" ON encontro_contas
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'admin');

-- Só admin edita direto a linha (unidade/motivo/nota_debito/tem_evidencia,
-- e o valor/desmembrar). Justificativa da unidade e mudança de status são
-- sempre via function, nunca UPDATE direto — assim ficam sempre auditadas.
DROP POLICY IF EXISTS "admin_atualiza_encontro_contas" ON encontro_contas;
CREATE POLICY "admin_atualiza_encontro_contas" ON encontro_contas
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

DROP POLICY IF EXISTS "admin_exclui_encontro_contas" ON encontro_contas;
CREATE POLICY "admin_exclui_encontro_contas" ON encontro_contas
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin');

DROP TRIGGER IF EXISTS trg_encontro_contas_updated_at ON encontro_contas;
CREATE TRIGGER trg_encontro_contas_updated_at
  BEFORE UPDATE ON encontro_contas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP POLICY IF EXISTS "leitura_encontro_contas_historico" ON encontro_contas_historico;
CREATE POLICY "leitura_encontro_contas_historico" ON encontro_contas_historico
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'admin'
    OR ec_id IN (SELECT id FROM encontro_contas WHERE unidade = auth_unidade())
  );

-- Única porta de entrada pra mudar status — grava histórico e, se o novo
-- status for 'validado', também carimba validado_por_email (pra dar pra
-- filtrar "validados por mim" no Histórico — o Plano de Ação não tem esse
-- carimbo hoje). Observação só é obrigatória pra unidade — o admin muda
-- status o tempo todo só pra identificar/organizar unidades, sem
-- necessariamente ter uma observação por mudança.
CREATE OR REPLACE FUNCTION registrar_status_encontro_contas(
  p_ec_id       uuid,
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
  IF v_role <> 'admin' AND (p_observacao IS NULL OR btrim(p_observacao) = '') THEN
    RAISE EXCEPTION 'Observação é obrigatória';
  END IF;

  IF p_novo_status NOT IN ('pendente', 'em_andamento', 'concluido', 'validado') THEN
    RAISE EXCEPTION 'Status inválido: %', p_novo_status;
  END IF;

  SELECT unidade, status INTO v_unidade, v_status_atual
  FROM encontro_contas WHERE id = p_ec_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EC não encontrado';
  END IF;

  IF v_role <> 'admin' AND (v_unidade IS NULL OR v_unidade <> v_unidade_auth) THEN
    RAISE EXCEPTION 'Sem permissão pra alterar esse EC';
  END IF;

  IF p_novo_status = 'validado' AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'Só o financeiro pode validar um EC';
  END IF;

  INSERT INTO encontro_contas_historico
    (ec_id, status_anterior, status_novo, observacao, usuario_email, usuario_role, usuario_unidade)
  VALUES
    (p_ec_id, v_status_atual, p_novo_status, btrim(coalesce(p_observacao, '')), auth.jwt() ->> 'email', v_role, v_unidade_auth);

  UPDATE encontro_contas SET
    status = p_novo_status,
    validado_por_email = CASE WHEN p_novo_status = 'validado' THEN auth.jwt() ->> 'email' ELSE validado_por_email END,
    updated_at = now()
  WHERE id = p_ec_id;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_status_encontro_contas(uuid, text, text) TO authenticated;

-- Único jeito de uma unidade editar algo direto na linha: só a própria
-- justificativa, só de um EC já atribuído à própria unidade.
CREATE OR REPLACE FUNCTION atualizar_justificativa_encontro_contas(
  p_ec_id        uuid,
  p_justificativa text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unidade      text;
  v_role         text := auth_role();
  v_unidade_auth text := auth_unidade();
BEGIN
  SELECT unidade INTO v_unidade FROM encontro_contas WHERE id = p_ec_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EC não encontrado';
  END IF;

  IF v_role <> 'admin' AND (v_unidade IS NULL OR v_unidade <> v_unidade_auth) THEN
    RAISE EXCEPTION 'Sem permissão pra alterar esse EC';
  END IF;

  UPDATE encontro_contas SET justificativa = p_justificativa, updated_at = now() WHERE id = p_ec_id;
END;
$$;

GRANT EXECUTE ON FUNCTION atualizar_justificativa_encontro_contas(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
