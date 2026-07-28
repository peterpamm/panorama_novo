import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { CadastroIndicadoresTab } from '@/components/reuniao/CadastroIndicadoresTab'
import { AcompanhamentoReuniaoTab } from '@/components/reuniao/AcompanhamentoReuniaoTab'
import { ResultadoMesReuniaoTab } from '@/components/reuniao/ResultadoMesReuniaoTab'

/** Subpágina Financeiro da Reunião Resultados — /reuniao-resultados/financeiro. */
export function ReuniaoFinanceiroPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/reuniao-resultados"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Reunião Resultados
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h2 className="text-base font-semibold text-foreground">Financeiro</h2>
      </div>

      <Tabs defaultValue="apuracao">
        <TabsList>
          <TabsTrigger value="apuracao">Apuração</TabsTrigger>
          <TabsTrigger value="resultado-mes">Resultado do Mês</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
        </TabsList>

        <TabsContent value="apuracao" className="pt-4">
          <AcompanhamentoReuniaoTab setor="financeiro" />
        </TabsContent>

        <TabsContent value="resultado-mes" className="pt-4">
          <ResultadoMesReuniaoTab setor="financeiro" />
        </TabsContent>

        <TabsContent value="cadastro" className="pt-4">
          <CadastroIndicadoresTab setor="financeiro" />
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  )
}
