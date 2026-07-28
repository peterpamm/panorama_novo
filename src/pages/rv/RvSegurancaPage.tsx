import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { RV_SEGURANCA_DRE } from '@/lib/constants'
import { ehSetorSeguranca } from '@/lib/rv-gente'
import { IndicadoresDreCard } from '@/components/rv/IndicadoresDreCard'
import { IndicadoresForaDreCard } from '@/components/rv/IndicadoresForaDreCard'
import { RvApuracao } from '@/components/rv/RvApuracao'

type AbaRvSeguranca = 'acompanhamento' | 'apuracao'

const ABAS = [
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'apuracao', label: 'Apuração' },
] as const

/** Subpágina RV de Segurança — /remuneracao-variavel/seguranca. EPI's (074) e Uniformes (075), 100% DRE. */
export function RvSegurancaPage() {
  const [aba, setAba] = useState<AbaRvSeguranca>('acompanhamento')

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
          <h2 className="text-base font-semibold text-foreground">RV de Segurança</h2>
        </div>
        <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />
      </div>

      {aba === 'acompanhamento' ? (
        <div className="space-y-6">
          <IndicadoresDreCard indicadores={RV_SEGURANCA_DRE} />
          <div className="border-t pt-6">
            <IndicadoresForaDreCard />
          </div>
        </div>
      ) : (
        <RvApuracao
          setorLabel="SEGURANÇA"
          ehDoSetor={ehSetorSeguranca}
          indicadoresDre={RV_SEGURANCA_DRE}
          tabelaPesos="rv_seguranca_pesos_dre"
          incluirDtoT2
          incluirDtoT1
          incluirGsd
          incluirLogon
          incluirExcessoVelocidade
          incluirFai
          incluirTri
        />
      )}
      <Toaster />
    </div>
  )
}
