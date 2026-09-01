import { ImportarResultadosArmazem } from '@/components/importacao/ImportarResultadosArmazem'
import { ImportarMetasArmazem } from '@/components/importacao/ImportarMetasArmazem'
import { RegistrarResultadosArmazemQuebras } from '@/components/importacao/RegistrarResultadosArmazemQuebras'

/**
 * Aba Importação da RV de Armazém. Resultados e metas do T1 e do T2 vêm cada um numa
 * planilha só, com os dois tiers em abas separadas ("RV ARM _T1" /
 * "RV ARM _T2") — então são dois blocos, não quatro. Antes existiam sub-abas
 * T2/T1 com um par de campos cada, todos pedindo o mesmo arquivo: além de
 * redundante, escolher a aba errada gravava no tier errado sem avisar.
 *
 * Quebras é cadastro manual (sem planilha), compartilhado entre T2 e T1.
 */
export function ImportacaoArmazemPanel() {
  return (
    <div className="space-y-8">
      <ImportarResultadosArmazem />
      <div className="border-t pt-8">
        <ImportarMetasArmazem />
      </div>
      <div className="border-t pt-8">
        <RegistrarResultadosArmazemQuebras />
      </div>
    </div>
  )
}
