import { useMemo, useState } from 'react'
import { FilterLabel } from '@/components/farol/FarolFilters'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { formatCurrency } from '@/lib/utils'
import { agruparLimpaPautaPorUnidadeSegmento, agruparLimpaPautaPorUnidadeStatus, type LinhaDashboardUnidadeSegmento, type LinhaDashboardUnidadeStatus } from '@/lib/limpa-pauta'
import { ColunaOrdenavel } from './ColunaOrdenavel'
import type { LimpaPauta, Unidade } from '@/types'

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type ColunaUnidadeSegmento = 'unidade' | 'segmento' | 'valorTotal'
type ColunaUnidadeStatus = 'unidade' | 'valorSolicitado' | 'valorAprovado' | 'valorEmAnalise' | 'valorReprovado'

/** Hook genérico de ordenação de tabela — nome em "use..." de propósito (convenção de Hooks do React), mesmo com o resto do código em português. */
function useOrdenacao<T, C extends string>(linhas: T[], chaveDe: (l: T, coluna: C) => string | number, colunaInicial: C, ascInicial: boolean) {
  const [coluna, setColuna] = useState<C>(colunaInicial)
  const [asc, setAsc] = useState(ascInicial)

  function alternar(c: C) {
    if (c === coluna) setAsc(v => !v)
    else { setColuna(c); setAsc(c === 'unidade' || c === 'segmento') }
  }

  const ordenadas = useMemo(() => {
    const copia = [...linhas]
    copia.sort((a, b) => {
      const chaveA = chaveDe(a, coluna)
      const chaveB = chaveDe(b, coluna)
      const cmp = typeof chaveA === 'number' && typeof chaveB === 'number' ? chaveA - chaveB : String(chaveA).localeCompare(String(chaveB))
      return asc ? cmp : -cmp
    })
    return copia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, coluna, asc])

  return { coluna, alternar, ordenadas }
}

interface DashboardLimpaPautaTabProps {
  registros: LimpaPauta[]
  unidades: Unidade[]
  loading: boolean
  anosOpcoes: number[]
}

/**
 * Aba Dashboard do Limpa Pauta — filtro próprio de Mês/Ano (sem Unidade,
 * já que as duas tabelas comparam unidades entre si) + 2 tabelas, cada uma
 * com coluna clicável pra ordenar (`ColunaOrdenavel`/`useOrdenacao`): valor
 * total por Unidade/Segmento, e por Unidade quebrado pelo "status atual"
 * (Solicitado/Aprovado/Em Análise/Reprovado — ver `limpa-pauta.ts`). A
 * linha "Total" no fim de cada tabela fica sempre fixa, fora da ordenação.
 */
