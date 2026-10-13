import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { DataProvider } from '@/context/DataContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { FarolDeMetasPage } from '@/pages/FarolDeMetasPage'
import { FarolGerentesPage } from '@/pages/FarolGerentesPage'
import { AnalisePorContaPage } from '@/pages/AnalisePorContaPage'
import { AnaliseDetalhadaPage } from '@/pages/AnaliseDetalhadaPage'
import { AnaliseDetalhadaPacoteDeGentePage } from '@/pages/AnaliseDetalhadaPacoteDeGentePage'
import { AnaliseDetalhadaPacoteDeFrotaPage } from '@/pages/AnaliseDetalhadaPacoteDeFrotaPage'
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
import { RvEmpurradaPage } from '@/pages/rv/RvEmpurradaPage'
import { PainelGeralRvPage } from '@/pages/rv/PainelGeralRvPage'
import { MatrizRvPage } from '@/pages/rv/MatrizRvPage'
import { AreaFinanceiraPage } from '@/pages/AreaFinanceiraPage'
import { SdgPage } from '@/pages/SdgPage'
import { RotinasFinanceirasPage } from '@/pages/financeira/RotinasFinanceirasPage'
import { PlanoDeAcaoPage } from '@/pages/financeira/PlanoDeAcaoPage'
import { EncontroDeContasPage } from '@/pages/financeira/EncontroDeContasPage'
import { LimpaPautaPage } from '@/pages/financeira/LimpaPautaPage'
import { SdgFinanceiroGestaoPage } from '@/pages/financeira/SdgFinanceiroGestaoPage'
import { SdgCorpFinGestaoPage } from '@/pages/financeira/SdgCorpFinGestaoPage'
import { SdgGerentesGestaoPage } from '@/pages/financeira/SdgGerentesGestaoPage'
import { SdgFinanceiroPage } from '@/pages/SdgFinanceiroPage'
import { SdgGerentesPage } from '@/pages/SdgGerentesPage'
import { SdgCorporativoPage } from '@/pages/SdgCorporativoPage'
import { SdgCorporativoFrotaPage } from '@/pages/SdgCorporativoFrotaPage'
import { MetasGeraisPage } from '@/pages/metas/MetasGeraisPage'
import { MetasPerdasPage } from '@/pages/metas/MetasPerdasPage'
import { MetasGentePage } from '@/pages/metas/MetasGentePage'
import { MetasFinanceiroPage } from '@/pages/metas/MetasFinanceiroPage'
import { MetasFrotaPage } from '@/pages/metas/MetasFrotaPage'
import { MetasSegurancaPage } from '@/pages/metas/MetasSegurancaPage'
import { MetasDistribuicaoPage } from '@/pages/metas/MetasDistribuicaoPage'
import { MetasArmazemPage } from '@/pages/metas/MetasArmazemPage'
import { MetasEmpurradaPage } from '@/pages/metas/MetasEmpurradaPage'
import { ReuniaoResultadosPage } from '@/pages/ReuniaoResultadosPage'
import { ReuniaoFinanceiroPage } from '@/pages/reuniao/ReuniaoFinanceiroPage'
import { ReuniaoGentePage } from '@/pages/reuniao/ReuniaoGentePage'
import { ReuniaoFrotaPage } from '@/pages/reuniao/ReuniaoFrotaPage'
import { ReuniaoSegurancaPage } from '@/pages/reuniao/ReuniaoSegurancaPage'
import { ReuniaoDistribuicaoPage } from '@/pages/reuniao/ReuniaoDistribuicaoPage'
import { ReuniaoArmazemPage } from '@/pages/reuniao/ReuniaoArmazemPage'
import { ReuniaoResumoGeralPage } from '@/pages/reuniao/ReuniaoResumoGeralPage'
import { ReuniaoPagamentoPage } from '@/pages/reuniao/ReuniaoPagamentoPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* SDG Financeiro — tela cheia, sem AppShell/sidebar. Usa o
              DataProvider (DRE/Orçamento/Painel de Perdas de todas as
              unidades, cache de sessão) em vez de buscar a unidade
              selecionada do zero a cada troca — antes eram N fetches
              completos (um por troca de unidade), agora é 1 só por sessão
              desse provider. Só a lista de unidades não precisa vir do
              DataProvider à parte, já está incluída nele. */}
          <Route
            path="sdg-financeiro"
            element={
              <ProtectedRoute>
                <DataProvider>
                  <SdgFinanceiroPage />
                </DataProvider>
              </ProtectedRoute>
            }
          />

          {/* SDG Gerentes — tela cheia, mesmo molde do SDG Financeiro (ver
              comentário acima: DataProvider próprio, dados de todas as
              unidades em cache em vez de refazer a busca a cada troca).
              Qualquer usuário acessa — os próprios gerentes apresentam. */}
          <Route
            path="sdg-gerentes"
            element={
              <ProtectedRoute>
                <DataProvider>
                  <SdgGerentesPage />
                </DataProvider>
              </ProtectedRoute>
            }
          />

          {/* SDG Corporativo — apresentação pra diretoria, todas as unidades juntas. Só o dono do sistema acessa (ver ProtectedRoute donoApenas). Precisa do DataProvider (dados de todas as unidades), diferente do SDG Financeiro (uma unidade por vez, busca própria). */}
          <Route
            path="sdg-corporativo"
            element={
              <ProtectedRoute donoApenas>
                <DataProvider>
                  <SdgCorporativoPage />
                </DataProvider>
              </ProtectedRoute>
            }
          />

          {/* SDG Corporativo de Frota — mesmo molde do SDG Corporativo, mas só a
              estrutura de custos de Frota (conta 114). Qualquer admin acessa
              (não só o dono — pedido do corporativo de Frota). */}
          <Route
            path="sdg-corporativo-frota"
            element={
              <ProtectedRoute adminOnly>
                <DataProvider>
                  <SdgCorporativoFrotaPage />
                </DataProvider>
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
            <Route path="farol-gerentes" element={<FarolGerentesPage />} />
            <Route path="analise-conta" element={<Navigate to="/analise-detalhada/conta" replace />} />
            <Route
              path="analise-detalhada"
              element={
                <ProtectedRoute>
                  <Outlet />
                </ProtectedRoute>
              }
            >
              <Route index element={<AnaliseDetalhadaPage />} />
              <Route path="conta" element={<AnalisePorContaPage />} />
              <Route path="pacote-de-gente" element={<AnaliseDetalhadaPacoteDeGentePage />} />
              <Route path="pacote-de-frota" element={<AnaliseDetalhadaPacoteDeFrotaPage />} />
            </Route>
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
              <Route path="empurrada" element={<ProtectedRoute adminOnly pagina="rv_empurrada"><RvEmpurradaPage /></ProtectedRoute>} />
              <Route path="painel-geral" element={<ProtectedRoute pagina="rv_painel_geral"><PainelGeralRvPage /></ProtectedRoute>} />
              <Route path="matriz" element={<ProtectedRoute adminOnly pagina="rv_matriz"><MatrizRvPage /></ProtectedRoute>} />
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
                <Route path="empurrada" element={<ProtectedRoute pagina="metas_empurrada"><MetasEmpurradaPage /></ProtectedRoute>} />
              </Route>
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
              <Route path="encontro-de-contas" element={<EncontroDeContasPage />} />
              <Route path="limpa-pauta" element={<LimpaPautaPage />} />
              {/* Migradas pra /sdg — redirects abaixo pra quem tinha o link antigo salvo. */}
              <Route path="sdg-financeiro" element={<Navigate to="/sdg/financeiro" replace />} />
              <Route path="sdg-corp-fin" element={<Navigate to="/sdg/corp-fin" replace />} />
            </Route>
            <Route
              path="sdg"
              element={
                <ProtectedRoute>
                  <Outlet />
                </ProtectedRoute>
              }
            >
              <Route index element={<SdgPage />} />
              <Route path="financeiro" element={<SdgFinanceiroGestaoPage />} />
              <Route path="corp-fin" element={<ProtectedRoute donoApenas><SdgCorpFinGestaoPage /></ProtectedRoute>} />
              <Route path="gerentes" element={<SdgGerentesGestaoPage />} />
            </Route>
            <Route path="reuniao-resultados">
              <Route index element={<ReuniaoResultadosPage />} />
              <Route path="financeiro" element={<ProtectedRoute adminOnly pagina="reuniao_financeiro"><ReuniaoFinanceiroPage /></ProtectedRoute>} />
              <Route path="gente" element={<ProtectedRoute adminOnly pagina="reuniao_gente"><ReuniaoGentePage /></ProtectedRoute>} />
              <Route path="frota" element={<ProtectedRoute adminOnly pagina="reuniao_frota"><ReuniaoFrotaPage /></ProtectedRoute>} />
              <Route path="seguranca" element={<ProtectedRoute adminOnly pagina="reuniao_seguranca"><ReuniaoSegurancaPage /></ProtectedRoute>} />
              <Route path="distribuicao" element={<ProtectedRoute adminOnly pagina="reuniao_distribuicao"><ReuniaoDistribuicaoPage /></ProtectedRoute>} />
              <Route path="armazem" element={<ProtectedRoute adminOnly pagina="reuniao_armazem"><ReuniaoArmazemPage /></ProtectedRoute>} />
              <Route path="resumo-geral" element={<ProtectedRoute pagina="reuniao_resumo_geral"><ReuniaoResumoGeralPage /></ProtectedRoute>} />
              {/* Pagamento lida com cartão/conta — sempre adminOnly, diferente do Resumo Geral (que pode ser concedido pra unidade). */}
              <Route path="pagamento" element={<ProtectedRoute adminOnly pagina="reuniao_pagamento"><ReuniaoPagamentoPage /></ProtectedRoute>} />
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
