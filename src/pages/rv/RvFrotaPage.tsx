import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { RV_FROTA_DRE } from '@/lib/constants'
import { ehSetorFrota } from '@/lib/rv-gente'
import { IndicadoresDreCard } from '@/components/rv/IndicadoresDreCard'
import { RvApuracao } from '@/components/rv/RvApuracao'

type AbaRvFrota = 'acompanhamento' | 'apuracao'

const ABAS = [
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'apuracao', label: 'Apuração' },
] as const

/**
 * Subpágina RV de Frota — /remuneracao-variavel/frota. Por enquanto só os
 * indicadores do DRE (Manutenção, Pneus, Diesel); os de fora do DRE entram
 * quando a importação deles for estruturada.
 */
export function RvFrotaPage() {
  const [aba, setAba] = useState<AbaRvFrota>('acompanhamento')

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
          <h2 className="text-base font-semibold text-foreground">RV de Frota</h2>
        </div>
        <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />
      </div>

      {aba === 'acompanhamento' ? (
        <IndicadoresDreCard indicadores={RV_FROTA_DRE} />
      ) : (
        <RvApuracao
          setorLabel="FROTA"
          ehDoSetor={ehSetorFrota}
          indicadoresDre={RV_FROTA_DRE}
          tabelaPesos="rv_frota_pesos_dre"
        />
      )}
      <Toaster />
    </div>
  )
}
