import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { useAuth } from '@/context/AuthContext'
import { useUnidades } from '@/hooks/useUnidades'
import { useLimpaPauta } from '@/hooks/useLimpaPauta'
import { AcompanhamentoLimpaPautaTab, TODAS_UNIDADES } from '@/components/financeira/limpa-pauta/AcompanhamentoLimpaPautaTab'
import { DashboardLimpaPautaTab } from '@/components/financeira/limpa-pauta/DashboardLimpaPautaTab'
import { ImportacaoLimpaPautaTab } from '@/components/financeira/limpa-pauta/ImportacaoLimpaPautaTab'

const ANO_ATUAL = new Date().getFullYear()
const ANOS_OPCOES = [ANO_ATUAL + 1, ANO_ATUAL, ANO_ATUAL - 1]

/**
 * Limpa Pauta (Área Financeira) — descontos cobrados da Ambev, subidos pro
 * Freightech (sistema deles) pra aprovação/reprovação. Leitura liberada pra
 * qualquer usuário logado, todas as unidades (migration_129) — só a edição
 * do detalhe (aprovações GOD/GEO/RPO, Observação, Pagamento) e a aba
 * Importação continuam admin-only. Aba Dashboard (2 tabelas comparativas
 * por unidade, ver `DashboardLimpaPautaTab.tsx`) + aba Acompanhamento
 * (filtro Unidade/Mês/Ano — com opção "Todas as unidades" — e a lista das
 * linhas importadas; clicar numa linha abre o detalhe, ver
 * `LimpaPautaDetalhe.tsx`) + aba Importação.
 */
export function LimpaPautaPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const { unidades: todasUnidades } = useUnidades()
  const { registros, loading, recarregar } = useLimpaPauta()

  // Todo mundo vê todas as unidades agora — a trava de edição fica só no
  // detalhe (isAdmin), não mais no filtro.
  const unidadesDisponiveis = useMemo(() => todasUnidades.filter(u => u.codigo !== 'AMBEV'), [todasUnidades])

  const [selUnidade, setSelUnidade] = useState<string>(TODAS_UNIDADES)
  const [selAno, setSelAno] = useState(ANO_ATUAL)
  const [selMes, setSelMes] = useState(new Date().getMonth() + 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/area-financeira" className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Área Financeira
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h2 className="text-base font-semibold text-foreground">Limpa Pauta</h2>
      </div>
      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
          {isAdmin && <TabsTrigger value="importacao">Importação</TabsTrigger>}
        </TabsList>
        <TabsContent value="dashboard" className="pt-4">
          <DashboardLimpaPautaTab registros={registros} unidades={unidadesDisponiveis} loading={loading} anosOpcoes={ANOS_OPCOES} />
        </TabsContent>
        <TabsContent value="acompanhamento" className="pt-4">
          <AcompanhamentoLimpaPautaTab
            registros={registros}
            unidades={unidadesDisponiveis}
            loading={loading}
            onAtualizado={recarregar}
            isAdmin={isAdmin}
            selUnidade={selUnidade}
            onUnidadeChange={setSelUnidade}
            selAno={selAno}
            onAnoChange={setSelAno}
            anosOpcoes={ANOS_OPCOES}
            selMes={selMes}
            onMesChange={setSelMes}
          />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="importacao" className="pt-4">
            <ImportacaoLimpaPautaTab unidades={todasUnidades.filter(u => u.codigo !== 'AMBEV')} onImportado={recarregar} />
          </TabsContent>
        )}
      </Tabs>
      <Toaster />
    </div>
  )
}
