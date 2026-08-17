import { useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { AJUSTE_TODAS_UNIDADES, type CalendarioEvento, type EventoCor, type EventoRecorrencia, type Unidade } from '@/types'

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const TIPOS: { valor: EventoRecorrencia; label: string }[] = [
  { valor: 'semanal', label: 'Toda semana' },
  { valor: 'mensal', label: 'Todo mês' },
  { valor: 'unico', label: 'Data única' },
]

/** Paleta dos eventos — cores distintas das dos status de rotina (verde/vermelho/cinza/azul claro), pra não confundir as duas coisas na grade. */
export const CORES_EVENTO: Record<EventoCor, string> = {
  roxo: 'bg-purple-500/20 text-purple-800 dark:bg-purple-500/25 dark:text-purple-200',
  azul: 'bg-sky-500/20 text-sky-800 dark:bg-sky-500/25 dark:text-sky-200',
  ambar: 'bg-amber-500/20 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200',
  verde: 'bg-teal-500/20 text-teal-800 dark:bg-teal-500/25 dark:text-teal-200',
}

const CORES_LABEL: Record<EventoCor, string> = { roxo: 'Roxo', azul: 'Azul', ambar: 'Âmbar', verde: 'Verde' }

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

interface EventoCalendarioDialogProps {
  /** null = fechado; objeto vazio-ish = novo evento; com id = edição. */
  evento: CalendarioEvento | null
  unidades: Unidade[]
  onFechar: () => void
  onSalvo: () => void
}

/**
 * Cadastro de um evento do Calendário (RPS, visita, etc). Só admin chega
 * aqui — a tela do calendário nem mostra o botão pros demais.
 *
 * O evento é sempre de uma unidade (ou de todas), e a recorrência define
 * qual campo importa: dia da semana pro semanal, dia do mês pro mensal,
 * data pro único. A vigência (a partir de / até) é o que faz um RPS
 * encerrado sumir dos meses novos sem apagar o que já passou.
 */
export function EventoCalendarioDialog({ evento, unidades, onFechar, onSalvo }: EventoCalendarioDialogProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<CalendarioEvento | null>(evento)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => { setForm(evento) }, [evento])

  if (!form) return null

  function atualizar(campos: Partial<CalendarioEvento>) {
    setForm(f => (f ? { ...f, ...campos } : f))
  }

  async function salvar() {
    if (!form) return
    if (!form.titulo.trim()) {
      toast({ title: 'Dê um título pro evento', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim(),
      unidade: form.unidade,
      tipo: form.tipo,
      // Cada tipo carrega só o campo que lhe interessa — o resto vai null pra
      // não deixar lixo de uma escolha anterior gravado.
      dia_semana: form.tipo === 'semanal' ? form.dia_semana ?? 1 : null,
      dia_mes: form.tipo === 'mensal' ? form.dia_mes ?? 1 : null,
      data_inicio: form.data_inicio || hojeIso(),
      data_fim: form.tipo === 'unico' ? null : form.data_fim || null,
      cor: form.cor,
    }
    const { error } = form.id
      ? await supabase.from('calendario_eventos').update(payload).eq('id', form.id)
      : await supabase.from('calendario_eventos').insert(payload)
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar evento', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: form.id ? 'Evento atualizado' : 'Evento criado' })
    onSalvo()
  }

  async function excluir() {
    if (!form?.id) return
    setExcluindo(true)
    const { error } = await supabase.from('calendario_eventos').delete().eq('id', form.id)
    setExcluindo(false)
    if (error) {
      toast({ title: 'Erro ao excluir evento', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Evento excluído' })
    onSalvo()
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onFechar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Editar evento' : 'Novo evento'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="evento-titulo">Título</Label>
            <Input
              id="evento-titulo"
              value={form.titulo}
              onChange={e => atualizar({ titulo: e.target.value })}
              placeholder="RPS — Reunião de Produtividade Semanal"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={form.unidade} onValueChange={v => atualizar({ unidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={AJUSTE_TODAS_UNIDADES}>Todas as unidades</SelectItem>
                  {unidades.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Repetição</Label>
              <Select value={form.tipo} onValueChange={v => atualizar({ tipo: v as EventoRecorrencia })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.valor} value={t.valor}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.tipo === 'semanal' && (
            <div className="space-y-1.5">
              <Label>Dia da semana</Label>
              <Select value={String(form.dia_semana ?? 1)} onValueChange={v => atualizar({ dia_semana: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.tipo === 'mensal' && (
            <div className="space-y-1.5">
              <Label htmlFor="evento-dia-mes">Dia do mês</Label>
              <Input
                id="evento-dia-mes"
                type="number"
                min={1}
                max={31}
                value={form.dia_mes ?? ''}
                onChange={e => atualizar({ dia_mes: Number(e.target.value) || null })}
              />
              <p className="text-xs text-muted-foreground">Dia 31 cai sempre no último dia do mês.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="evento-inicio">{form.tipo === 'unico' ? 'Data' : 'A partir de'}</Label>
              <Input
                id="evento-inicio"
                type="date"
                value={form.data_inicio}
                onChange={e => atualizar({ data_inicio: e.target.value })}
              />
            </div>
            {form.tipo !== 'unico' && (
              <div className="space-y-1.5">
                <Label htmlFor="evento-fim">Até (opcional)</Label>
                <Input
                  id="evento-fim"
                  type="date"
                  value={form.data_fim ?? ''}
                  onChange={e => atualizar({ data_fim: e.target.value || null })}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex gap-2">
              {(Object.keys(CORES_EVENTO) as EventoCor[]).map(cor => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => atualizar({ cor })}
                  className={cn(
                    'rounded px-3 py-1.5 text-xs font-medium transition-all',
                    CORES_EVENTO[cor],
                    form?.cor === cor ? 'ring-2 ring-offset-1 ring-current' : 'opacity-60 hover:opacity-100',
                  )}
                >
                  {CORES_LABEL[cor]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evento-descricao">Observação (opcional)</Label>
            <Textarea
              id="evento-descricao"
              rows={2}
              value={form.descricao}
              onChange={e => atualizar({ descricao: e.target.value })}
              placeholder="Horário, participantes, link da call..."
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {form.id ? (
            <Button variant="ghost" onClick={excluir} disabled={excluindo || salvando} className="gap-2 text-destructive hover:text-destructive">
              {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Excluir
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onFechar} disabled={salvando || excluindo}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando || excluindo} className="gap-2">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Evento em branco pro "Novo evento", já apontando pra unidade que está na tela. */
export function eventoNovo(unidade: string): CalendarioEvento {
  return {
    titulo: '', descricao: '', unidade,
    tipo: 'semanal', dia_semana: 5, dia_mes: null,
    data_inicio: hojeIso(), data_fim: null, cor: 'roxo',
  }
}
