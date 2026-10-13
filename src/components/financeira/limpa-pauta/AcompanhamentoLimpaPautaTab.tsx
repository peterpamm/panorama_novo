import { useMemo, useState } from 'react'
import { FilterLabel } from '@/components/farol/FarolFilters'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn, formatCurrency } from '@/lib/utils'
import { alcadaAtualLimpaPauta, STATUS_APROVACAO_LABEL, STATUS_APROVACAO_PILL, statusAtualLimpaPauta } from '@/lib/limpa-pauta'
import { ColunaOrdenavel } from './ColunaOrdenavel'
import { LimpaPautaDetalhe } from './LimpaPautaDetalhe'
import type { LimpaPauta, Unidade } from '@/types'

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const TODAS_UNIDADES = '__todas__'
const TODOS_SEGMENTOS = '__todos__'

type ColunaAcompanhamento = 'segmento' | 'unidade' | 'categoria' | 'status' | 'valorSolicitado' | 'valorPago' | 'pagamento'

interface AcompanhamentoLimpaPautaTabProps {
  registros: LimpaPauta[]
  unidades: Unidade[]
  loading: boolean
  onAtualizado: () => void
  /** Só admin edita o detalhe (aprovações/Observação/Pagamento) — qualquer usuário logado pode abrir e ler. */
  isAdmin: boolean
  selUnidade: string
  onUnidadeChange: (v: string) => void
  selAno: number
  onAnoChange: (v: number) => void
  anosOpcoes: number[]
  selMes: number
  onMesChange: (v: number) => void
}

/**
 * Aba Acompanhamento do Limpa Pauta — barra de filtro (Unidade, com opção
 * "Todas as unidades"/Segmento/Mês/Ano) + lista das linhas importadas
 * (Segmento/Unidade/Categoria/Status/Valor solicitado). Qualquer usuário
 * logado pode abrir uma linha pra ler (leitura liberada geral,
 * migration_129) — só admin edita de verdade dentro do detalhe (ver
 * `isAdmin` em `LimpaPautaDetalhe`). Passar o mouse na pílula de Status
 * mostra, sem precisar abrir, qual alçada decidiu (GOD/GEO/RPO) e a
 * justificativa que ela escreveu — ou "Nenhuma ação até o momento" quando
 * ainda está Em Análise (ver `alcadaAtualLimpaPauta`). O filtro de Segmento
 * é local (as opções vêm dos próprios `registros`), diferente de Unidade/
 * Mês/Ano, que ficam no componente pai pra também valerem na Importação.
 */
