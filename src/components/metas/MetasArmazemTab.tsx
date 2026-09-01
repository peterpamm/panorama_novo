import { useState } from 'react'
import { PillToggle } from '@/components/ui/pill-toggle'
import { PesosArmazemT2Card } from '@/components/metas/PesosArmazemT2Card'
import { ArmazemMetaPorUnidadeCard } from '@/components/metas/ArmazemMetaPorUnidadeCard'
import { ArmazemRefugoQuebrasMetaCard } from '@/components/metas/ArmazemRefugoQuebrasMetaCard'
import { ArmazemPresenteismoAlMetaCard } from '@/components/metas/ArmazemPresenteismoAlMetaCard'
import { PesosArmazemT1Card } from '@/components/metas/PesosArmazemT1Card'
import { ArmazemT1MetaMensalCard } from '@/components/metas/ArmazemT1MetaMensalCard'
import { ArmazemT1QuebrasMetaCard } from '@/components/metas/ArmazemT1QuebrasMetaCard'

type AbaMetasArmazem = 't2' | 't1'

const ABAS = [
  { value: 't2', label: 'T2' },
  { value: 't1', label: 'T1' },
] as const

/**
 * Metas de Armazém — T2 (Presenteísmo AL, EFC, TMA, Refugo, Quebras) e T1
 * (Estância/CDR Bahia — TMA, Disponibilidade de Gente, Presenteísmo AL,
 * Quebras), cadastros totalmente separados mesmo quando o indicador tem o
 * mesmo nome nos dois. T2: EFC e TMA têm meta por unidade (vale o ano todo,
 * mesmo esquema da Devolução); Refugo e Quebras têm meta única (vale pra
 * todas as unidades); Presenteísmo AL é mensal por unidade. T1: TMA,
 * Disponibilidade de Gente e Presenteísmo AL são mensais por unidade (mudam
 * todo mês); Quebras tem meta única (vale pras duas unidades). Ambos
 * importados em RV de Armazém &gt; Importação. Peso é único por indicador em
 * todos os casos.
 */
export function MetasArmazemTab() {
  const [aba, setAba] = useState<AbaMetasArmazem>('t2')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {aba === 't2'
            ? 'T2: EFC e TMA (meta por unidade, vale o ano todo), Refugo e Quebras (meta única, vale pra todas as unidades) e Presenteísmo AL (meta mensal, importada em RV de Armazém > Importação). Peso único por indicador.'
            : 'T1 (Estância/CDR Bahia), cadastro separado do T2: TMA, Disponibilidade de Gente e Presenteísmo AL têm meta mensal por unidade (importada em RV de Armazém > Importação) e Quebras tem meta única (vale pras duas unidades). Peso único por indicador.'}
        </p>
        <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />
      </div>

      {aba === 't2' && (
        <div className="space-y-6">
          <PesosArmazemT2Card />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ArmazemMetaPorUnidadeCard
              tabela="rv_armazem_efc_meta"
              coluna="meta_pct"
              titulo="EFC — meta por unidade"
              subtitulo="Meta (%) de cada unidade, vale o ano todo. O peso é único (cadastro acima)."
              colunaHead="Meta (%)"
              placeholder="Ex: 90"
            />
            <ArmazemMetaPorUnidadeCard
              tabela="rv_armazem_tma_meta"
              coluna="meta_minutos"
              titulo="TMA — meta por unidade"
              subtitulo="Meta (HH:MM) de cada unidade, vale o ano todo. O peso é único (cadastro acima)."
              colunaHead="Meta (HH:MM)"
              placeholder="Ex: 01:40"
              formato="duracao"
            />
          </div>
          <ArmazemRefugoQuebrasMetaCard />
          <ArmazemPresenteismoAlMetaCard />
        </div>
      )}

      {aba === 't1' && (
        <div className="space-y-6">
          <PesosArmazemT1Card />
          <ArmazemT1MetaMensalCard tabela="metas_armazem_t1_tma" titulo="TMA (T1)" formato="duracao" />
          <ArmazemT1MetaMensalCard tabela="metas_armazem_t1_disponibilidade_gente" titulo="Disponibilidade de Gente (T1)" formato="pct" />
          <ArmazemT1MetaMensalCard tabela="metas_armazem_t1_presenteismo_al" titulo="Presenteísmo AL (T1)" formato="pct" />
          <ArmazemT1QuebrasMetaCard />
        </div>
      )}
    </div>
  )
}
