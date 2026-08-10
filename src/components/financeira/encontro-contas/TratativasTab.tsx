import { useEffect, useMemo, useState } from 'react'
import { Loader2, Split } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { cn, formatCurrency } from '@/lib/utils'
import { FILTROS_EC_INICIAL, ND_LABEL, ND_PILL, STATUS_LABEL, STATUS_PILL, anosComEc, filtrarEcs, formatDataBr, type FiltrosEcValues } from '@/lib/encontro-contas'
import { EncontroContasDetalhe } from './EncontroContasDetalhe'
import { DesmembrarDialog } from './DesmembrarDialog'
import { FiltrosEcBar } from './FiltrosEcBar'
import type { EncontroContas, EncontroContasMotivo, Unidade } from '@/types'

interface TratativasTabProps {
  ecs: EncontroContas[]
  unidades: Unidade[]
  motivos: EncontroContasMotivo[]
  isAdmin: boolean
  loading: boolean
  onAtualizado: () => void
  onMotivosAtualizados: () => void
}

/** Tratativas (Etapa 5): tabela compacta dos ECs ainda não validados — clique numa linha abre o detalhe completo; "Desmembrar" (admin) divide um EC entre unidades. ECs validados saem daqui e aparecem só em Histórico. */
export function TratativasTab({ ecs, unidades, motivos, isAdmin, loading, onAtualizado, onMotivosAtualizados }: TratativasTabProps) {
  const { user } = useAuth()
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])
  const ativos = useMemo(() => ecs.filter(e => e.status !== 'validado'), [ecs])

  const [filtros, setFiltros] = useState<FiltrosEcValues>(FILTROS_EC_INICIAL)
  const onChangeFiltros = (patch: Partial<FiltrosEcValues>) => setFiltros(f => ({ ...f, ...patch }))
  const filtrados = useMemo(() => filtrarEcs(ativos, filtros, user?.email), [ativos, filtros, user])
  const anos = useMemo(() => anosComEc(ativos), [ativos])

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [desmembrando, setDesmembrando] = useState<EncontroContas | null>(null)

  useEffect(() => {
    if (selecionadoId && !ativos.some(e => e.id === selecionadoId)) setSelecionadoId(null)
  }, [ativos, selecionadoId])

  const selecionado = ativos.find(e => e.id === selecionadoId) ?? null

  return (
    <div className="space-y-6">
      <FiltrosEcBar
        valores={filtros}
        onChange={onChangeFiltros}
        unidades={unidades}
        motivos={motivos}
        anos={anos}
        isAdmin={isAdmin}
        idCheckbox="ec-tratativas-validados-por-mim"
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : (
        <TableCard titulo="Tratativas" subtitulo={`${filtrados.length} EC(s) em aberto`}>
          {filtrados.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhum EC em aberto com esses filtros.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Data</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Chamado</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-24">ND</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                  {isAdmin && <TableHead className="w-16 text-center">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map(ec => (
                  <TableRow key={ec.id} onClick={() => setSelecionadoId(ec.id)} className="cursor-pointer">
                    <TableCell className="text-sm text-muted-foreground">{formatDataBr(ec.data)}</TableCell>
                    <TableCell className="text-sm">
                      {ec.unidade ? (nomesUnidades.get(ec.unidade) ?? ec.unidade) : (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          Sem unidade
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">{formatCurrency(ec.valor)}</TableCell>
                    <TableCell className="text-sm">
                      <div>{ec.numero_chamado}</div>
                      <div className="text-xs text-muted-foreground">{ec.solicitante}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ec.motivo || '—'}</TableCell>
                    <TableCell>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', ND_PILL[ec.nota_debito])}>
                        {ND_LABEL[ec.nota_debito]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_PILL[ec.status])}>
                        {STATUS_LABEL[ec.status]}
                      </span>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-center">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={e => { e.stopPropagation(); setDesmembrando(ec) }}
                          aria-label={`Desmembrar chamado ${ec.numero_chamado}`}
                          title="Desmembrar entre unidades"
                        >
                          <Split className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}

      <Dialog open={selecionado !== null} onOpenChange={v => { if (!v) setSelecionadoId(null) }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          {selecionado && (
            <EncontroContasDetalhe
              ec={selecionado}
              isAdmin={isAdmin}
              unidades={unidades}
              motivos={motivos}
              onAtualizado={onAtualizado}
              onMotivosAtualizados={onMotivosAtualizados}
            />
          )}
        </DialogContent>
      </Dialog>

      <DesmembrarDialog ec={desmembrando} unidades={unidades} onOpenChange={v => { if (!v) setDesmembrando(null) }} onDesmembrado={onAtualizado} />
    </div>
  )
}
