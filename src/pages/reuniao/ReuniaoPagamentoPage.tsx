import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { CadastroLiderancasTab } from '@/components/reuniao/pagamento/CadastroLiderancasTab'
import { ResultadoPagamentoTab } from '@/components/reuniao/pagamento/ResultadoPagamentoTab'

/**
 * Reunião Resultados > Pagamento — /reuniao-resultados/pagamento. Quem vence
 * o mês em cada um dos 6 setores ganha R$200 (dividido se a unidade tiver
 * mais de uma liderança cadastrada pro setor); o relatório do mês sai em PDF
 * (print do navegador) pra mandar pra matriz depositar no cartão Extratta.
 *
 * Admin-only, sem exceção (App.tsx: ProtectedRoute adminOnly) — dado de
 * cartão/conta de pagamento nunca é aberto pra usuário de unidade, diferente
 * das outras subpáginas de Reunião Resultados.
 */
export function ReuniaoPagamentoPage() {
  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="text-base font-semibold text-foreground">Pagamento</h2>
        <p className="text-sm text-muted-foreground">
          Cadastro das lideranças que recebem o prêmio de vencer o mês, e o relatório pronto pra enviar à matriz.
        </p>
      </div>

      <Tabs defaultValue="resultado">
        <TabsList className="print:hidden">
          <TabsTrigger value="resultado">Resultado</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
        </TabsList>

        <TabsContent value="resultado" className="pt-4 print:mt-0 print:pt-0">
          <ResultadoPagamentoTab />
        </TabsContent>

        <TabsContent value="cadastro" className="pt-4">
          <CadastroLiderancasTab />
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  )
}
