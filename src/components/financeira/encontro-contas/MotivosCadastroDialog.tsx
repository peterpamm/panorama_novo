import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { EncontroContasMotivo } from '@/types'

interface MotivosCadastroDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  motivos: EncontroContasMotivo[]
  onAtualizado: () => void
}

/** CRUD pequeno dos Motivos do Encontro de Contas — mirror de `CadastroRotinasTab.tsx`, sem virar uma 5ª aba (embutido no Select de Motivo do detalhe do EC). Desativar em vez de excluir, pra não quebrar ECs que já usam um motivo. */
export function MotivosCadastroDialog({ open, onOpenChange, motivos, onAtualizado }: MotivosCadastroDialogProps) {
  const { toast } = useToast()
  const [novoNome, setNovoNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function handleAdicionar() {
    const nome = novoNome.trim()
    if (!nome) return
    setSalvando(true)
    const { error } = await supabase.from('encontro_contas_motivos').insert({ nome, ordem: motivos.length })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao cadastrar motivo', description: error.message, variant: 'destructive' })
      return
    }
    setNovoNome('')
    onAtualizado()
  }

  async function toggleAtivo(m: EncontroContasMotivo) {
    const { error } = await supabase.from('encontro_contas_motivos').update({ ativo: !m.ativo }).eq('id', m.id)
    if (error) { toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }); return }
    onAtualizado()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Motivos cadastrados</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              placeholder="Novo motivo..."
              onKeyDown={e => { if (e.key === 'Enter') handleAdicionar() }}
            />
            <Button size="icon" onClick={handleAdicionar} disabled={salvando || !novoNome.trim()} className="shrink-0">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>

          {motivos.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">Nenhum motivo cadastrado ainda.</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {motivos.map(m => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <span className={cn('text-sm', !m.ativo && 'text-muted-foreground line-through')}>{m.nome}</span>
                  <button
                    onClick={() => toggleAtivo(m)}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold transition-colors',
                      m.ativo
                        ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70',
                    )}
                  >
                    {m.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
