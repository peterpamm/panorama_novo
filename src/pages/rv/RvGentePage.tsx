import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { RV_GENTE_DRE } from '@/lib/constants'
import { ehSetorRh } from '@/lib/rv-gente'
import { RvGenteTab } from '@/components/rv/RvGenteTab'
import { RvApuracao } from '@/components/rv/RvApuracao'

type AbaRvGente = 'acompanhamento' | 'apuracao'

const ABAS = [
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'apuracao', label: 'Apuração' },
] as const

/** Subpágina RV de Gente — /remuneracao-variavel/gente. */
export function RvGentePage() {
  const [aba, setAba] = useState<AbaRvGente>('acompanhamento')

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
          <h2 className="text-base font-semibold text-foreground">RV de Gente</h2>
        </div>
        <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />
      </div>

      {aba === 'acompanhamento' ? (
        <RvGenteTab />
      ) : (
        <RvApuracao
          setorLabel="RH"
          ehDoSetor={ehSetorRh}
          indicadoresDre={RV_GENTE_DRE}
          tabelaPesos="rv_gente_pesos_dre"
          incluirIndicadoresBi
        />
      )}
      <Toaster />
    </div>
  )
}
