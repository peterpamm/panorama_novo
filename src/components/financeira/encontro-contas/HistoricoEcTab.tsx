import { useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { FiltrosEcBar } from './FiltrosEcBar'
import { cn, formatCurrency } from '@/lib/utils'
import { FILTROS_EC_INICIAL, STATUS_LABEL, STATUS_PILL, anosComEc, filtrarEcs, formatDataBr, type FiltrosEcValues } from '@/lib/encontro-contas'
import type { EncontroContas, EncontroContasMotivo, Unidade } from '@/types'

interface HistoricoEcTabProps {
  ecs: EncontroContas[]
  unidades: Unidade[]
  motivos: EncontroContasMotivo[]
  loading: boolean
}

/** Histórico (Etapa 6): só os ECs já validados (os outros ficam em Tratativas até serem validados) — filtros iguais aos de Tratativas, inclusive "validados por mim". */
export function HistoricoEcTab({ ecs, unidades, motivos, loading }: HistoricoEcTabProps) {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const validados = useMemo(() => ecs.filter(e => e.status === 'validado'), [ecs])
  const [filtros, setFiltros] = useState<FiltrosEcValues>(FILTROS_EC_INICIAL)
  const onChange = (patch: Partial<FiltrosEcValues>) => setFiltros(f => ({ ...f, ...patch }))

  const filtrados = useMemo(() => filtrarEcs(validados, filtros, user?.email), [validados, filtros, user])
  const anos = useMemo(() => anosComEc(validados), [validados])

  return (
    <div className="space-y-6">
      <FiltrosEcBar
        valores={filtros}
        onChange={onChange}
        unidades={unidades}
        motivos={motivos}
        anos={anos}
        isAdmin={isAdmin}
        mostrarStatus={false}
        idCheckbox="ec-historico-validados-por-mim"
      />

      <TableCard titulo="Histórico" subtitulo={loading ? 'Carregando...' : `${filtrados.length} EC(s) validado(s)`}>
        {loading ? null : filtrados.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum EC validado com esses filtros.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Data</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Chamado</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead>Validado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map(ec => (
                <TableRow key={ec.id} className="border-gray-200/30 dark:border-gray-700/30">
                  <TableCell className="text-sm text-muted-foreground">{formatDataBr(ec.data)}</TableCell>
                  <TableCell className="text-sm">{ec.unidade ? (nomesUnidades.get(ec.unidade) ?? ec.unidade) : '—'}</TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">{formatCurrency(ec.valor)}</TableCell>
                  <TableCell className="text-sm">
                    <div>{ec.numero_chamado}</div>
                    <div className="text-xs text-muted-foreground">{ec.solicitante}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ec.motivo || '—'}</TableCell>
                  <TableCell>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_PILL[ec.status])}>
                      {STATUS_LABEL[ec.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ec.validado_por_email ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </div>
  )
}