export function DashboardLimpaPautaTab({ registros, unidades, loading, anosOpcoes }: DashboardLimpaPautaTabProps) {
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const [selAno, setSelAno] = useState(new Date().getFullYear())
  const [selMes, setSelMes] = useState(new Date().getMonth() + 1)

  const filtrados = useMemo(
    () => registros.filter(r => r.ano === selAno && r.mes === selMes),
    [registros, selAno, selMes],
  )

  const porUnidadeSegmento = useMemo(() => agruparLimpaPautaPorUnidadeSegmento(filtrados), [filtrados])
  const porUnidadeStatus = useMemo(() => agruparLimpaPautaPorUnidadeStatus(filtrados), [filtrados])

  const { coluna: colunaSegmento, alternar: alternarSegmento, ordenadas: segmentoOrdenado } = useOrdenacao<LinhaDashboardUnidadeSegmento, ColunaUnidadeSegmento>(
    porUnidadeSegmento,
    (l, c) => c === 'unidade' ? (nomesUnidades.get(l.unidade) ?? l.unidade) : l[c],
    'valorTotal',
    false,
  )
  const { coluna: colunaStatus, alternar: alternarStatus, ordenadas: statusOrdenado } = useOrdenacao<LinhaDashboardUnidadeStatus, ColunaUnidadeStatus>(
    porUnidadeStatus,
    (l, c) => c === 'unidade' ? (nomesUnidades.get(l.unidade) ?? l.unidade) : l[c],
    'valorSolicitado',
    false,
  )

  const totalSegmento = useMemo(() => porUnidadeSegmento.reduce((s, l) => s + l.valorTotal, 0), [porUnidadeSegmento])
  const totalStatus = useMemo(() => porUnidadeStatus.reduce((acc, l) => ({
    valorSolicitado: acc.valorSolicitado + l.valorSolicitado,
    valorAprovado: acc.valorAprovado + l.valorAprovado,
    valorEmAnalise: acc.valorEmAnalise + l.valorEmAnalise,
    valorReprovado: acc.valorReprovado + l.valorReprovado,
  }), { valorSolicitado: 0, valorAprovado: 0, valorEmAnalise: 0, valorReprovado: 0 }), [porUnidadeStatus])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[hsl(222,45%,20%)] to-[hsl(222,35%,30%)] shadow-xl shadow-blue-900/20 dark:from-[hsl(224,28%,14%)] dark:to-[hsl(224,22%,20%)]">
        <div className="grid grid-cols-2 gap-4 p-4 sm:max-w-md md:p-6">
          <div className="space-y-1.5">
            <FilterLabel>Mês</FilterLabel>
            <Select value={String(selMes)} onValueChange={v => setSelMes(Number(v))}>
              <SelectTrigger className="border-white/20 bg-white/10 text-white hover:bg-white/20 focus:ring-white/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border border-gray-200/30 bg-white/90 backdrop-blur-xl dark:border-gray-700/30 dark:bg-gray-800/90">
                {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FilterLabel>Ano</FilterLabel>
            <Select value={String(selAno)} onValueChange={v => setSelAno(Number(v))}>
              <SelectTrigger className="border-white/20 bg-white/10 text-white hover:bg-white/20 focus:ring-white/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border border-gray-200/30 bg-white/90 backdrop-blur-xl dark:border-gray-700/30 dark:bg-gray-800/90">
                {anosOpcoes.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <TableCard titulo="Valor total por Unidade/Segmento" subtitulo={`${porUnidadeSegmento.length} linha(s)`}>
            {porUnidadeSegmento.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma linha nessa competência.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><ColunaOrdenavel coluna="unidade" colunaAtual={colunaSegmento} onClick={alternarSegmento}>Unidade</ColunaOrdenavel></TableHead>
                    <TableHead><ColunaOrdenavel coluna="segmento" colunaAtual={colunaSegmento} onClick={alternarSegmento}>Segmento</ColunaOrdenavel></TableHead>
                    <TableHead className="text-right"><ColunaOrdenavel coluna="valorTotal" colunaAtual={colunaSegmento} onClick={alternarSegmento}>Valor total</ColunaOrdenavel></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segmentoOrdenado.map(l => (
                    <TableRow key={`${l.unidade}|${l.segmento}`}>
                      <TableCell className="text-sm">{nomesUnidades.get(l.unidade) ?? l.unidade}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.segmento}</TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">{formatCurrency(l.valorTotal)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 bg-muted/40 font-semibold">
                    <TableCell className="text-sm">Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right text-sm tabular-nums">{formatCurrency(totalSegmento)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </TableCard>

          <TableCard titulo="Valor por Unidade e status" subtitulo={`${porUnidadeStatus.length} unidade(s)`}>
            {porUnidadeStatus.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma linha nessa competência.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><ColunaOrdenavel coluna="unidade" colunaAtual={colunaStatus} onClick={alternarStatus}>Unidade</ColunaOrdenavel></TableHead>
                    <TableHead className="text-right"><ColunaOrdenavel coluna="valorSolicitado" colunaAtual={colunaStatus} onClick={alternarStatus}>Solicitado</ColunaOrdenavel></TableHead>
                    <TableHead className="text-right"><ColunaOrdenavel coluna="valorAprovado" colunaAtual={colunaStatus} onClick={alternarStatus}>Aprovado</ColunaOrdenavel></TableHead>
                    <TableHead className="text-right"><ColunaOrdenavel coluna="valorEmAnalise" colunaAtual={colunaStatus} onClick={alternarStatus}>Em Análise</ColunaOrdenavel></TableHead>
                    <TableHead className="text-right"><ColunaOrdenavel coluna="valorReprovado" colunaAtual={colunaStatus} onClick={alternarStatus}>Reprovado</ColunaOrdenavel></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusOrdenado.map(l => (
                    <TableRow key={l.unidade}>
                      <TableCell className="text-sm">{nomesUnidades.get(l.unidade) ?? l.unidade}</TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">{formatCurrency(l.valorSolicitado)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(l.valorAprovado)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-amber-700 dark:text-amber-400">{formatCurrency(l.valorEmAnalise)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-red-700 dark:text-red-400">{formatCurrency(l.valorReprovado)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 bg-muted/40 font-semibold">
                    <TableCell className="text-sm">Total</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatCurrency(totalStatus.valorSolicitado)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(totalStatus.valorAprovado)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-amber-700 dark:text-amber-400">{formatCurrency(totalStatus.valorEmAnalise)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-red-700 dark:text-red-400">{formatCurrency(totalStatus.valorReprovado)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </TableCard>
        </div>
      )}
    </div>
  )
}
