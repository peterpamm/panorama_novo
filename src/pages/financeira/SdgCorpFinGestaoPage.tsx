import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { AssuntosGeraisCorpTab } from '@/components/financeira/AssuntosGeraisCorpTab'
import { LucroCorpTab } from '@/components/financeira/LucroCorpTab'

/**
 * Subpágina SDG Corp Fin — /sdg/corp-fin. Gestão de conteúdo do SDG
 * Corporativo (apresentação pra diretoria, `/sdg-corporativo`) — só o dono
 * acessa (ver `donoApenas` na rota, App.tsx), já que só ele acessa a
 * apresentação em si.
 */
export function SdgCorpFinGestaoPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/sdg" className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          SDG
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h2 className="text-base font-semibold text-foreground">SDG Corp Fin</h2>
      </div>

      <Tabs defaultValue="assuntos-gerais">
        <TabsList>
          <TabsTrigger value="assuntos-gerais">Assuntos Gerais</TabsTrigger>
          <TabsTrigger value="lucro">Lucro</TabsTrigger>
        </TabsList>

        <TabsContent value="assuntos-gerais" className="pt-4">
          <AssuntosGeraisCorpTab />
        </TabsContent>

        <TabsContent value="lucro" className="pt-4">
          <LucroCorpTab />
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  )
}
