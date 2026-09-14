import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { ehSetorEmpurrada } from '@/lib/rv-gente'
import { AcompanhamentoEmpurradaCard } from '@/components/rv/AcompanhamentoEmpurradaCard'
import { RvApuracao } from '@/components/rv/RvApuracao'

type AbaRvEmpurrada = 'acompanhamento' | 'apuracao'

const ABAS = [
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'apuracao', label: 'Apuração' },
] as const

/**
 * Subpágina RV de Empurrada — /remuneracao-variavel/empurrada. Só a Estância
 * tem liderança de Empurrada com RV. 5 indicadores, todos com meta/peso
 * únicos (uma unidade só): Indisponibilidade e Avaria de Transporte (mesmo
 * dado do Painel de Perdas — Indisponibilidade e Vales, respectivamente —
 * com meta/peso próprios de Empurrada), e GTY/TMV/Tempo de Rendição
 * (resultado/meta já importados na Reunião Resultados, sem reimportar nada
 * aqui, só peso próprio).
 */
export function RvEmpurradaPage() {
  const [aba, setAba] = useState<AbaRvEmpurrada>('acompanhamento')

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
        <h2 className="text-base font-semibold text-foreground">RV de Empurrada</h2>
        <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />
      </div>

      <div className="rounded-lg border border-blue-300/50 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400">
        GTY, TMV e Tempo de Rendição vêm da importação de <strong>Reunião Resultados &gt; Distribuição &gt; Importação</strong> — não tem importação própria aqui, só o peso de cada indicador.
      </div>

      {aba === 'acompanhamento' ? (
        <AcompanhamentoEmpurradaCard />
      ) : (
        <RvApuracao
          setorLabel="EMPURRADA"
          ehDoSetor={ehSetorEmpurrada}
          indisponibilidadeTabela="rv_empurrada_indisponibilidade_meta"
          incluirAvariaTransporte
          incluirGty
          incluirTmv
          incluirTempoRendicao
        />
      )}
      <Toaster />
    </div>
  )
}
