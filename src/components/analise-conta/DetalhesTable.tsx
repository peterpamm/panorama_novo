import { Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Dados detalhados</h3>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportarCsv(serie, nomeConta, ano)} disabled={serie.length === 0}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Remunerado</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead className="text-right">Gap</TableHead>
              <TableHead className="text-right">Gap %</TableHead>
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
                  <TableRow key={p.mes}>
                    <TableCell>{MES_ABREV[p.mes] ?? p.mes}</TableCell>
                    <TableCell className="text-right">{formatCurrencyCompact(p.remunerado)}</TableCell>
                    <TableCell className="text-right">{formatCurrencyCompact(p.realizado)}</TableCell>
                    <TableCell className={cn('text-right font-medium', TEXTO[cor])}>{formatCurrencyCompact(p.gap)}</TableCell>
                    <TableCell className={cn('text-right font-medium', TEXTO[cor])}>{formatPercentSigned(gapPercent, 1)}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
