import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { MetasDistribuicaoTab } from '@/components/metas/MetasDistribuicaoTab'

/** Subpágina Metas de Distribuição — /remuneracao-variavel/metas/distribuicao. */
export function MetasDistribuicaoPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/remuneracao-variavel/metas" className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Metas
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h2 className="text-base font-semibold text-foreground">Metas Distribuição</h2>
      </div>

      <MetasDistribuicaoTab />
      <Toaster />
    </div>
  )
}
