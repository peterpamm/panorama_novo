import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { ehSetorArmazem } from '@/lib/rv-gente'
import { IndicadoresArmazemT2Card } from '@/components/rv/IndicadoresArmazemT2Card'
import { IndicadoresArmazemT1Card } from '@/components/rv/IndicadoresArmazemT1Card'
import { RvApuracao } from '@/components/rv/RvApuracao'

type AbaRvArmazem = 'acompanhamento' | 'apuracao'

const ABAS = [
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'apuracao', label: 'Apuração' },
] as const

/**
 * Subpágina RV de Armazém — /remuneracao-variavel/armazem. T2: EFC, TMA,
 * Presenteísmo AL, Refugo e Quebras. T1 (Estância/CDR Bahia): TMA,
 * Disponibilidade de Gente, Presenteísmo AL e Quebras — cadastro totalmente
 * separado do T2, mesmo quando o indicador tem o mesmo nome. Na apuração, T1
 * vs T2 é automático pela unidade que a liderança lidera (igual ao DTO
 * T1/T2 da Segurança) — não precisa de aba separada lá.
 */
export function RvArmazemPage() {
  const [aba, setAba] = useState<AbaRvArmazem>('acompanhamento')

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
          <h2 className="text-base font-semibold text-foreground">RV de Armazém</h2>
        </div>
        <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />
      </div>

      {aba === 'acompanhamento' ? (
        <div className="space-y-6">
          <IndicadoresArmazemT2Card />
          <div className="border-t pt-6">
            <IndicadoresArmazemT1Card />
          </div>
        </div>
      ) : (
        <RvApuracao
          setorLabel="ARMAZÉM"
          ehDoSetor={ehSetorArmazem}
          incluirArmazemEfc
          incluirArmazemTmaT2
          incluirArmazemPresenteismoAlT2
          incluirArmazemRefugo
          incluirArmazemTmaT1
          incluirArmazemDisponibilidadeGenteT1
          incluirArmazemPresenteismoAlT1
          incluirArmazemQuebras
        />
      )}
      <Toaster />
    </div>
  )
}
