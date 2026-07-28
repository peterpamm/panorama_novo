import { supabase } from '@/lib/supabase'
import type { PaginaChave } from '@/lib/permissoes'

export interface UsuarioComPermissoes {
  userId: string
  email: string
  paginas: Set<PaginaChave>
}

/**
 * Não dá pra listar `auth.users` sem a Admin API (service_role) — então a
 * lista de "usuários conhecidos" da matriz vem de quem já tem ao menos uma
 * linha em `permissoes_paginas` (todo mundo criado via `criarUsuario` entra
 * aqui, ver `admin-users-api.ts`). RLS restringe a leitura/escrita dessa
 * tabela ao dono (`auth_dono()`, migration_065).
 */
export async function listarPermissoesAgrupadas(): Promise<UsuarioComPermissoes[]> {
  const { data, error } = await supabase.from('permissoes_paginas').select('user_id, email, pagina').order('email')
  if (error) throw error

  const porUsuario = new Map<string, UsuarioComPermissoes>()
  for (const linha of data ?? []) {
    const atual = porUsuario.get(linha.user_id)
    if (atual) {
      atual.paginas.add(linha.pagina as PaginaChave)
    } else {
      porUsuario.set(linha.user_id, { userId: linha.user_id, email: linha.email, paginas: new Set([linha.pagina as PaginaChave]) })
    }
  }
  return Array.from(porUsuario.values())
}

export async function concederPagina(userId: string, email: string, pagina: PaginaChave): Promise<void> {
  const { error } = await supabase.from('permissoes_paginas').insert({ user_id: userId, email, pagina })
  if (error) throw error
}

export async function revogarPagina(userId: string, pagina: PaginaChave): Promise<void> {
  const { error } = await supabase.from('permissoes_paginas').delete().eq('user_id', userId).eq('pagina', pagina)
  if (error) throw error
}
