import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MES_ABREV } from '@/components/farol/chart-shared'
import { cn, formatPercentSigned } from '@/lib/utils'
import type { ReducaoCustosResultado } from '@/lib/farol-calculations'

const TEXTO: Record<ReducaoCustosResultado['corClasse'], string> = {
  positivo: 'text-farol-positivo',
  atencao: 'text-farol-atencao',
  negativo: 'text-farol-negativo',
}

export interface LinhaTabelaReducao {
  codigo: string
  nome: string
  porMes: Map<number, ReducaoCustosResultado>
  anual: ReducaoCustosResultado | null
  /** Linha totalizadora (AMBEV) — exibida ao final, com destaque visual. */
  destaque?: boolean
}

interface ReducaoEvolucaoTableProps {
  /** Meses (já realizados) que formam as colunas, em ordem. */
  meses: number[]
  linhas: LinhaTabelaReducao[]
  nomeCard: string
}

function Celula({ resultado }: { resultado: ReducaoCustosResultado | undefined | null }) {
  if (!resultado) {
    return <TableCell className="text-center text-xs text-muted-foreground">—</TableCell>
  }
  return (
    <TableCell className={cn('text-center text-xs font-semibold', TEXTO[resultado.corClasse])}>
      {formatPercentSigned(resultado.variacaoPct, 1)}
    </TableCell>
  )
}

/** Evolução mês a mês de Redução de Custos por unidade — só na aba Redução de Custos. */
export function ReducaoEvolucaoTable({ meses, linhas, nomeCard }: ReducaoEvolucaoTableProps) {
  if (linhas.length === 0) return null

  return (
    <Card className="p-6">
      <div className="mb-1 text-base font-semibold text-foreground">Evolução por unidade</div>
      <div className="mb-4 text-xs text-muted-foreground">{nomeCard} — variação vs. mesmo período do ano anterior</div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              {meses.map(mes => (
                <TableHead key={mes} className="text-center">{MES_ABREV[mes] ?? mes}</TableHead>
              ))}
              <TableHead className="text-center">Ano</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(linha => (
              <TableRow key={linha.codigo} className={linha.destaque ? 'border-t-2 border-border bg-muted/50 font-semibold' : undefined}>
                <TableCell className={linha.destaque ? 'font-semibold' : undefined}>{linha.nome}</TableCell>
                {meses.map(mes => <Celula key={mes} resultado={linha.porMes.get(mes)} />)}
                <Celula resultado={linha.anual} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-[0.65rem] text-muted-foreground">
        <span className="text-farol-positivo">●</span> bateu a meta (-15%) &nbsp;
        <span className="text-farol-atencao">●</span> reduziu mas não bateu &nbsp;
        <span className="text-farol-negativo">●</span> aumentou &nbsp;
        <span>— sem comparação (unidade ainda não existia)</span>
      </p>
    </Card>
  )
}
