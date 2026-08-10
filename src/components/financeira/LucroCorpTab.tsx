import { Construction } from 'lucide-react'
import { Card } from '@/components/ui/card'

/**
 * Lucro (SDG Corporativo) — reservado pra dados que ainda serão definidos e
 * importados (aparecerão também no modo apresentação, num slide próprio).
 * Por enquanto só a estrutura da aba, sem tabela/import ainda.
 */
export function LucroCorpTab() {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <Construction className="h-8 w-8 text-muted-foreground" />
      <div>
        <p className="text-sm font-semibold text-foreground">Em construção</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Aqui vai entrar o cadastro/importação dos dados de Lucro — assim que o formato for definido, aparece aqui e
          também no modo apresentação (SDG Corporativo).
        </p>
      </div>
    </Card>
  )
}
