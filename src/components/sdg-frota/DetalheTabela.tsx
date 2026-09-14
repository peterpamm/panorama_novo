import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { formatCurrencyParenteses } from '@/lib/utils'

export interface LinhaDetalheFrota {
  codigo: string
  nome: string
  /** Realizado por unidade (só as unidades marcadas no filtro da página). */
  porUnidade: Map<string, number>
  /** Sempre o consolidado AMBEV real — não muda com o filtro de unidades (mesma regra do resto da tela). */
  consolidado: number
}

interface DetalheTabelaProps {
  titulo: string
  linhas: LinhaDetalheFrota[]
  unidadesColunas: string[]
  nomesUnidade: Map<string, string>
}

/**
 * Tabela de apoio: detalhe por unidade E por conta filha — uma linha por
 * conta (da conta-mãe até a folha mais analítica da tela), uma coluna por
 * unidade selecionada no filtro + o consolidado AMBEV sempre por último.
 */
export function DetalheTabela({ titulo, linhas, unidadesColunas, nomesUnidade }: DetalheTabelaProps) {
  return (
    <TableCard titulo={titulo} subtitulo="Realizado (R$) por conta e por unidade">
      {linhas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma conta com movimento nesse período.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conta</TableHead>
              {unidadesColunas.map(u => (
                <TableHead key={u} className="text-center">{nomesUnidade.get(u) ?? u}</TableHead>
              ))}
              <TableHead className="text-center font-semibold">AMBEV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(l => (
              <TableRow key={l.codigo} className="border-gray-200/30 dark:border-gray-700/30">
                <TableCell className="text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{l.codigo}</span> {l.nome}
                </TableCell>
                {unidadesColunas.map(u => (
                  <TableCell key={u} className="text-center text-xs tabular-nums text-muted-foreground">
                    {formatCurrencyParenteses(l.porUnidade.get(u) ?? 0)}
                  </TableCell>
                ))}
                <TableCell className="text-center text-xs font-semibold tabular-nums">
                  {formatCurrencyParenteses(l.consolidado)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TableCard>
  )
}
