import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { CadastroIndicadoresTab } from '@/components/reuniao/CadastroIndicadoresTab'
import { AcompanhamentoReuniaoTab } from '@/components/reuniao/AcompanhamentoReuniaoTab'
import { ResultadoMesReuniaoTab } from '@/components/reuniao/ResultadoMesReuniaoTab'
import { ImportacaoTermometroTab } from '@/components/reuniao/ImportacaoTermometroTab'

/** Subpágina Gente da Reunião Resultados — /reuniao-resultados/gente. */
export function ReuniaoGentePage() {
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
        <h2 className="text-base font-semibold text-foreground">Gente</h2>
      </div>

      <Tabs defaultValue="resultado-mes">
        <TabsList>
          <TabsTrigger value="resultado-mes">Resultado do Mês</TabsTrigger>
          <TabsTrigger value="apuracao">Apuração</TabsTrigger>
          <TabsTrigger value="importacao">Importação</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
        </TabsList>

        <TabsContent value="resultado-mes" className="pt-4">
          <ResultadoMesReuniaoTab setor="gente" />
        </TabsContent>

        <TabsContent value="apuracao" className="pt-4">
          <AcompanhamentoReuniaoTab setor="gente" />
        </TabsContent>

        <TabsContent value="importacao" className="pt-4">
          <ImportacaoTermometroTab setor="gente" />
        </TabsContent>

        <TabsContent value="cadastro" className="pt-4">
          <CadastroIndicadoresTab setor="gente" />
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  )
}
