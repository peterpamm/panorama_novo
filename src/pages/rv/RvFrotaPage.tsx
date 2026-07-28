import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { RV_FROTA_DRE } from '@/lib/constants'
import { ehSetorFrota } from '@/lib/rv-gente'
import { IndicadoresDreCard } from '@/components/rv/IndicadoresDreCard'
import { DescontosFrotaCard } from '@/components/rv/DescontosFrotaCard'
import { RvApuracao } from '@/components/rv/RvApuracao'

type AbaRvFrota = 'acompanhamento' | 'apuracao'

const ABAS = [
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'apuracao', label: 'Apuração' },
] as const

/**
 * Subpágina RV de Frota — /remuneracao-variavel/frota. Indicadores do DRE
 * (Manutenção, Pneus, Diesel) + Desconto CIVF / Desconto Stress Test
 * (resultado importado em Importação &gt; Frota, meta e peso únicos em R$,
 * quanto menor melhor).
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
        <div className="space-y-6">
          <IndicadoresDreCard indicadores={RV_FROTA_DRE} />
          <DescontosFrotaCard />
        </div>
      ) : (
        <RvApuracao
          setorLabel="FROTA"
          ehDoSetor={ehSetorFrota}
          indicadoresDre={RV_FROTA_DRE}
          tabelaPesos="rv_frota_pesos_dre"
          incluirDescontoCivf
          incluirDescontoStressTest
        />
      )}
      <Toaster />
    </div>
  )
}
