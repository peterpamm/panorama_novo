import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { PaginaChave } from '@/lib/permissoes'

interface AuthContextValue {
  session: Session | null
  user: User | null
  role: 'admin' | 'unidade' | null
  unidade: string | null
  /** Flag ortogonal ao `role` — só o dono do sistema tem `true` (concedido via SQL, ver migration_065). */
  souDono: boolean
  /** `false` até a primeira busca de `permissoes_paginas` terminar — evita `ProtectedRoute` redirecionar cedo demais. */
  permissoesCarregadas: boolean
  podeAcessarPagina: (pagina: PaginaChave) => boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const user = session?.user ?? null
  const meta = user?.user_metadata ?? {}
  const role = (meta.role as 'admin' | 'unidade') ?? null
  const unidade = (meta.unidade as string) ?? null
  const souDono = meta.dono === true

  const [paginasPermitidas, setPaginasPermitidas] = useState<Set<PaginaChave>>(new Set())
  const [permissoesCarregadas, setPermissoesCarregadas] = useState(false)

  useEffect(() => {
    if (!user) {
      setPaginasPermitidas(new Set())
      setPermissoesCarregadas(true)
      return
    }
    let cancelado = false
    setPermissoesCarregadas(false)
    supabase
      .from('permissoes_paginas')
      .select('pagina')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (cancelado) return
        setPaginasPermitidas(new Set((data ?? []).map(r => r.pagina as PaginaChave)))
        setPermissoesCarregadas(true)
      })
    return () => { cancelado = true }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function podeAcessarPagina(pagina: PaginaChave): boolean {
    return souDono || paginasPermitidas.has(pagina)
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      session, user, role, unidade, souDono, permissoesCarregadas, podeAcessarPagina, loading, signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
