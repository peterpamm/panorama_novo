import { useState } from 'react'
import { PillToggle } from '@/components/ui/pill-toggle'
import { IndisponibilidadeMetaCard } from '@/components/metas/IndisponibilidadeMetaCard'
import { ValesMetaCard } from '@/components/metas/ValesMetaCard'
import { LogonDuMetaCard } from '@/components/metas/LogonDuMetaCard'
import { DevolucaoMetaCard } from '@/components/metas/DevolucaoMetaCard'
import { PresenteismoDuMetaCard } from '@/components/metas/PresenteismoDuMetaCard'
import { PesosDistribuicaoFuncaoCard } from '@/components/metas/PesosDistribuicaoFuncaoCard'

type AbaMetasDistribuicao = 'coordenadores' | 'supervisor_du'

const ABAS = [
  { value: 'coordenadores', label: 'Metas Coordenadores' },
  { value: 'supervisor_du', label: 'Metas Supervisor DU' },
] as const

/**
 * Metas de Distribuição — Indisponibilidade, Devolução e Presenteísmo DU
 * valem tanto pra COORD. DU quanto pra SUPERVISOR DU; LogOn DU e Pacote de
 * Gente só contam pra COORD. DU; Vales só conta pra SUPERVISOR DU. A meta de
 * cada indicador é única e compartilhada entre as duas funções (cadastrada
 * nos cards abaixo) — só o peso muda por função (PesosDistribuicaoFuncaoCard).
 */
export function MetasDistribuicaoTab() {
  const [aba, setAba] = useState<AbaMetasDistribuicao>('coordenadores')
  const funcao = aba === 'coordenadores' ? 'COORD. DU' : 'SUPERVISOR DU'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Indisponibilidade, Devolução e Presenteísmo DU — a meta de cada um é a mesma pras duas funções, só o peso
          muda. LogOn DU e Pacote de Gente só contam pra COORD. DU; Vales só conta pra SUPERVISOR DU.
        </p>
        <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />
      </div>

      <PesosDistribuicaoFuncaoCard funcao={funcao} />

      <IndisponibilidadeMetaCard />
      {aba === 'coordenadores' && <LogonDuMetaCard />}
      {aba === 'supervisor_du' && <ValesMetaCard tabela="rv_vales_distribuicao_meta" temPeso={false} />}
      <DevolucaoMetaCard />
      <PresenteismoDuMetaCard />
    </div>
  )
}
