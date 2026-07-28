import { useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { RotinaFinanceira } from '@/types'

const FORM_INICIAL = { setor: '', nome: '', prazo: '', ordem: '0' }

/**
 * Cadastro das rotinas financeiras — nome e prazo editáveis livremente, sem
 * afetar o histórico já preenchido no Acompanhamento (que referencia a rotina
 * por id, não por texto). Desativar (em vez de excluir) tira a rotina da
 * matriz de meses futuros mas preserva o que já foi respondido.
 */
export function CadastroRotinasTab() {
  const { toast } = useToast()
  const [rotinas, setRotinas] = useState<RotinaFinanceira[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase.from('rotinas_financeiras').select('*').order('setor').order('ordem')
    if (error) toast({ title: 'Erro ao carregar rotinas', description: error.message, variant: 'destructive' })
    setRotinas((data as RotinaFinanceira[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [editando, setEditando] = useState<RotinaFinanceira | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [dialogAberto, setDialogAberto] = useState(false)

  function abrirNova() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setDialogAberto(true)
  }

  function abrirEdicao(r: RotinaFinanceira) {
    setEditando(r)
    setForm({ setor: r.setor, nome: r.nome, prazo: r.prazo, ordem: String(r.ordem) })
    setDialogAberto(true)
  }

  async function handleSalvar() {
    const setor = form.setor.trim()
    const nome = form.nome.trim()
    if (!setor || !nome) {
      toast({ title: 'Preencha setor e nome da rotina', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const payload = { setor, nome, prazo: form.prazo.trim(), ordem: Number(form.ordem) || 0 }
    const { error } = editando?.id
      ? await supabase.from('rotinas_financeiras').update(payload).eq('id', editando.id)
      : await supabase.from('rotinas_financeiras').insert({ ...payload, ativo: true })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar rotina', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: editando ? 'Rotina atualizada' : 'Rotina cadastrada' })
    setDialogAberto(false)
    await carregar()
  }

  async function toggleAtivo(r: RotinaFinanceira) {
    const { error } = await supabase.from('rotinas_financeiras').update({ ativo: !r.ativo }).eq('id', r.id)
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' })
      return
    }
    await carregar()
  }

  const [excluindo, setExcluindo] = useState<RotinaFinanceira | null>(null)
  const [excluindoSalvando, setExcluindoSalvando] = useState(false)

  async function handleExcluir() {
    if (!excluindo?.id) return
    setExcluindoSalvando(true)
    const { error } = await supabase.from('rotinas_financeiras').delete().eq('id', excluindo.id)
    setExcluindoSalvando(false)
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: `Rotina excluída`, description: 'O acompanhamento já respondido pra ela também foi removido.' })
    setExcluindo(null)
    await carregar()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="max-w-xl text-sm text-muted-foreground">
          Setor agrupa as rotinas na matriz de acompanhamento (ex: OCs, Multas, Fechamentos, Vales).
          Prazo é texto livre, só pra referência (ex: "Dia 10", "4º dia útil").
        </p>
        <Button onClick={abrirNova} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova rotina
        </Button>
      </div>

      <TableCard
        titulo="Rotinas cadastradas"
        subtitulo={carregando ? 'Carregando...' : `${rotinas.length} rotina(s)`}
      >
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : rotinas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma rotina cadastrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setor</TableHead>
                <TableHead>Rotina</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead className="w-20 text-center">Ordem</TableHead>
                <TableHead className="w-28 text-center">Status</TableHead>
                <TableHead className="w-24 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rotinas.map(r => (
                <TableRow key={r.id} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="text-sm font-medium">{r.setor}</TableCell>
                  <TableCell className={cn('text-sm', !r.ativo && 'text-muted-foreground line-through')}>{r.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.prazo || '—'}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums text-muted-foreground">{r.ordem}</TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => toggleAtivo(r)}
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
                        r.ativo
                          ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground hover:bg-muted/70',
                      )}
                      title="Clique pra ativar/desativar"
                    >
                      {r.ativo ? 'Ativa' : 'Inativa'}
                    </button>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => abrirEdicao(r)} aria-label={`Editar ${r.nome}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400" onClick={() => setExcluindo(r)} aria-label={`Excluir ${r.nome}`}>
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
            <DialogTitle>{editando ? 'Editar rotina' : 'Nova rotina'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rotina-setor">Setor</Label>
              <Input id="rotina-setor" value={form.setor} onChange={e => setForm(f => ({ ...f, setor: e.target.value }))} placeholder="OCs, Multas, Fechamentos..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rotina-nome">Rotina</Label>
              <Input id="rotina-nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Planilha de OCs do armazém anexada no drive?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rotina-prazo">Prazo</Label>
                <Input id="rotina-prazo" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} placeholder="Dia 10 / 4º dia útil" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rotina-ordem">Ordem</Label>
                <Input id="rotina-ordem" type="number" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: e.target.value }))} />
              </div>
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
            <DialogTitle>Excluir rotina</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remover <span className="font-semibold text-foreground">{excluindo?.nome}</span>? Isso também apaga todo o
            acompanhamento (OK/NOK) já respondido pra ela em todos os meses. Se é só pra parar de cobrar essa rotina
            daqui pra frente, prefira desativar em vez de excluir.
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