export function AcompanhamentoLimpaPautaTab({
  registros, unidades, loading, onAtualizado, isAdmin,
  selUnidade, onUnidadeChange, selAno, onAnoChange, anosOpcoes, selMes, onMesChange,
}: AcompanhamentoLimpaPautaTabProps) {
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])
  const segmentos = useMemo(() => Array.from(new Set(registros.map(r => r.segmento))).sort(), [registros])
  const [selSegmento, setSelSegmento] = useState(TODOS_SEGMENTOS)

  const filtrados = useMemo(
    () => registros.filter(r =>
      (selUnidade === TODAS_UNIDADES || r.unidade === selUnidade)
      && (selSegmento === TODOS_SEGMENTOS || r.segmento === selSegmento)
      && r.ano === selAno && r.mes === selMes,
    ),
    [registros, selUnidade, selSegmento, selAno, selMes],
  )

  const [colunaOrdenada, setColunaOrdenada] = useState<ColunaAcompanhamento>('valorSolicitado')
  const [ordemAsc, setOrdemAsc] = useState(false)

  function alternarOrdenacao(coluna: ColunaAcompanhamento) {
    if (coluna === colunaOrdenada) setOrdemAsc(v => !v)
    else { setColunaOrdenada(coluna); setOrdemAsc(coluna !== 'valorSolicitado' && coluna !== 'valorPago') }
  }

  function chaveOrdenacao(r: LimpaPauta): string | number {
    switch (colunaOrdenada) {
      case 'segmento': return r.segmento
      case 'unidade': return nomesUnidades.get(r.unidade) ?? r.unidade
      case 'categoria': return r.categoria
      case 'status': return STATUS_APROVACAO_LABEL[statusAtualLimpaPauta(r)]
      case 'valorSolicitado': return r.valor_solicitado
      case 'valorPago': return r.valor_pago
      case 'pagamento': return (r.ano_pagamento ?? -1) * 100 + (r.mes_pagamento ?? -1)
    }
  }

  const ordenados = useMemo(() => {
    const copia = [...filtrados]
    copia.sort((a, b) => {
      const chaveA = chaveOrdenacao(a)
      const chaveB = chaveOrdenacao(b)
      const cmp = typeof chaveA === 'number' && typeof chaveB === 'number' ? chaveA - chaveB : String(chaveA).localeCompare(String(chaveB))
      return ordemAsc ? cmp : -cmp
    })
    return copia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, colunaOrdenada, ordemAsc])

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const selecionado = ordenados.find(r => r.id === selecionadoId) ?? null

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[hsl(222,45%,20%)] to-[hsl(222,35%,30%)] shadow-xl shadow-blue-900/20 dark:from-[hsl(224,28%,14%)] dark:to-[hsl(224,22%,20%)]">
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-4 md:p-6">
          <div className="space-y-1.5">
            <FilterLabel>Unidade</FilterLabel>
            <Select value={selUnidade} onValueChange={onUnidadeChange}>
              <SelectTrigger className="border-white/20 bg-white/10 text-white hover:bg-white/20 focus:ring-white/30">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="border border-gray-200/30 bg-white/90 backdrop-blur-xl dark:border-gray-700/30 dark:bg-gray-800/90">
                <SelectItem value={TODAS_UNIDADES}>Todas as unidades</SelectItem>
                {unidades.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FilterLabel>Segmento</FilterLabel>
            <Select value={selSegmento} onValueChange={setSelSegmento}>
              <SelectTrigger className="border-white/20 bg-white/10 text-white hover:bg-white/20 focus:ring-white/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border border-gray-200/30 bg-white/90 backdrop-blur-xl dark:border-gray-700/30 dark:bg-gray-800/90">
                <SelectItem value={TODOS_SEGMENTOS}>Todos os segmentos</SelectItem>
                {segmentos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FilterLabel>Mês</FilterLabel>
            <Select value={String(selMes)} onValueChange={v => onMesChange(Number(v))}>
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
            <Select value={String(selAno)} onValueChange={v => onAnoChange(Number(v))}>
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
        <TableCard titulo="Limpa Pauta" subtitulo={`${ordenados.length} linha(s)`}>
          {ordenados.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma linha importada com esses filtros.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><ColunaOrdenavel coluna="segmento" colunaAtual={colunaOrdenada} onClick={alternarOrdenacao}>Segmento</ColunaOrdenavel></TableHead>
                  <TableHead><ColunaOrdenavel coluna="unidade" colunaAtual={colunaOrdenada} onClick={alternarOrdenacao}>Unidade</ColunaOrdenavel></TableHead>
                  <TableHead><ColunaOrdenavel coluna="categoria" colunaAtual={colunaOrdenada} onClick={alternarOrdenacao}>Categoria</ColunaOrdenavel></TableHead>
                  <TableHead><ColunaOrdenavel coluna="status" colunaAtual={colunaOrdenada} onClick={alternarOrdenacao}>Status</ColunaOrdenavel></TableHead>
                  <TableHead className="text-right"><ColunaOrdenavel coluna="valorSolicitado" colunaAtual={colunaOrdenada} onClick={alternarOrdenacao}>Valor solicitado</ColunaOrdenavel></TableHead>
                  <TableHead className="text-right"><ColunaOrdenavel coluna="valorPago" colunaAtual={colunaOrdenada} onClick={alternarOrdenacao}>Valor pago</ColunaOrdenavel></TableHead>
                  <TableHead><ColunaOrdenavel coluna="pagamento" colunaAtual={colunaOrdenada} onClick={alternarOrdenacao}>Pagamento</ColunaOrdenavel></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordenados.map(r => (
                  <TableRow key={r.id} onClick={() => setSelecionadoId(r.id)} className="cursor-pointer">
                    <TableCell className="text-sm text-muted-foreground">{r.segmento}</TableCell>
                    <TableCell className="text-sm">{nomesUnidades.get(r.unidade) ?? r.unidade}</TableCell>
                    <TableCell className="text-sm">{r.categoria}</TableCell>
                    <TableCell>
                      <Tooltip delayDuration={200}>
                        <TooltipTrigger asChild>
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_APROVACAO_PILL[statusAtualLimpaPauta(r)])}>
                            {STATUS_APROVACAO_LABEL[statusAtualLimpaPauta(r)]}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {(() => {
                            const alcada = alcadaAtualLimpaPauta(r)
                            if (!alcada) return 'Nenhuma ação até o momento.'
                            return `${alcada.titulo}: ${alcada.justificativa.trim() || 'sem justificativa registrada.'}`
                          })()}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">{formatCurrency(r.valor_solicitado)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{r.valor_pago > 0 ? formatCurrency(r.valor_pago) : '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.mes_pagamento && r.ano_pagamento ? `${MESES_NOMES[r.mes_pagamento - 1].slice(0, 3)}/${r.ano_pagamento}` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}

      <Dialog open={selecionado !== null} onOpenChange={v => { if (!v) setSelecionadoId(null) }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          {selecionado && <LimpaPautaDetalhe registro={selecionado} unidades={unidades} onAtualizado={onAtualizado} isAdmin={isAdmin} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
