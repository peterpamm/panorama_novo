import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatCurrencyCompact, formatPercent } from '@/lib/utils'
import { PACOTES_DRE } from '@/lib/constants'
import {
  calcularAberturaDetalheMensal,
  calcularAberturaResumo,
  corClasseGap,
  type AberturaContaDetalhe,
  type AberturaContaResumo,
} from '@/lib/analise-conta-calculations'
import { MES_ABREV } from '@/components/farol/chart-shared'
import type { DreLongoRow } from '@/types'

const TEXTO = { positivo: 'text-farol-positivo', negativo: 'text-farol-negativo' } as const

function unicos<T>(valores: T[]): T[] {
  return Array.from(new Set(valores))
}

interface TabelaResumoProps {
  titulo: string
  contas: AberturaContaResumo[]
  nomesPorCodigo: Map<string, string>
}

function TabelaResumo({ titulo, contas, nomesPorCodigo }: TabelaResumoProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <h4 className="mb-3 text-sm font-semibold text-foreground">{titulo}</h4>
        {contas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta</p>
        ) : (
          <div className="max-h-[368px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 h-9 bg-card py-1.5">Conta</TableHead>
                  <TableHead className="sticky top-0 h-9 bg-card py-1.5 text-right">Remunerado</TableHead>
                  <TableHead className="sticky top-0 h-9 bg-card py-1.5 text-right">Realizado</TableHead>
                  <TableHead className="sticky top-0 h-9 bg-card py-1.5 text-right">Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contas.map(c => (
                  <TableRow key={c.codigo}>
                    <TableCell className="max-w-[180px] truncate px-3 py-1.5 text-xs">{nomesPorCodigo.get(c.codigo) ?? c.codigo}</TableCell>
                    <TableCell className="px-3 py-1.5 text-right text-xs">{formatCurrencyCompact(c.remunerado)}</TableCell>
                    <TableCell className="px-3 py-1.5 text-right text-xs">{formatCurrencyCompact(c.realizado)}</TableCell>
                    <TableCell className={cn('px-3 py-1.5 text-right text-xs font-medium', TEXTO[corClasseGap(c.gap)])}>
                      {formatCurrencyCompact(c.gap)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TabelaDetalheConta({ detalhe, nome }: { detalhe: AberturaContaDetalhe; nome: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <h4 className="mb-3 truncate text-sm font-semibold text-foreground">{nome}</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Remunerado</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead className="text-right">Gap</TableHead>
              <TableHead className="text-right">AVR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detalhe.meses.map(m => (
              <TableRow key={m.mes}>
                <TableCell className="text-xs">{MES_ABREV[m.mes] ?? m.mes}</TableCell>
                <TableCell className="text-right text-xs">{formatCurrencyCompact(m.remunerado)}</TableCell>
                <TableCell className="text-right text-xs">{formatCurrencyCompact(m.realizado)}</TableCell>
                <TableCell className={cn('text-right text-xs font-medium', TEXTO[corClasseGap(m.gap)])}>
                  {formatCurrencyCompact(m.gap)}
                </TableCell>
                <TableCell className="text-right text-xs">{formatPercent(m.avr, 1)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell className="text-xs">TOTAL</TableCell>
              <TableCell className="text-right text-xs">{formatCurrencyCompact(detalhe.total.remunerado)}</TableCell>
              <TableCell className="text-right text-xs">{formatCurrencyCompact(detalhe.total.realizado)}</TableCell>
              <TableCell className={cn('text-right text-xs', TEXTO[corClasseGap(detalhe.total.gap)])}>
                {formatCurrencyCompact(detalhe.total.gap)}
              </TableCell>
              <TableCell className="text-right text-xs">{formatPercent(detalhe.total.avr, 1)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

interface AberturaContasProps {
  rowsNegocioAno: DreLongoRow[]
  nomesPorCodigo: Map<string, string>
}

/** Aba "Abertura de Contas": réplica das regras da aba homônima do painel antigo (faixas Pacote DRE, top contas, detalhamento mensal). */
export function AberturaContas({ rowsNegocioAno, nomesPorCodigo }: AberturaContasProps) {
  const pacotes = Object.keys(PACOTES_DRE)
  const [selPacote, setSelPacote] = useState(pacotes[0])
  const [tipoPeriodo, setTipoPeriodo] = useState<'Mensal' | 'Acumulado'>('Mensal')
  const [selMes, setSelMes] = useState<number | null>(null)

  const [faixaIni, faixaFim] = PACOTES_DRE[selPacote]

  const rowsPacote = useMemo(
    () => rowsNegocioAno.filter(r => {
      const num = Number(r.conta_codigo)
      return num >= faixaIni && num <= faixaFim
    }),
    [rowsNegocioAno, faixaIni, faixaFim],
  )

  const rowsPacoteMensal = useMemo(() => rowsPacote.filter(r => r.tipo_periodo === 'MENSAL'), [rowsPacote])

  const mesesDisponiveis = useMemo(() => unicos(rowsPacoteMensal.map(r => r.mes)).sort((a, b) => a - b), [rowsPacoteMensal])
  useEffect(() => {
    if (mesesDisponiveis.length === 0) return
    if (selMes && mesesDisponiveis.includes(selMes)) return
    setSelMes(mesesDisponiveis[mesesDisponiveis.length - 1])
  }, [mesesDisponiveis, selMes])

  const rowsResumo = useMemo(() => {
    if (tipoPeriodo === 'Mensal') {
      return rowsPacoteMensal.filter(r => r.mes === selMes)
    }
    const acumulado = rowsPacote.filter(r => r.tipo_periodo === 'ACUMULADO_ANO')
    if (acumulado.length === 0) return []
    const mesMax = Math.max(...acumulado.map(r => r.mes))
    return acumulado.filter(r => r.mes === mesMax)
  }, [tipoPeriodo, rowsPacoteMensal, rowsPacote, selMes])

  const resumoContas = useMemo(() => calcularAberturaResumo(rowsResumo), [rowsResumo])
  const contasEstouro = useMemo(
    () => resumoContas.filter(c => c.gap < 0).sort((a, b) => a.gap - b.gap),
    [resumoContas],
  )
  const contasEconomia = useMemo(
    () => resumoContas.filter(c => c.gap > 0).sort((a, b) => b.gap - a.gap),
    [resumoContas],
  )

  const detalheMensal = useMemo(() => calcularAberturaDetalheMensal(rowsPacoteMensal), [rowsPacoteMensal])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Pacote DRE</Label>
          <Select value={selPacote} onValueChange={setSelPacote}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {pacotes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Período</Label>
          <RadioGroup className="flex h-10 items-center gap-6" value={tipoPeriodo} onValueChange={v => setTipoPeriodo(v as 'Mensal' | 'Acumulado')}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="Mensal" id="periodo-mensal" />
              <Label htmlFor="periodo-mensal" className="font-normal">Mensal</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="Acumulado" id="periodo-acumulado" />
              <Label htmlFor="periodo-acumulado" className="font-normal">Acumulado</Label>
            </div>
          </RadioGroup>
        </div>

        {tipoPeriodo === 'Mensal' && (
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Select value={String(selMes ?? '')} onValueChange={v => setSelMes(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {mesesDisponiveis.map(m => <SelectItem key={m} value={String(m)}>{MES_ABREV[m] ?? m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Top contas</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TabelaResumo titulo="Contas com estouro" contas={contasEstouro} nomesPorCodigo={nomesPorCodigo} />
          <TabelaResumo titulo="Contas com economia" contas={contasEconomia} nomesPorCodigo={nomesPorCodigo} />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Detalhamento mensal</h3>
        {detalheMensal.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta com movimento neste pacote.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {detalheMensal.map(d => (
              <TabelaDetalheConta key={d.codigo} detalhe={d} nome={nomesPorCodigo.get(d.codigo) ?? d.codigo} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
