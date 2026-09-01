import { ImportarResultadosDtoT2 } from '@/components/importacao/ImportarResultadosDtoT2'
import { ImportarResultadosDtoT1 } from '@/components/importacao/ImportarResultadosDtoT1'
import { ImportarResultadosGsd } from '@/components/importacao/ImportarResultadosGsd'
import { ImportarResultadosLogon } from '@/components/importacao/ImportarResultadosLogon'
import { ImportarResultadosExcessoVelocidade } from '@/components/importacao/ImportarResultadosExcessoVelocidade'
import { ImportarResultadosFai } from '@/components/importacao/ImportarResultadosFai'
import { RegistrarTriCard } from '@/components/importacao/RegistrarTriCard'

/**
 * Importação da RV de Segurança: resultado mensal do DTO T2, DTO T1, GSD,
 * LogOn, Excesso de Velocidade, FAI e TRI — antes vivia na aba Segurança da
 * página Importação, transferida pra cá (aba Importação dentro da própria
 * subpágina RV de Segurança), pra ficar tudo do setor num lugar só.
 */
export function ImportacaoSegurancaPanel() {
  return (
    <div className="space-y-8">
      <ImportarResultadosDtoT2 />
      <div className="border-t pt-8">
        <ImportarResultadosDtoT1 />
      </div>
      <div className="border-t pt-8">
        <ImportarResultadosGsd />
      </div>
      <div className="border-t pt-8">
        <ImportarResultadosLogon />
      </div>
      <div className="border-t pt-8">
        <ImportarResultadosExcessoVelocidade />
      </div>
      <div className="border-t pt-8">
        <ImportarResultadosFai />
      </div>
      <div className="border-t pt-8">
        <RegistrarTriCard />
      </div>
    </div>
  )
}
