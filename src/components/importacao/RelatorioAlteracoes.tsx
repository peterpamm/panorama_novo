import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumeroPtBr } from '@/lib/utils'
import { MES_BLOCO_LABEL } from '@/lib/dre-diff-detector'
import type { AlteracaoRetroativa } from '@/types'

const CAMPO_LABEL: Record<string, string> = {
  remunerado: 'Remunerado', realizado: 'Realizado', diferenca: 'Diferença', avo: 'AVO (%)', avr: 'AVR (%)',
}

function descreverCampo(campo: string): { mes: string; campoLabel: string } {
  const [mesKey, ...resto] = campo.split('_')
  const campoBase = resto.join('_')
  return { mes: MES_BLOCO_LABEL[mesKey] ?? mesKey, campoLabel: CAMPO_LABEL[campoBase] ?? campoBase }
}

interface RelatorioAlteracoesProps {
  alteracoes: Omit<AlteracaoRetroativa, 'id' | 'importacao_id'>[]
  /** código → descrição, pra mostrar o nome da conta junto do código (ver `useContas`). */
  nomesContas: Map<string, string>
}

/** Tabela das alterações retroativas detectadas (mês já encerrado com valor diferente do que já estava importado). */
export function RelatorioAlteracoes({ alteracoes, nomesContas }: RelatorioAlteracoesProps) {
  if (alteracoes.length === 0) return null

  return (
    <Card className="border-l-4 border-l-farol-atencao">
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-semibold text-foreground">
          {alteracoes.length} alteração{alteracoes.length === 1 ? '' : 'ões'} retroativa{alteracoes.length === 1 ? '' : 's'} detectada{alteracoes.length === 1 ? '' : 's'} em mês já encerrado
        </p>
        <p className="text-xs text-muted-foreground">
          Provavelmente a matriz fez um ajuste de lançamento num mês que já tínhamos importado. A importação continua liberada — isso é só um alerta.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead>Negócio</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>Mês</TableHead>
              <TableHead>Campo</TableHead>
              <TableHead className="text-right">Valor antigo</TableHead>
              <TableHead className="text-right">Valor novo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alteracoes.map((a, i) => {
              const { mes, campoLabel } = descreverCampo(a.campo)
              return (
                <TableRow key={i}>
                  <TableCell className="text-xs">{a.unidade}</TableCell>
                  <TableCell className="text-xs">{a.negocio}</TableCell>
                  <TableCell className="text-xs">
                    <span className="font-mono text-muted-foreground">{a.conta_codigo}</span>
                    {nomesContas.get(a.conta_codigo) && <span className="ml-1">{nomesContas.get(a.conta_codigo)}</span>}
                  </TableCell>
                  <TableCell className="text-xs">{mes}</TableCell>
                  <TableCell className="text-xs">{campoLabel}</TableCell>
                  <TableCell className="text-right text-xs">{formatNumeroPtBr(a.valor_antigo)}</TableCell>
                  <TableCell className="text-right text-xs font-medium">{formatNumeroPtBr(a.valor_novo)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
