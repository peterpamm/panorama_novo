import { ImportarResultadosDistribuicaoBi } from '@/components/importacao/ImportarResultadosDistribuicaoBi'
import { ImportarMetaPresenteismoDu } from '@/components/importacao/ImportarMetaPresenteismoDu'

/**
 * Importação da RV de Distribuição: resultado mensal do LogOn DU, Devolução
 * e Presenteísmo DU + meta mensal do Presenteísmo DU — antes vivia na aba
 * Distribuição da página Importação, transferida pra cá (aba Importação
 * dentro da própria subpágina RV de Distribuição).
 */
export function ImportacaoDistribuicaoPanel() {
  return (
    <div className="space-y-8">
      <ImportarResultadosDistribuicaoBi />
      <div className="border-t pt-8">
        <ImportarMetaPresenteismoDu />
      </div>
    </div>
  )
}
