import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { MetasSegurancaTab } from '@/components/metas/MetasSegurancaTab'

/** Subpágina Metas de Segurança — /remuneracao-variavel/metas/seguranca. */
export function MetasSegurancaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/remuneracao-variavel/metas" className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Metas
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h2 className="text-base font-semibold text-foreground">Metas de Segurança</h2>
      </div>

      <MetasSegurancaTab />
      <Toaster />
    </div>
  )
}
