import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { PaginaChave } from '@/lib/permissoes'

interface ProtectedRouteProps {
  children: React.ReactNode
  adminOnly?: boolean
  /** Exige que o usuário tenha essa página liberada em `permissoes_paginas` (ou seja dono). */
  pagina?: PaginaChave
  /** Exclusivo do dono do sistema (flag `dono`, não `role`) — ver AuthContext/migration_065. */
  donoApenas?: boolean
}

function Carregando() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-muted-foreground text-sm">Carregando...</div>
    </div>
  )
}

export function ProtectedRoute({ children, adminOnly = false, pagina, donoApenas = false }: ProtectedRouteProps) {
  const { session, role, souDono, permissoesCarregadas, podeAcessarPagina, loading } = useAuth()

  if (loading) return <Carregando />
  if (!session) return <Navigate to="/login" replace />
  if (donoApenas && !souDono) return <Navigate to="/" replace />
  if (adminOnly && role !== 'admin') return <Navigate to="/" replace />
  if (pagina) {
    if (!permissoesCarregadas) return <Carregando />
    if (!podeAcessarPagina(pagina)) return <Navigate to="/" replace />
  }

  return <>{children}</>
}
