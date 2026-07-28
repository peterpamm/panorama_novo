import { useEffect, useState } from 'react'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  STATUS_LABEL, STATUS_PILL, estaAtrasado, formatDataBr, formatDataHoraBr, statusPermitidos,
} from '@/lib/plano-acao'
import { buscarHistoricoPlano } from '@/hooks/usePlanosAcao'
import type { PlanoAcao, PlanoAcaoHistorico, PlanoAcaoStatus } from '@/types'

interface PlanoAcaoDetalheProps {
  plano: PlanoAcao
  isAdmin: boolean
  nomesUnidades: Record<string, string>
  onAtualizado: () => void
  onEditar: () => void
  onExcluir: () => void
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  )
}

export function PlanoAcaoDetalhe({ plano, isAdmin, nomesUnidades, onAtualizado, onEditar, onExcluir }: PlanoAcaoDetalheProps) {
  const { unidade: minhaUnidade } = useAuth()
  const { toast } = useToast()
  const [historico, setHistorico] = useState<PlanoAcaoHistorico[]>([])
  const [carregandoHist, setCarregandoHist] = useState(true)
  const [novoStatus, setNovoStatus] = useState<PlanoAcaoStatus>(plano.status)
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  const podeAtualizarStatus = plano.status !== 'validado' && (isAdmin || plano.unidade === minhaUnidade)

  useEffect(() => {
    setNovoStatus(plano.status)
    setObservacao('')
    let cancelado = false
    setCarregandoHist(true)
    buscarHistoricoPlano(plano.id).then(h => { if (!cancelado) { setHistorico(h); setCarregandoHist(false) } })
    return () => { cancelado = true }
  }, [plano.id, plano.status])

  async function handleSalvarStatus() {
    if (!observacao.trim()) {
      toast({ title: 'Observação é obrigatória', description: 'Descreva o que foi feito ou o motivo da mudança de status.', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const { error } = await supabase.rpc('registrar_status_plano_acao', {
      p_plano_id: plano.id,
      p_novo_status: novoStatus,
      p_observacao: observacao.trim(),
    })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Status atualizado' })
    setObservacao('')
    onAtualizado()
  }

  const atrasado = estaAtrasado(plano.prazo, plano.status)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 pr-8">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {nomesUnidades[plano.unidade] ?? plano.unidade}
          </p>
          <h3 className="text-xl font-semibold text-foreground">{plano.titulo}</h3>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onEditar} aria-label="Editar ação">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400" onClick={onExcluir} aria-label="Excluir ação">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
        <InfoItem label="Unidade">{nomesUnidades[plano.unidade] ?? plano.unidade}</InfoItem>
        <InfoItem label="Responsável">{plano.responsavel || '—'}</InfoItem>
        <InfoItem label="Status">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_PILL[plano.status])}>
            {STATUS_LABEL[plano.status]}
          </span>
        </InfoItem>
        <InfoItem label="Prazo">
          <span className={cn(atrasado && 'font-semibold text-red-600 dark:text-red-400')}>
            {formatDataBr(plano.prazo)}{atrasado && ' (atrasado)'}
          </span>
        </InfoItem>
        <InfoItem label="Tag">
          {plano.tag ? (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{plano.tag}</span>
          ) : '—'}
        </InfoItem>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">Detalhes</p>
        <p className="whitespace-pre-wrap rounded-lg border bg-card p-3 text-sm text-foreground">
          {plano.descricao || 'Sem detalhes cadastrados.'}
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Follow</p>

        {podeAtualizarStatus ? (
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <div className="space-y-1.5 sm:w-56">
              <Label>Novo status</Label>
              <Select value={novoStatus} onValueChange={v => setNovoStatus(v as PlanoAcaoStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusPermitidos(isAdmin).map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observação (obrigatória)</Label>
              <Textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="O que foi feito, ou o motivo da mudança de status..."
                className="min-h-[110px]"
              />
            </div>
            {novoStatus === 'validado' && plano.status !== 'validado' && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Validar move essa ação pro histórico — confirme que a resolução está correta antes.
              </p>
            )}
            <div className="flex justify-end">
              <Button onClick={handleSalvarStatus} disabled={salvando} className="gap-2">
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        ) : plano.status === 'validado' ? (
          <p className="text-sm text-muted-foreground">Ação validada — encerrada, sem mais mudanças de status.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Só o time financeiro ou a unidade responsável podem atualizar o status.</p>
        )}

        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Histórico</p>
          {carregandoHist ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma mudança de status registrada ainda.</p>
          ) : (
            <ul className="space-y-3">
              {historico.map(h => (
                <li key={h.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <span className={cn('rounded-full px-2 py-0.5 font-semibold', STATUS_PILL[h.status_anterior])}>{STATUS_LABEL[h.status_anterior]}</span>
                    →
                    <span className={cn('rounded-full px-2 py-0.5 font-semibold', STATUS_PILL[h.status_novo])}>{STATUS_LABEL[h.status_novo]}</span>
                    <span className="ml-auto">{formatDataHoraBr(h.created_at)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-foreground">{h.observacao}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {h.usuario_email ?? 'Usuário'} {h.usuario_role === 'admin' ? '(Financeiro)' : h.usuario_unidade ? `(${nomesUnidades[h.usuario_unidade] ?? h.usuario_unidade})` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
