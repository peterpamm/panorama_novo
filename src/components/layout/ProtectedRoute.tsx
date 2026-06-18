import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  adminOnly?: boolean
}

export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { session, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (adminOnly && role !== 'admin') return <Navigate to="/" replace />

  return <>{children}</>
}
