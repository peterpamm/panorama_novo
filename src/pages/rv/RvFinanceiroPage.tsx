import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { RV_FINANCEIRO_DRE } from '@/lib/constants'
import { ehSetorFinanceiro } from '@/lib/rv-gente'
import { IndicadoresDreCard } from '@/components/rv/IndicadoresDreCard'
import { RvApuracao } from '@/components/rv/RvApuracao'

type AbaRvFinanceiro = 'acompanhamento' | 'apuracao'

const ABAS = [
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'apuracao', label: 'Apuração' },
] as const

/** Subpágina RV do Financeiro — /remuneracao-variavel/financeiro. Indicadores 100% do DRE. */
export function RvFinanceiroPage() {
  const [aba, setAba] = useState<AbaRvFinanceiro>('acompanhamento')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/remuneracao-variavel"
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Remuneração Variável
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <h2 className="text-base font-semibold text-foreground">RV do Financeiro</h2>
        </div>
        <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />
      </div>

      {aba === 'acompanhamento' ? (
        <IndicadoresDreCard indicadores={RV_FINANCEIRO_DRE} />
      ) : (
        <RvApuracao
          setorLabel="FINANCEIRO"
          ehDoSetor={ehSetorFinanceiro}
          indicadoresDre={RV_FINANCEIRO_DRE}
          tabelaPesos="rv_financeiro_pesos_dre"
        />
      )}
      <Toaster />
    </div>
  )
}
