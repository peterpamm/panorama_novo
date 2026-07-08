import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatCurrencyInteiro, formatPercent, formatPercentSigned } from '@/lib/utils'
import { corClasseAtingimento, type RankingLinhaIndicador, type RankingLinhaReceita } from '@/lib/ranking-calculations'

const BG = { positivo: 'bg-farol-positivo/10', negativo: 'bg-farol-negativo/10', semCor: '' } as const

function corClasseDelta(delta: number | null): 'positivo' | 'negativo' | 'semCor' {
  if (delta === null) return 'semCor'
  return delta >= 0 ? 'positivo' : 'negativo'
}

function formatImpacto(valor: number): string {
  const sinal = valor >= 0 ? '+' : ''
  return `${sinal}${formatCurrencyInteiro(valor)}`
}

interface RankingTabelaReceitaProps {
  linhas: RankingLinhaReceita[]
  nomesUnidade: Map<string, string>
}

export function RankingTabelaReceita({ linhas, nomesUnidade }: RankingTabelaReceitaProps) {
  if (linhas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados para este período.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">#</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead className="text-right">Receita YTD</TableHead>
          <TableHead className="text-right">Meta anual</TableHead>
          <TableHead className="text-right">% Atingimento</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map(l => {
          const cor = l.rank === null ? 'semCor' : corClasseAtingimento(l.percentualAtingimento)
          const ambev = l.unidade === 'AMBEV'
          return (
            <TableRow key={l.unidade} className={BG[cor]}>
              <TableCell className="text-sm text-muted-foreground">{l.rank ?? '—'}</TableCell>
              <TableCell className={cn('text-sm', ambev && 'font-semibold')}>{nomesUnidade.get(l.unidade) ?? l.unidade}</TableCell>
              <TableCell className="text-right text-sm">{formatCurrencyInteiro(l.receitaYtd)}</TableCell>
              <TableCell className="text-right text-sm">{formatCurrencyInteiro(l.metaAnual)}</TableCell>
              <TableCell className="text-right text-sm font-medium">{formatPercent(l.percentualAtingimento, 1)}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

interface RankingTabelaIndicadorProps {
  linhas: RankingLinhaIndicador[]
  nomesUnidade: Map<string, string>
}

export function RankingTabelaIndicador({ linhas, nomesUnidade }: RankingTabelaIndicadorProps) {
  if (linhas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados para este período.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">#</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead className="text-right">AVR</TableHead>
          <TableHead className="text-right">Meta</TableHead>
          <TableHead className="text-right">Δ da Meta</TableHead>
          <TableHead className="text-right">Impacto</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map(l => {
          const cor = l.rank === null ? 'semCor' : corClasseDelta(l.delta)
          const ambev = l.unidade === 'AMBEV'
          return (
            <TableRow key={l.unidade} className={BG[cor]}>
              <TableCell className="text-sm text-muted-foreground">{l.rank ?? '—'}</TableCell>
              <TableCell className={cn('text-sm', ambev && 'font-semibold')}>{nomesUnidade.get(l.unidade) ?? l.unidade}</TableCell>
              <TableCell className="text-right text-sm">{formatPercent(l.avr, 2)}</TableCell>
              <TableCell className="text-right text-sm">{formatPercent(l.meta, 2)}</TableCell>
              <TableCell className="text-right text-sm font-medium">{formatPercentSigned(l.delta, 2)}</TableCell>
              <TableCell className="text-right text-sm font-medium">{l.meta === null ? '—' : formatImpacto(l.impacto)}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
