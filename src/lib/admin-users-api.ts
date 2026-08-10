import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { PaginaChave } from '@/lib/permissoes'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Cria usuário direto do navegador via `signUp` — sem precisar da
 * service_role key nem de servidor nenhum (o Netlify do plano grátis não
 * libera variáveis de ambiente, que é onde essa chave precisaria ficar).
 *
 * Usa um client Supabase ISOLADO (sessão não persistida) só pra essa
 * chamada — se usasse o client global do app, o `signUp` trocaria a sessão
 * ativa do admin pela do usuário recém-criado no meio da tela.
 *
 * Só cria (login + `role`/`unidade` + páginas iniciais na matriz). Editar
 * acesso/senha ou excluir um usuário já existente exige a Admin API
 * (service_role) — sem lugar pra guardar essa chave com segurança, isso
 * continua sendo feito direto no dashboard do Supabase (Authentication >
 * Users). Editar QUAIS páginas ele acessa, isso sim dá pra fazer por aqui —
 * ver `permissoes-api.ts`.
 *
 * IMPORTANTE: `signUp` só consegue gravar em `user_metadata` (nunca em
 * `app_metadata` — só a Admin API/service_role escreve lá, é proposital do
 * Supabase). Desde a migration_089, é `app_metadata` que vale pra RLS e pro
 * `role`/`unidade`/`dono` no app — ou seja, o usuário criado aqui SÓ ganha
 * acesso de verdade depois de alguém rodar `SELECT sync_auth_app_metadata();`
 * no SQL Editor do Supabase (ver aviso na tela de Administração > Usuários).
 */
export async function criarUsuario(params: {
  email: string
  senha: string
  role: 'admin' | 'unidade'
  unidade?: string
  /** Restringe o Painel Geral da RV ao negócio da própria liderança (ROTA/ARM) — só pra unidades com 2 gerentes (ex: Camaçari). */
  rvNegocio?: string
  paginasIniciais: PaginaChave[]
}): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Configuração do Supabase ausente')

  const clienteIsolado = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const email = params.email.trim()
  const { data, error } = await clienteIsolado.auth.signUp({
    email,
    password: params.senha,
    options: {
      data: params.role === 'admin'
        ? { role: params.role }
        : { role: params.role, unidade: params.unidade, ...(params.rvNegocio ? { rv_negocio: params.rvNegocio } : {}) },
    },
  })
  if (error) throw error

  const novoId = data.user?.id
  if (novoId && params.paginasIniciais.length > 0) {
    const { error: erroPermissoes } = await supabase
      .from('permissoes_paginas')
      .insert(params.paginasIniciais.map(pagina => ({ user_id: novoId, email, pagina })))
    if (erroPermissoes) throw erroPermissoes
  }
}
