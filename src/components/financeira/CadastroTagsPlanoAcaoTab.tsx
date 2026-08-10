import { useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePlanoAcaoTags } from '@/hooks/usePlanosAcao'
import { SDG_INDICADORES } from '@/lib/sdg-indicadores'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { PlanoAcaoTag, SdgIndicador } from '@/types'

const SEM_VINCULO = '__nenhum__'
const FORM_INICIAL = { nome: '', ordem: '0', sdgIndicador: SEM_VINCULO }

/**
 * Cadastro das tags do Plano de Ação — catálogo padrão (substitui o texto
 * livre de antes). Uma tag pode se ligar a um dos 5 indicadores do SDG
 * (`sdg_indicador`): quando ligada, as ações ativas com essa tag aparecem no
 * slide daquele indicador no modo apresentação.
 */
export function CadastroTagsPlanoAcaoTab() {
  const { toast } = useToast()
  const { tags, loading, recarregar } = usePlanoAcaoTags()

  const [editando, setEditando] = useState<PlanoAcaoTag | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [dialogAberto, setDialogAberto] = useState(false)

  function abrirNova() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setDialogAberto(true)
  }

  function abrirEdicao(t: PlanoAcaoTag) {
    setEditando(t)
    setForm({ nome: t.nome, ordem: String(t.ordem), sdgIndicador: t.sdg_indicador ?? SEM_VINCULO })
    setDialogAberto(true)
  }

  async function handleSalvar() {
    const nome = form.nome.trim()
    if (!nome) {
      toast({ title: 'Preencha o nome da tag', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const payload = {
      nome,
      ordem: Number(form.ordem) || 0,
      sdg_indicador: form.sdgIndicador === SEM_VINCULO ? null : (form.sdgIndicador as SdgIndicador),
    }
    const { error } = editando
      ? await supabase.from('planos_acao_tags').update(payload).eq('id', editando.id)
      : await supabase.from('planos_acao_tags').insert({ ...payload, ativo: true })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar tag', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: editando ? 'Tag atualizada' : 'Tag cadastrada' })
    setDialogAberto(false)
    await recarregar()
  }

  async function toggleAtivo(t: PlanoAcaoTag) {
    const { error } = await supabase.from('planos_acao_tags').update({ ativo: !t.ativo }).eq('id', t.id)
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' })
      return
    }
    await recarregar()
  }

  const [excluindo, setExcluindo] = useState<PlanoAcaoTag | null>(null)
  const [excluindoSalvando, setExcluindoSalvando] = useState(false)

  async function handleExcluir() {
    if (!excluindo) return
    setExcluindoSalvando(true)
    const { error } = await supabase.from('planos_acao_tags').delete().eq('id', excluindo.id)
    setExcluindoSalvando(false)
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Tag excluída' })
    setExcluindo(null)
    await recarregar()
  }

  const labelIndicador = (id: SdgIndicador | null) => id ? (SDG_INDICADORES.find(i => i.id === id)?.label ?? id) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="max-w-xl text-sm text-muted-foreground">
          Tags padronizadas do Plano de Ação. Vincular a um indicador do SDG faz as ações ativas com essa tag
          aparecerem no slide daquele indicador na apresentação.
        </p>
        <Button onClick={abrirNova} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova tag
        </Button>
      </div>

      <TableCard titulo="Tags cadastradas" subtitulo={loading ? 'Carregando...' : `${tags.length} tag(s)`}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : tags.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma tag cadastrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Indicador do SDG</TableHead>
                <TableHead className="w-20 text-center">Ordem</TableHead>
                <TableHead className="w-28 text-center">Status</TableHead>
                <TableHead className="w-24 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map(t => (
                <TableRow key={t.id} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className={cn('text-sm', !t.ativo && 'text-muted-foreground line-through')}>{t.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {labelIndicador(t.sdg_indicador) ?? <span className="italic">Sem vínculo</span>}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums text-muted-foreground">{t.ordem}</TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => toggleAtivo(t)}
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
                        t.ativo
                          ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground hover:bg-muted/70',
                      )}
                      title="Clique pra ativar/desativar"
                    >
                      {t.ativo ? 'Ativa' : 'Inativa'}
                    </button>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => abrirEdicao(t)} aria-label={`Editar ${t.nome}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400" onClick={() => setExcluindo(t)} aria-label={`Excluir ${t.nome}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar tag' : 'Nova tag'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tag-nome">Nome</Label>
              <Input id="tag-nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Custos, Processo..." />
            </div>
            <div className="space-y-1.5">
              <Label>Indicador do SDG (opcional)</Label>
              <Select value={form.sdgIndicador} onValueChange={v => setForm(f => ({ ...f, sdgIndicador: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_VINCULO}>Sem vínculo</SelectItem>
                  {SDG_INDICADORES.map(i => <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tag-ordem">Ordem</Label>
              <Input id="tag-ordem" type="number" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={excluindo !== null} onOpenChange={v => { if (!v) setExcluindo(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir tag</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remover <span className="font-semibold text-foreground">{excluindo?.nome}</span>? Ações já criadas com essa
            tag mantêm o texto, só não vai mais aparecer nesse cadastro. Se é só pra parar de usar daqui pra frente,
            prefira desativar em vez de excluir.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)} disabled={excluindoSalvando}>Cancelar</Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={excluindoSalvando} className="gap-2">
              {excluindoSalvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
