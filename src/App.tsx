import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
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
import { RvSegurancaPage } from '@/pages/rv/RvSegurancaPage'
import { RvDistribuicaoPage } from '@/pages/rv/RvDistribuicaoPage'
import { RvArmazemPage } from '@/pages/rv/RvArmazemPage'
import { PainelGeralRvPage } from '@/pages/rv/PainelGeralRvPage'
import { MatrizRvPage } from '@/pages/rv/MatrizRvPage'
import { AreaFinanceiraPage } from '@/pages/AreaFinanceiraPage'
import { RotinasFinanceirasPage } from '@/pages/financeira/RotinasFinanceirasPage'
import { PlanoDeAcaoPage } from '@/pages/financeira/PlanoDeAcaoPage'
import { SdgFinanceiroPage } from '@/pages/SdgFinanceiroPage'
import { MetasGeraisPage } from '@/pages/metas/MetasGeraisPage'
import { MetasPerdasPage } from '@/pages/metas/MetasPerdasPage'
import { MetasGentePage } from '@/pages/metas/MetasGentePage'
import { MetasFinanceiroPage } from '@/pages/metas/MetasFinanceiroPage'
import { MetasFrotaPage } from '@/pages/metas/MetasFrotaPage'
import { MetasSegurancaPage } from '@/pages/metas/MetasSegurancaPage'
import { MetasDistribuicaoPage } from '@/pages/metas/MetasDistribuicaoPage'
import { MetasArmazemPage } from '@/pages/metas/MetasArmazemPage'
import { ReuniaoResultadosPage } from '@/pages/ReuniaoResultadosPage'
import { ReuniaoFinanceiroPage } from '@/pages/reuniao/ReuniaoFinanceiroPage'

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
              <Route path="gente" element={<ProtectedRoute adminOnly pagina="rv_gente"><RvGentePage /></ProtectedRoute>} />
              <Route path="financeiro" element={<ProtectedRoute adminOnly pagina="rv_financeiro"><RvFinanceiroPage /></ProtectedRoute>} />
              <Route path="frota" element={<ProtectedRoute adminOnly pagina="rv_frota"><RvFrotaPage /></ProtectedRoute>} />
              <Route path="seguranca" element={<ProtectedRoute adminOnly pagina="rv_seguranca"><RvSegurancaPage /></ProtectedRoute>} />
              <Route path="distribuicao" element={<ProtectedRoute adminOnly pagina="rv_distribuicao"><RvDistribuicaoPage /></ProtectedRoute>} />
              <Route path="armazem" element={<ProtectedRoute adminOnly pagina="rv_armazem"><RvArmazemPage /></ProtectedRoute>} />
              <Route path="painel-geral" element={<ProtectedRoute pagina="rv_painel_geral"><PainelGeralRvPage /></ProtectedRoute>} />
              <Route path="matriz" element={<ProtectedRoute adminOnly pagina="rv_matriz"><MatrizRvPage /></ProtectedRoute>} />
            </Route>
            <Route
              path="area-financeira"
              element={
                <ProtectedRoute>
                  <Outlet />
                </ProtectedRoute>
              }
            >
              <Route index element={<AreaFinanceiraPage />} />
              <Route path="rotinas" element={<RotinasFinanceirasPage />} />
              <Route path="plano-de-acao" element={<PlanoDeAcaoPage />} />
            </Route>
            <Route
              path="metas"
              element={
                <ProtectedRoute adminOnly>
                  <Outlet />
                </ProtectedRoute>
              }
            >
              <Route index element={<MetasPage />} />
              <Route path="gerais" element={<ProtectedRoute pagina="metas_gerais"><MetasGeraisPage /></ProtectedRoute>} />
              <Route path="perdas" element={<ProtectedRoute pagina="metas_perdas"><MetasPerdasPage /></ProtectedRoute>} />
              <Route path="gente" element={<ProtectedRoute pagina="metas_gente"><MetasGentePage /></ProtectedRoute>} />
              <Route path="financeiro" element={<ProtectedRoute pagina="metas_financeiro"><MetasFinanceiroPage /></ProtectedRoute>} />
              <Route path="frota" element={<ProtectedRoute pagina="metas_frota"><MetasFrotaPage /></ProtectedRoute>} />
              <Route path="seguranca" element={<ProtectedRoute pagina="metas_seguranca"><MetasSegurancaPage /></ProtectedRoute>} />
              <Route path="distribuicao" element={<ProtectedRoute pagina="metas_distribuicao"><MetasDistribuicaoPage /></ProtectedRoute>} />
              <Route path="armazem" element={<ProtectedRoute pagina="metas_armazem"><MetasArmazemPage /></ProtectedRoute>} />
            </Route>
            <Route path="reuniao-resultados">
              <Route index element={<ReuniaoResultadosPage />} />
              <Route path="financeiro" element={<ProtectedRoute adminOnly pagina="reuniao_financeiro"><ReuniaoFinanceiroPage /></ProtectedRoute>} />
            </Route>
            <Route
              path="importacao"
              element={
                <ProtectedRoute adminOnly pagina="importacao">
                  <ImportacaoDrePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={
                <ProtectedRoute donoApenas>
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
