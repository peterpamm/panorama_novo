import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { RV_FROTA_DRE } from '@/lib/constants'
import { ehSetorFrota } from '@/lib/rv-gente'
import { AcompanhamentoFrotaTab } from '@/components/rv/AcompanhamentoFrotaTab'
import { RvApuracao } from '@/components/rv/RvApuracao'
import { ImportarResultadosFrota } from '@/components/importacao/ImportarResultadosFrota'

type AbaRvFrota = 'acompanhamento' | 'apuracao' | 'importacao'

const ABAS = [
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'apuracao', label: 'Apuração' },
  { value: 'importacao', label: 'Importação' },
] as const

/**
 * Subpágina RV de Frota — /remuneracao-variavel/frota. Indicadores do DRE
 * (Manutenção, Pneus, Diesel) + Desconto CIVF / Desconto Stress Test
 * (resultado importado na própria aba Importação desta página, meta e peso
 * únicos em R$, quanto menor melhor) + os 5 indicadores novos específicos de Estância/
 * Ponta Grossa/CDR Bahia — Custos Gerais (DRE 113), Ad. Checklist,
 * Ad. Milimetragem, Indisponibilidade Manutenção e Disponibilidade
 * Empilhadeira (ver `AcompanhamentoFrotaTab`, `incluirFrotaT1`).
 */
export function RvFrotaPage() {
  const [aba, setAba] = useState<AbaRvFrota>('acompanhamento')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/remuneracao-variavel"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Remuneração Variável
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h2 className="text-base font-semibold text-foreground">RV de Frota</h2>
        <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />
      </div>

      {aba === 'acompanhamento' ? (
        <AcompanhamentoFrotaTab />
      ) : aba === 'apuracao' ? (
        <RvApuracao
          setorLabel="FROTA"
          ehDoSetor={ehSetorFrota}
          indicadoresDre={RV_FROTA_DRE}
          tabelaPesos="rv_frota_pesos_dre"
          incluirDescontoCivf
          incluirDescontoStressTest
          incluirFrotaT1
        />
      ) : (
        <ImportarResultadosFrota />
      )}
      <Toaster />
    </div>
  )
}
