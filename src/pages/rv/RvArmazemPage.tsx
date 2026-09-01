import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { ehSetorArmazem } from '@/lib/rv-gente'
import { AcompanhamentoArmazemTab } from '@/components/rv/AcompanhamentoArmazemTab'
import { RvApuracao } from '@/components/rv/RvApuracao'
import { ImportacaoArmazemPanel } from '@/components/importacao/ImportacaoArmazemPanel'

type AbaRvArmazem = 'acompanhamento' | 'apuracao' | 'importacao'

const ABAS = [
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'apuracao', label: 'Apuração' },
  { value: 'importacao', label: 'Importação' },
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
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/remuneracao-variavel"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Remuneração Variável
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h2 className="text-base font-semibold text-foreground">RV de Armazém</h2>
        <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />
      </div>

      {aba === 'acompanhamento' ? (
        <AcompanhamentoArmazemTab />
      ) : aba === 'apuracao' ? (
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
      ) : (
        <ImportacaoArmazemPanel />
      )}
      <Toaster />
    </div>
  )
}
