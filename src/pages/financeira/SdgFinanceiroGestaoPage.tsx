import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { JustificativasSdgTab } from '@/components/financeira/JustificativasSdgTab'

/** Subpágina SDG Financeiro — /sdg/financeiro. Edição das justificativas (Pontos Positivos/Negativos) que aparecem no modo apresentação. */
export function SdgFinanceiroGestaoPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/sdg" className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          SDG
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h2 className="text-base font-semibold text-foreground">SDG Financeiro</h2>
      </div>

      <JustificativasSdgTab />
      <Toaster />
    </div>
  )
}
