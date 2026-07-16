import { Download } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard, tableCardActionClass } from '@/components/ui/table-card'
import { Button } from '@/components/ui/button'
import { cn, formatCurrencyCompact, formatPercentSigned } from '@/lib/utils'
import { corClasseGap, type SeriePontoConta } from '@/lib/analise-conta-calculations'
import { MES_ABREV } from '@/components/farol/chart-shared'

const TEXTO = { positivo: 'text-farol-positivo', negativo: 'text-farol-negativo' } as const

function numeroCsv(valor: number): string {
  return valor.toFixed(2).replace('.', ',')
}

function exportarCsv(serie: SeriePontoConta[], nomeConta: string, ano: number) {
  const linhas = [
    ['Mês', 'Remunerado (R$)', 'Realizado (R$)', 'Gap (R$)', 'Gap (%)'],
    ...serie.map(p => [
      MES_ABREV[p.mes] ?? String(p.mes),
      numeroCsv(p.remunerado),
      numeroCsv(p.realizado),
      numeroCsv(p.gap),
      numeroCsv(p.remunerado !== 0 ? (p.gap / p.remunerado) * 100 : 0),
    ]),
  ]
  const csv = linhas.map(linha => linha.join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `analise_${nomeConta.slice(0, 30).replace(/\s+/g, '_')}_${ano}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface DetalhesTableProps {
  serie: SeriePontoConta[]
  nomeConta: string
  ano: number
}

export function DetalhesTable({ serie, nomeConta, ano }: DetalhesTableProps) {
  return (
    <TableCard
      titulo="Dados detalhados"
      subtitulo={`${nomeConta} · ${ano}`}
      acoes={
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-2', tableCardActionClass)}
          onClick={() => exportarCsv(serie, nomeConta, ano)}
          disabled={serie.length === 0}
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mês</TableHead>
            <TableHead className="text-center">Remunerado</TableHead>
            <TableHead className="text-center">Realizado</TableHead>
            <TableHead className="text-center">Gap</TableHead>
            <TableHead className="text-center">Gap %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {serie.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                Nenhum dado disponível para esse período.
              </TableCell>
            </TableRow>
          ) : (
            serie.map(p => {
              const gapPercent = p.remunerado !== 0 ? (p.gap / p.remunerado) * 100 : 0
              const cor = corClasseGap(p.gap)
              return (
                <TableRow key={p.mes} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="py-3 font-medium">{MES_ABREV[p.mes] ?? p.mes}</TableCell>
                  <TableCell className="py-3 text-center">{formatCurrencyCompact(p.remunerado)}</TableCell>
                  <TableCell className="py-3 text-center">{formatCurrencyCompact(p.realizado)}</TableCell>
                  <TableCell className={cn('py-3 text-center font-medium', TEXTO[cor])}>{formatCurrencyCompact(p.gap)}</TableCell>
                  <TableCell className={cn('py-3 text-center font-medium', TEXTO[cor])}>{formatPercentSigned(gapPercent, 1)}</TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </TableCard>
  )
}
