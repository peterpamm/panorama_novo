import { useState } from 'react'
import { PillToggle } from '@/components/ui/pill-toggle'
import { ImportarResultadosArmazemBi } from '@/components/importacao/ImportarResultadosArmazemBi'
import { ImportarMetaPresenteismoAl } from '@/components/importacao/ImportarMetaPresenteismoAl'
import { ImportarResultadosArmazemT1Bi } from '@/components/importacao/ImportarResultadosArmazemT1Bi'
import { ImportarMetasArmazemT1 } from '@/components/importacao/ImportarMetasArmazemT1'
import { RegistrarResultadosArmazemQuebras } from '@/components/importacao/RegistrarResultadosArmazemQuebras'

type AbaImportacaoArmazem = 't2' | 't1' | 'quebras'

const ABAS = [
  { value: 't2', label: 'T2' },
  { value: 't1', label: 'T1' },
  { value: 'quebras', label: 'Quebras' },
] as const

/**
 * Importação > Armazém — sub-abas T2, T1 e Quebras. T2/T1 têm planilhas e
 * cadastros totalmente separados (mesmo indicador pode existir nos dois,
 * ex: TMA e Presenteísmo AL, mas com fonte e tabela próprias) — evita
 * misturar os dois numa tela só e confundir qual bloco é de qual. Quebras é
 * cadastro manual (sem planilha), compartilhado entre as unidades do T2 e
 * do T1.
 */
export function ImportacaoArmazemPanel() {
  const [aba, setAba] = useState<AbaImportacaoArmazem>('t2')

  return (
    <div className="space-y-6">
      <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />

      {aba === 't2' && (
        <div className="space-y-8">
          <ImportarResultadosArmazemBi />
          <div className="border-t pt-8">
            <ImportarMetaPresenteismoAl />
          </div>
        </div>
      )}

      {aba === 't1' && (
        <div className="space-y-8">
          <ImportarResultadosArmazemT1Bi />
          <div className="border-t pt-8">
            <ImportarMetasArmazemT1 />
          </div>
        </div>
      )}

      {aba === 'quebras' && <RegistrarResultadosArmazemQuebras />}
    </div>
  )
}
