import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'
import type { EncontroContas, Unidade } from '@/types'

interface DesmembrarDialogProps {
  ec: EncontroContas | null
  unidades: Unidade[]
  onOpenChange: (open: boolean) => void
  onDesmembrado: () => void
}

/**
 * Desmembrar um EC entre unidades: diminui o valor da linha original e cria
 * uma linha nova (mesmo chamado/solicitante/data) com a unidade e o valor
 * informados, status Pendente. Pode repetir quantas vezes precisar — um
 * mesmo `numero_chamado` vira N linhas.
 */
export function DesmembrarDialog({ ec, unidades, onOpenChange, onDesmembrado }: DesmembrarDialogProps) {
  const { user, role } = useAuth()
  const { toast } = useToast()
  const [unidadeDestino, setUnidadeDestino] = useState('')
  const [valorTexto, setValorTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  function fechar() {
    setUnidadeDestino('')
    setValorTexto('')
    onOpenChange(false)
  }

  async function handleDesmembrar() {
    if (!ec) return
    const valor = parseNumeroPtBr(valorTexto)
    if (!unidadeDestino) {
      toast({ title: 'Selecione a unidade destino', variant: 'destructive' })
      return
    }
    if (!valor || valor <= 0 || valor >= ec.valor) {
      toast({ title: 'Valor inválido', description: `Precisa ser maior que 0 e menor que o valor atual (${ec.valor}).`, variant: 'destructive' })
      return
    }

    setSalvando(true)
    const { error: errInsert } = await supabase.from('encontro_contas').insert({
      data: ec.data,
      descricao_original: ec.descricao_original,
      numero_chamado: ec.numero_chamado,
      solicitante: ec.solicitante,
      valor,
      unidade: unidadeDestino,
      status: 'pendente',
      tem_evidencia: ec.tem_evidencia, // mantém o mesmo flag do EC original — é a mesma evidência, só dividida entre unidades
      criado_por_email: user?.email ?? null,
      criado_por_role: role,
    })
    if (errInsert) {
      setSalvando(false)
      toast({ title: 'Erro ao desmembrar', description: errInsert.message, variant: 'destructive' })
      return
    }
    const { error: errUpdate } = await supabase.from('encontro_contas').update({ valor: ec.valor - valor }).eq('id', ec.id)
    setSalvando(false)
    if (errUpdate) {
      toast({ title: 'Erro ao ajustar o valor original', description: errUpdate.message, variant: 'destructive' })
      return
    }
    toast({ title: 'EC desmembrado' })
    fechar()
    onDesmembrado()
  }

  return (
    <Dialog open={ec !== null} onOpenChange={v => { if (!v) fechar() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Desmembrar chamado {ec?.numero_chamado}</DialogTitle>
        </DialogHeader>
        {ec && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Valor atual: <span className="font-semibold text-foreground">{ec.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>.
              Informe quanto vai pra outra unidade — o restante fica na linha original.
            </p>
            <div className="space-y-1.5">
              <Label>Unidade destino</Label>
              <Select value={unidadeDestino} onValueChange={setUnidadeDestino}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {unidades.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor a desmembrar</Label>
              <Input value={valorTexto} onChange={e => setValorTexto(e.target.value)} placeholder="Ex: 500,00" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleDesmembrar} disabled={salvando} className="gap-2">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Desmembrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
