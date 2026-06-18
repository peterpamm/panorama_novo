import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { FarolDeMetasPage } from '@/pages/FarolDeMetasPage'
import { MetasPage } from '@/pages/MetasPage'
import { ImportacaoDrePage } from '@/pages/ImportacaoDrePage'
import { AdministracaoPage } from '@/pages/AdministracaoPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<FarolDeMetasPage />} />
            <Route
              path="metas"
              element={
                <ProtectedRoute adminOnly>
                  <MetasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="importacao"
              element={
                <ProtectedRoute adminOnly>
                  <ImportacaoDrePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={
                <ProtectedRoute adminOnly>
                  <AdministracaoPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
