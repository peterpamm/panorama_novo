import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { MetasFinanceiroTab } from '@/components/metas/MetasFinanceiroTab'
import { MetasResultadoTab } from '@/components/metas/MetasResultadoTab'

type AbaMetasFinanceiro = 'rv' | 'resultado'

const ABAS = [
  { value: 'rv', label: 'Metas de RV' },
  { value: 'resultado', label: 'Metas de Resultado' },
] as const

/**
 * Subpágina Metas do Financeiro — /remuneracao-variavel/metas/financeiro. "Metas de RV" são os
 * pesos dos indicadores da RV do Financeiro (todos vindos do DRE); "Metas de
 * Resultado" são metas que não são peso de RV, só um valor de comparação
 * (ex: % de aderência das Rotinas Financeiras).
 */
export function MetasFinanceiroPage() {
  const [aba, setAba] = useState<AbaMetasFinanceiro>('rv')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/remuneracao-variavel/metas" className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
            Metas
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <h2 className="text-base font-semibold text-foreground">Metas do Financeiro</h2>
        </div>
        <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />
      </div>

      {aba === 'rv' ? <MetasFinanceiroTab /> : <MetasResultadoTab />}
      <Toaster />
    </div>
  )
}
