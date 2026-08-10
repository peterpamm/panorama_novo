-- Migration 089: corrige uma falha de segurança séria — a checagem de
-- permissão (role/unidade/dono) usava `user_metadata`, que é um campo que o
-- PRÓPRIO usuário logado consegue alterar sozinho (é a mesma API usada pra
-- trocar a própria senha em "Minha Conta"). Isso significa que hoje QUALQUER
-- login (mesmo o mais restrito, tipo uma unidade comum) consegue se
-- autopromover a admin ou até "dono" chamando a API padrão de login do
-- Supabase — sem senha de ninguém, sem invadir nada.
--
-- A correção: usar `app_metadata` em vez de `user_metadata` nas checagens.
-- `app_metadata` só pode ser alterado com a chave `service_role` (a Admin
-- API do Supabase) — o usuário logado nunca consegue escrever nela sozinho,
-- só o dono (via SQL Editor ou, futuramente, uma Edge Function).
--
-- Rodar no SQL Editor do Supabase.

-- ───────────────────────────────────────────────────────────
-- 1. Redefine as funções de checagem pra ler app_metadata
-- ───────────────────────────────────────────────────────────
-- Como toda política de RLS do projeto chama essas 3 funções (nunca lê o
-- JWT direto), redefini-las aqui já corrige TODAS as políticas de uma vez —
-- não precisa tocar em cada CREATE POLICY das outras 88 migrations.

CREATE OR REPLACE FUNCTION auth_role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.jwt()->'app_metadata'->>'role', '');
$$;

CREATE OR REPLACE FUNCTION auth_unidade() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.jwt()->'app_metadata'->>'unidade', '');
$$;

CREATE OR REPLACE FUNCTION auth_dono() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.jwt()->'app_metadata'->>'dono', 'false') = 'true';
$$;

-- ───────────────────────────────────────────────────────────
-- 2. Função de sincronização — copia user_metadata → app_metadata
-- ───────────────────────────────────────────────────────────
-- O app não tem servidor (é só HTML/JS estático), então criar um usuário
-- novo (Administração > Usuários) só consegue gravar em `user_metadata`
-- (a API de criação de conta do navegador, `signUp`, nunca escreve em
-- `app_metadata` — isso é proposital do Supabase). Por isso, depois de criar
-- usuário(s) novo(s), é preciso rodar esta função UMA VEZ no SQL Editor pra
-- ativar o acesso de verdade deles. É segura de rodar quantas vezes quiser
-- (idempotente) — só resincroniza todo mundo, não apaga nada.
CREATE OR REPLACE FUNCTION sync_auth_app_metadata() RETURNS void LANGUAGE sql AS $$
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_strip_nulls(jsonb_build_object(
    'role',       raw_user_meta_data->>'role',
    'unidade',    raw_user_meta_data->>'unidade',
    'dono',       (raw_user_meta_data->>'dono')::boolean,
    'rv_negocio', raw_user_meta_data->>'rv_negocio'
  ))
  WHERE raw_user_meta_data ? 'role' OR raw_user_meta_data ? 'dono';
$$;

-- Roda agora pra migrar todo mundo que já existe hoje (preserva quem já
-- tinha `dono`/`role`/`unidade` — não muda quem tem acesso a quê, só muda
-- ONDE esse dado fica guardado).
SELECT sync_auth_app_metadata();

-- ───────────────────────────────────────────────────────────
-- Sempre que criar usuário(s) novo(s) pela tela Administração > Usuários,
-- rode isto de novo no SQL Editor pra ativar o acesso deles:
--
--   SELECT sync_auth_app_metadata();
--
-- ───────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
