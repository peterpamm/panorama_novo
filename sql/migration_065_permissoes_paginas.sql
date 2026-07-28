-- Migration 065: matriz de permissões por página + nível "dono" de verdade.
--
-- Hoje o app só tem `role` = admin (vê tudo) ou unidade (só a própria). Não
-- dá pra liberar "admin" (visão sem filtro de unidade) pra várias pessoas
-- (uma por setor: Gente, Financeiro, Frota, Segurança) sem também dar acesso
-- a TUDO que é admin — inclusive a tela de Administração, que deve ficar
-- exclusiva de quem realmente é dono do sistema.
--
-- Solução: um flag `dono` no JWT (item 1) — ortogonal ao `role`, não um
-- terceiro valor dele — e uma tabela de permissões por página (item 2), que
-- cada admin sem o flag `dono` só enxerga se alguém (o dono) conceder.
-- Rodar no SQL Editor do Supabase.

-- ───────────────────────────────────────────────────────────
-- 1. Flag "dono" — ortogonal ao role, só pra Administração e afins
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth_dono() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.jwt()->'user_metadata'->>'dono', 'false') = 'true';
$$;

-- unidades: só a ESCRITA (insert/update/delete) passa a exigir dono — a
-- leitura continua aberta a todo mundo via "read_unidades" (inalterada).
DROP POLICY IF EXISTS "admin_unidades" ON unidades;
CREATE POLICY "admin_unidades" ON unidades
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' AND auth_dono())
  WITH CHECK (auth_role() = 'admin' AND auth_dono());

-- orcamentos: separa leitura (continua ampla — FarolDeMetasPage/RankingPage
-- leem pra qualquer admin/unidade) de escrita (só dono, é o que a tela de
-- Administração > Orçamento faz).
DROP POLICY IF EXISTS "admin_orcamentos" ON orcamentos;
CREATE POLICY "leitura_orcamentos" ON orcamentos
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin' OR auth_unidade() = 'AMBEV');

CREATE POLICY "dono_insere_orcamentos" ON orcamentos
  FOR INSERT TO authenticated
  WITH CHECK (auth_dono());

CREATE POLICY "dono_atualiza_orcamentos" ON orcamentos
  FOR UPDATE TO authenticated
  USING (auth_dono())
  WITH CHECK (auth_dono());

CREATE POLICY "dono_exclui_orcamentos" ON orcamentos
  FOR DELETE TO authenticated
  USING (auth_dono());

-- Concede o flag pro dono da conta — única instrução que toca metadata do
-- Supabase Auth nessa migration, e só a PRÓPRIA conta do quem já roda estas
-- migrations no SQL Editor (ajuste o e-mail abaixo se necessário).
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('dono', true)
WHERE email = 'corpcustoslog20@gmail.com';

-- ───────────────────────────────────────────────────────────
-- 2. Matriz de permissões por página
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS permissoes_paginas (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  pagina     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pagina)
);

CREATE INDEX IF NOT EXISTS idx_permissoes_paginas_user ON permissoes_paginas(user_id);

ALTER TABLE permissoes_paginas ENABLE ROW LEVEL SECURITY;

-- Só o dono concede/revoga página de alguém (gestão da matriz).
DROP POLICY IF EXISTS "dono_gerencia_permissoes_paginas" ON permissoes_paginas;
CREATE POLICY "dono_gerencia_permissoes_paginas" ON permissoes_paginas
  FOR ALL TO authenticated
  USING (auth_dono())
  WITH CHECK (auth_dono());

-- Cada usuário lê as próprias linhas — é assim que o client monta o próprio
-- menu/rotas, sem precisar de mais nenhuma chamada.
DROP POLICY IF EXISTS "leitura_propria_permissoes_paginas" ON permissoes_paginas;
CREATE POLICY "leitura_propria_permissoes_paginas" ON permissoes_paginas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Backfill: preserva o acesso de quem já existe hoje, pra não travar
-- ninguém no primeiro deploy — o dono desmarca manualmente o que quiser
-- restringir depois, na Administração > Usuários.
--   - unidade: só ganha rv_painel_geral (é a restrição pedida — hoje uma
--     unidade acessa qualquer subpágina de RV livremente).
--   - admin (inclusive o próprio dono, sem problema — redundante mas
--     inofensivo): ganha todas as páginas restritas, igual ao acesso
--     irrestrito que já tinha.
INSERT INTO permissoes_paginas (user_id, email, pagina)
SELECT u.id, u.email, 'rv_painel_geral'
FROM auth.users u
WHERE u.raw_user_meta_data->>'role' = 'unidade'
ON CONFLICT DO NOTHING;

INSERT INTO permissoes_paginas (user_id, email, pagina)
SELECT u.id, u.email, pg.pagina
FROM auth.users u
CROSS JOIN (VALUES
  ('importacao'),
  ('metas_gerais'), ('metas_perdas'), ('metas_gente'), ('metas_financeiro'),
  ('metas_frota'), ('metas_seguranca'), ('metas_distribuicao'), ('metas_armazem'),
  ('rv_gente'), ('rv_financeiro'), ('rv_frota'), ('rv_seguranca'),
  ('rv_distribuicao'), ('rv_armazem'), ('rv_painel_geral')
) AS pg(pagina)
WHERE u.raw_user_meta_data->>'role' = 'admin'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
