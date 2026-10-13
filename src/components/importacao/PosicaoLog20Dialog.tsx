import { useEffect, useState } from 'react'
import { Loader2, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { Log20PosicaoAmbev } from '@/types'

const ANO_ATUAL = new Date().getFullYear()
const ANOS_OPCOES = [ANO_ATUAL + 1, ANO_ATUAL, ANO_ATUAL - 1]

/**
 * Posição da LOG20 (empresa toda, não por unidade) no ranking de operadores
 * da Ambev — substitui o antigo Scorecard por unidade, que a Ambev não
 * fornece mais. Campo manual (não é importação de planilha, por isso fica
 * aqui como um diálogo simples, não um `FilePickerButton`): escolhe o ano e
 * digita a faixa como a Ambev informa (ex: "1-5", "6-10") — 1 linha por ano
 * (`log20_posicao_ambev`, migration 127), sobrescrita a cada atualização
 * (o usuário atualiza todo mês, mas só o valor mais recente do ano importa).
 * Alimenta a linha "Posição LOG20" do Farol Gerentes/SDG Gerentes, meta fixa
 * de top 5.
 */
export function PosicaoLog20Dialog() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [ano, setAno] = useState(String(ANO_ATUAL))
  const [faixa, setFaixa] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelado = false
    setCarregando(true)
    supabase.from('log20_posicao_ambev').select('*').eq('ano', Number(ano)).maybeSingle()
      .then(({ data }) => {
        if (cancelado) return
        setFaixa((data as Log20PosicaoAmbev | null)?.faixa ?? '')
        setCarregando(false)
      })
    return () => { cancelado = true }
  }, [open, ano])

  async function handleSalvar() {
    if (!faixa.trim()) {
      toast({ title: 'Preencha a faixa', description: 'Ex: "1-5", "6-10".', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const { error } = await supabase.from('log20_posicao_ambev').upsert(
      { ano: Number(ano), faixa: faixa.trim(), atualizado_por_email: user?.email ?? null },
      { onConflict: 'ano' },
    )
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Posição LOG20 salva' })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <Trophy className="h-4 w-4" />
          Posição LOG20
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Posição LOG20 no ranking Ambev</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Faixa de posição da LOG20 entre os operadores (ex: "1-5", "6-10") — meta é ficar entre os 5 melhores.
          Alimenta a linha "Posição LOG20" do Farol Gerentes e do SDG Gerentes, mesmo valor em toda unidade.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Ano</Label>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANOS_OPCOES.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="posicao-log20-faixa">Faixa</Label>
            <Input
              id="posicao-log20-faixa"
              value={faixa}
              onChange={e => setFaixa(e.target.value)}
              placeholder="1-5"
              disabled={carregando}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando || carregando} className="gap-2">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
