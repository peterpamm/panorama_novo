import { useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { cn, formatCurrency, parseNumeroPtBr } from '@/lib/utils'
import { ND_LABEL, ND_PILL, STATUS_LABEL, STATUS_PILL, formatDataBr, formatDataHoraBr, statusPermitidos } from '@/lib/encontro-contas'
import { buscarHistoricoEc } from '@/hooks/useEncontroContas'
import { MotivosCadastroDialog } from './MotivosCadastroDialog'
import type { EncontroContas, EncontroContasHistorico, EncontroContasMotivo, EncontroContasStatus, Unidade } from '@/types'

interface EncontroContasDetalheProps {
  ec: EncontroContas
  isAdmin: boolean
  unidades: Unidade[]
  motivos: EncontroContasMotivo[]
  onAtualizado: () => void
  onMotivosAtualizados: () => void
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  )
}

/** Painel de detalhe de um EC — mirror de `PlanoAcaoDetalhe.tsx`. Data/Valor/Unidade/Motivo/ND/Evidência só o admin edita (UPDATE direto); Status muda só via RPC, com histórico — a Observação do Follow é o registro do que foi feito (substitui a antiga Justificativa separada). */
export function EncontroContasDetalhe({ ec, isAdmin, unidades, motivos, onAtualizado, onMotivosAtualizados }: EncontroContasDetalheProps) {
  const { unidade: minhaUnidade } = useAuth()
  const { toast } = useToast()
  const [historico, setHistorico] = useState<EncontroContasHistorico[]>([])
  const [carregandoHist, setCarregandoHist] = useState(true)
  const [novoStatus, setNovoStatus] = useState<EncontroContasStatus>(ec.status)
  const [observacao, setObservacao] = useState('')
  const [salvandoStatus, setSalvandoStatus] = useState(false)
  const [valorTexto, setValorTexto] = useState(() => ec.valor.toFixed(2).replace('.', ','))
  const [motivosDialogAberto, setMotivosDialogAberto] = useState(false)

  const podeAtualizarStatus = ec.status !== 'validado' && (isAdmin || ec.unidade === minhaUnidade)

  useEffect(() => {
    setNovoStatus(ec.status)
    setObservacao('')
    setValorTexto(ec.valor.toFixed(2).replace('.', ','))
    let cancelado = false
    setCarregandoHist(true)
    buscarHistoricoEc(ec.id).then(h => { if (!cancelado) { setHistorico(h); setCarregandoHist(false) } })
    return () => { cancelado = true }
  }, [ec.id, ec.status, ec.valor])

  async function handleSalvarStatus() {
    if (!isAdmin && !observacao.trim()) {
      toast({ title: 'Observação é obrigatória', description: 'Descreva o que foi feito ou o motivo da mudança de status.', variant: 'destructive' })
      return
    }
    setSalvandoStatus(true)
    const { error } = await supabase.rpc('registrar_status_encontro_contas', {
      p_ec_id: ec.id,
      p_novo_status: novoStatus,
      p_observacao: observacao.trim(),
    })
    setSalvandoStatus(false)
    if (error) {
      toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Status atualizado' })
    setObservacao('')
    onAtualizado()
  }

  async function handleCampoAdmin(campo: string, valor: unknown) {
    const { error } = await supabase.from('encontro_contas').update({ [campo]: valor }).eq('id', ec.id)
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return }
    onAtualizado()
  }

  async function handleSalvarValor() {
    const novoValor = parseNumeroPtBr(valorTexto)
    if (!novoValor || novoValor <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' })
      setValorTexto(ec.valor.toFixed(2).replace('.', ','))
      return
    }
    if (novoValor === ec.valor) return
    await handleCampoAdmin('valor', novoValor)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Chamado {ec.numero_chamado}
        </p>
        <h3 className="text-xl font-semibold text-foreground">{ec.solicitante}</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-3">
        <InfoItem label="Data">
          {isAdmin ? (
            <Input type="date" value={ec.data} onChange={e => handleCampoAdmin('data', e.target.value)} className="h-8 w-full text-xs" />
          ) : (
            formatDataBr(ec.data)
          )}
        </InfoItem>

        <InfoItem label="Valor">
          {isAdmin ? (
            <Input
              value={valorTexto}
              onChange={e => setValorTexto(e.target.value)}
              onBlur={handleSalvarValor}
              className="h-8 w-full text-xs"
            />
          ) : (
            formatCurrency(ec.valor)
          )}
        </InfoItem>

        <InfoItem label="Status">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_PILL[ec.status])}>
            {STATUS_LABEL[ec.status]}
          </span>
        </InfoItem>

        <InfoItem label="Unidade">
          {isAdmin ? (
            <Select value={ec.unidade ?? '__sem__'} onValueChange={v => handleCampoAdmin('unidade', v === '__sem__' ? null : v)}>
              <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__sem__">Sem unidade</SelectItem>
                {unidades.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            unidades.find(u => u.codigo === ec.unidade)?.nome ?? '—'
          )}
        </InfoItem>

        <InfoItem label="Motivo">
          {isAdmin ? (
            <div className="flex items-center gap-1">
              <Select value={ec.motivo ?? '__nenhum__'} onValueChange={v => handleCampoAdmin('motivo', v === '__nenhum__' ? null : v)}>
                <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__nenhum__">—</SelectItem>
                  {motivos.filter(m => m.ativo || m.nome === ec.motivo).map(m => (
                    <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setMotivosDialogAberto(true)} aria-label="Gerenciar motivos">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            ec.motivo || '—'
          )}
        </InfoItem>

        <InfoItem label="Nota de Débito">
          {isAdmin ? (
            <Select value={ec.nota_debito} onValueChange={v => handleCampoAdmin('nota_debito', v)}>
              <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['OK', 'NOK', 'N/A'] as const).map(v => <SelectItem key={v} value={v}>{ND_LABEL[v]}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', ND_PILL[ec.nota_debito])}>{ND_LABEL[ec.nota_debito]}</span>
          )}
        </InfoItem>

        <InfoItem label="Evidência">
          {isAdmin ? (
            <div className="flex items-center gap-1.5 pt-0.5">
              <Checkbox id="ec-evidencia" checked={ec.tem_evidencia} onCheckedChange={v => handleCampoAdmin('tem_evidencia', v === true)} />
              <Label htmlFor="ec-evidencia" className="cursor-pointer text-sm font-normal">Tem evidência (no Drive)</Label>
            </div>
          ) : (
            ec.tem_evidencia ? 'Sim' : 'Não'
          )}
        </InfoItem>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">Descrição original da planilha</p>
        <p className="whitespace-pre-wrap rounded-lg border bg-card p-3 text-sm text-muted-foreground">{ec.descricao_original}</p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Follow</p>

        {podeAtualizarStatus ? (
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <div className="space-y-1.5 sm:w-56">
              <Label>Novo status</Label>
              <Select value={novoStatus} onValueChange={v => setNovoStatus(v as EncontroContasStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusPermitidos(isAdmin).map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observação {isAdmin ? '(opcional)' : '(obrigatória)'}</Label>
              <Textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="O que foi feito, ou o motivo da mudança de status..."
                className="min-h-[110px]"
              />
            </div>
            {novoStatus === 'validado' && ec.status !== 'validado' && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Validar move esse EC pro histórico — confirme que a tratativa está correta antes.
              </p>
            )}
            <div className="flex justify-end">
              <Button onClick={handleSalvarStatus} disabled={salvandoStatus} className="gap-2">
                {salvandoStatus && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        ) : ec.status === 'validado' ? (
          <p className="text-sm text-muted-foreground">EC validado — encerrado, sem mais mudanças de status.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Só o financeiro ou a unidade responsável podem atualizar o status.</p>
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
                    {h.usuario_email ?? 'Usuário'} {h.usuario_role === 'admin' ? '(Financeiro)' : h.usuario_unidade ? `(${unidades.find(u => u.codigo === h.usuario_unidade)?.nome ?? h.usuario_unidade})` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <MotivosCadastroDialog open={motivosDialogAberto} onOpenChange={setMotivosDialogAberto} motivos={motivos} onAtualizado={onMotivosAtualizados} />
    </div>
  )
}
