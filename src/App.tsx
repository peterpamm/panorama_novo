import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { DataProvider } from '@/context/DataContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { FarolDeMetasPage } from '@/pages/FarolDeMetasPage'
import { AnalisePorContaPage } from '@/pages/AnalisePorContaPage'
import { RankingPage } from '@/pages/RankingPage'
import { MetasPage } from '@/pages/MetasPage'
import { ImportacaoDrePage } from '@/pages/ImportacaoDrePage'
import { AdministracaoPage } from '@/pages/AdministracaoPage'
import { PainelPerdasPage } from '@/pages/PainelPerdasPage'
import { RemuneracaoVariavelPage } from '@/pages/RemuneracaoVariavelPage'
import { RvGentePage } from '@/pages/rv/RvGentePage'
import { RvFinanceiroPage } from '@/pages/rv/RvFinanceiroPage'
import { RvFrotaPage } from '@/pages/rv/RvFrotaPage'
import { SdgFinanceiroPage } from '@/pages/SdgFinanceiroPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* SDG Financeiro — tela cheia, sem AppShell/sidebar */}
          <Route
            path="sdg-financeiro"
            element={
              <ProtectedRoute>
                <SdgFinanceiroPage />
              </ProtectedRoute>
            }
          />

          <Route
            element={
              <ProtectedRoute>
                <DataProvider>
                  <AppShell />
                </DataProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<FarolDeMetasPage />} />
            <Route path="analise-conta" element={<AnalisePorContaPage />} />
            <Route path="ranking" element={<RankingPage />} />
            <Route path="painel-perdas" element={<PainelPerdasPage />} />
            <Route path="remuneracao-variavel">
              <Route index element={<RemuneracaoVariavelPage />} />
              <Route path="gente" element={<RvGentePage />} />
              <Route path="financeiro" element={<RvFinanceiroPage />} />
              <Route path="frota" element={<RvFrotaPage />} />
            </Route>
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
