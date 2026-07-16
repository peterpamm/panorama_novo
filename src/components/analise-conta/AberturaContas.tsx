import { useEffect, useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PillToggle } from '@/components/ui/pill-toggle'
import { selectGlamour } from '@/components/ui/field-styles'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
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

// Cor sólida (equivalente ao início do gradiente navy) pros th sticky, que precisam
// de fundo próprio ao rolar dentro do container com scroll.
const stickyTh = 'sticky top-0 z-10 h-9 py-1.5 bg-[hsl(222,45%,20%)] dark:bg-[hsl(224,28%,14%)]'

function TabelaResumo({ titulo, contas, nomesPorCodigo }: TabelaResumoProps) {
  return (
    <TableCard titulo={titulo} subtitulo={`${contas.length} contas`}>
      {contas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma conta</p>
      ) : (
        <div className="max-h-[368px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={stickyTh}>Conta</TableHead>
                <TableHead className={cn(stickyTh, 'text-center')}>Remunerado</TableHead>
                <TableHead className={cn(stickyTh, 'text-center')}>Realizado</TableHead>
                <TableHead className={cn(stickyTh, 'text-center')}>Gap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contas.map(c => (
                <TableRow key={c.codigo} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="max-w-[180px] truncate px-3 py-1.5 text-xs font-medium">{nomesPorCodigo.get(c.codigo) ?? c.codigo}</TableCell>
                  <TableCell className="px-3 py-1.5 text-center text-xs">{formatCurrencyCompact(c.remunerado)}</TableCell>
                  <TableCell className="px-3 py-1.5 text-center text-xs">{formatCurrencyCompact(c.realizado)}</TableCell>
                  <TableCell className={cn('px-3 py-1.5 text-center text-xs font-medium', TEXTO[corClasseGap(c.gap)])}>
                    {formatCurrencyCompact(c.gap)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </TableCard>
  )
}

function TabelaDetalheConta({ detalhe, nome }: { detalhe: AberturaContaDetalhe; nome: string }) {
  return (
    <TableCard titulo={nome} subtitulo="Detalhamento mensal">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mês</TableHead>
            <TableHead className="text-center">Remunerado</TableHead>
            <TableHead className="text-center">Realizado</TableHead>
            <TableHead className="text-center">Gap</TableHead>
            <TableHead className="text-center">AVR</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {detalhe.meses.map(m => (
            <TableRow key={m.mes} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
              <TableCell className="text-xs font-medium">{MES_ABREV[m.mes] ?? m.mes}</TableCell>
              <TableCell className="text-center text-xs">{formatCurrencyCompact(m.remunerado)}</TableCell>
              <TableCell className="text-center text-xs">{formatCurrencyCompact(m.realizado)}</TableCell>
              <TableCell className={cn('text-center text-xs font-medium', TEXTO[corClasseGap(m.gap)])}>
                {formatCurrencyCompact(m.gap)}
              </TableCell>
              <TableCell className="text-center text-xs">{formatPercent(m.avr, 1)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-semibold">
            <TableCell className="text-xs">TOTAL</TableCell>
            <TableCell className="text-center text-xs">{formatCurrencyCompact(detalhe.total.remunerado)}</TableCell>
            <TableCell className="text-center text-xs">{formatCurrencyCompact(detalhe.total.realizado)}</TableCell>
            <TableCell className={cn('text-center text-xs', TEXTO[corClasseGap(detalhe.total.gap)])}>
              {formatCurrencyCompact(detalhe.total.gap)}
            </TableCell>
            <TableCell className="text-center text-xs">{formatPercent(detalhe.total.avr, 1)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableCard>
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
            <SelectTrigger className={selectGlamour}><SelectValue /></SelectTrigger>
            <SelectContent>
              {pacotes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Período</Label>
          <div>
            <PillToggle
              opcoes={[
                { value: 'Mensal',    label: 'Mensal'    },
                { value: 'Acumulado', label: 'Acumulado' },
              ] as const}
              value={tipoPeriodo}
              onChange={setTipoPeriodo}
            />
          </div>
        </div>

        {tipoPeriodo === 'Mensal' && (
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Select value={String(selMes ?? '')} onValueChange={v => setSelMes(Number(v))}>
              <SelectTrigger className={selectGlamour}><SelectValue /></SelectTrigger>
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
