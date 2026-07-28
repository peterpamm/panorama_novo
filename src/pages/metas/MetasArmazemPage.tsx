import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { MetasArmazemTab } from '@/components/metas/MetasArmazemTab'

/** Subpágina Metas de Armazém — /metas/armazem. */
export function MetasArmazemPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/metas" className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Metas
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h2 className="text-base font-semibold text-foreground">Metas de Armazém</h2>
      </div>

      <MetasArmazemTab />
      <Toaster />
    </div>
  )
}
