import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import type { PlanoAcao, PlanoAcaoTag, Unidade } from '@/types'

const SEM_TAG = '__sem_tag__'
const FORM_INICIAL = { unidade: '', titulo: '', descricao: '', responsavel: '', tag: '', prazo: '' }

interface PlanoAcaoFormDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  editando: PlanoAcao | null
  /** Editar um plano já existente continua exclusivo do admin (o botão de editar nem aparece pra quem não é) — só CRIAR foi liberado geral. */
  isAdmin: boolean
  /** Unidade de quem está logado — trava o campo Unidade ao criar (não-admin só cria pra própria unidade, ver migration_091). */
  minhaUnidade: string | null
  unidades: Unidade[]
  /** Catálogo padrão (só as ativas, sem a tag "Corporativo" pra quem não é dono) — ver Plano de Ação > Cadastro. */
  tags: PlanoAcaoTag[]
  onSalvo: () => void
}

/**
 * Criar ação é liberado a qualquer usuário logado (cada unidade só pra ela
 * mesma — o campo Unidade vem travado nesse caso); editar um plano já
 * existente continua exclusivo do admin, já que quem abre esse dialog em
 * modo edição só chega lá pelo botão de lápis (admin-only, ver
 * PlanoAcaoDetalhe).
 */
export function PlanoAcaoFormDialog({ open, onOpenChange, editando, isAdmin, minhaUnidade, unidades, tags, onSalvo }: PlanoAcaoFormDialogProps) {
  const { user, role } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = useState(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(editando
      ? {
          unidade: editando.unidade,
          titulo: editando.titulo,
          descricao: editando.descricao,
          responsavel: editando.responsavel,
          tag: editando.tag,
          prazo: editando.prazo,
        }
      : { ...FORM_INICIAL, unidade: isAdmin ? '' : (minhaUnidade ?? '') })
  }, [open, editando, isAdmin, minhaUnidade])

  async function handleSalvar() {
    const titulo = form.titulo.trim()
    if (!form.unidade || !titulo || !form.prazo) {
      toast({ title: 'Preencha unidade, título e prazo', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const payload = {
      unidade: form.unidade,
      titulo,
      descricao: form.descricao.trim(),
      responsavel: form.responsavel.trim(),
      tag: form.tag.trim(),
      prazo: form.prazo,
    }
    const { error } = editando
      ? await supabase.from('planos_acao').update(payload).eq('id', editando.id)
      : await supabase.from('planos_acao').insert({
          ...payload,
          status: 'pendente',
          criado_por_email: user?.email ?? null,
          criado_por_role: role,
        })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar ação', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: editando ? 'Ação atualizada' : 'Ação criada' })
    onOpenChange(false)
    onSalvo()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar ação' : 'Nova ação'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={form.unidade} onValueChange={v => setForm(f => ({ ...f, unidade: v }))} disabled={!isAdmin}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map(u => (
                    <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plano-prazo">Prazo</Label>
              <Input id="plano-prazo" type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plano-titulo">Título</Label>
            <Input id="plano-titulo" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Corrigir divergência de estoque no fechamento" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plano-descricao">Descrição</Label>
            <Textarea id="plano-descricao" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes da ação (opcional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plano-responsavel">Responsável</Label>
              <Input
                id="plano-responsavel"
                value={form.responsavel}
                onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}
                placeholder="Nome de quem toca a ação"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tag</Label>
              <Select value={form.tag || SEM_TAG} onValueChange={v => setForm(f => ({ ...f, tag: v === SEM_TAG ? '' : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_TAG}>Sem tag</SelectItem>
                  {tags.map(t => (
                    <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
