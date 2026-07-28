import { useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { formatarResultado, naturezaEFormatoAutomaticos, resolverNaturezaFormato } from '@/lib/reuniao-resultados'
import { formatarMinutosComoDuracao, parseDuracaoParaMinutos } from '@/lib/duracao'
import { INDICADORES_PERDAS } from '@/lib/painel-perdas-calculations'
import { PACOTES } from '@/lib/constants'
import type { ReuniaoFonte, ReuniaoFormato, ReuniaoIndicador, ReuniaoSetor } from '@/types'
import type { Natureza } from '@/types'

const ANOS = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

const FORMATOS: { value: ReuniaoFormato; label: string }[] = [
  { value: 'percentual', label: '% (percentual)' },
  { value: 'monetario', label: 'R$ (monetário)' },
  { value: 'duracao', label: 'Duração (HH:MM)' },
  { value: 'numero', label: 'Número' },
]

const FONTES: { value: ReuniaoFonte; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'perdas', label: 'Automático — indicador do Painel de Perdas' },
  { value: 'farol_pacote', label: 'Automático — pacote do Farol de Metas' },
  { value: 'rotinas', label: 'Automático — % de aderência das Rotinas Financeiras' },
]

const PONTOS_MAX_SETOR = 200

const FORM_INICIAL = {
  nome: '', meta: '', formato: 'numero' as ReuniaoFormato, natureza: 'performance' as Natureza, pontos: '',
  fonte: 'manual' as ReuniaoFonte, fonteChave: '',
}

/** Nome amigável da fonte automática escolhida — só pra mostrar na listagem e no formulário. */
function labelFonteChave(fonte: ReuniaoFonte, fonteChave: string | null): string {
  if (fonte === 'rotinas') return 'Aderência das Rotinas Financeiras'
  if (!fonteChave) return ''
  if (fonte === 'perdas') return INDICADORES_PERDAS.find(i => i.key === fonteChave)?.label ?? fonteChave
  if (fonte === 'farol_pacote') return PACOTES[fonteChave]?.nome ?? fonteChave
  return ''
}

interface CadastroIndicadoresTabProps {
  setor: ReuniaoSetor
}

export function CadastroIndicadoresTab({ setor }: CadastroIndicadoresTabProps) {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const [indicadores, setIndicadores] = useState<ReuniaoIndicador[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('reuniao_resultados_indicadores')
      .select('*')
      .eq('setor', setor)
      .eq('ano', Number(ano))
      .order('ordem')
    if (error) toast({ title: 'Erro ao carregar indicadores', description: error.message, variant: 'destructive' })
    setIndicadores((data as ReuniaoIndicador[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [setor, ano]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPontos = indicadores.filter(i => i.ativo).reduce((acc, i) => acc + i.pontos, 0)

  const [editando, setEditando] = useState<ReuniaoIndicador | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [dialogAberto, setDialogAberto] = useState(false)

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setDialogAberto(true)
  }

  function abrirEdicao(i: ReuniaoIndicador) {
    setEditando(i)
    setForm({
      nome: i.nome,
      meta: i.fonte === 'manual' && i.meta !== null ? (i.formato === 'duracao' ? formatarMinutosComoDuracao(i.meta) : String(i.meta)) : '',
      formato: i.formato,
      natureza: i.natureza,
      pontos: String(i.pontos),
      fonte: i.fonte,
      fonteChave: i.fonte_chave ?? '',
    })
    setDialogAberto(true)
  }

  async function handleSalvar() {
    const nome = form.nome.trim()
    const pontos = Number(form.pontos.replace(',', '.'))
    if (!nome || Number.isNaN(pontos)) {
      toast({ title: 'Preencha nome e pontos corretamente', variant: 'destructive' })
      return
    }

    let payload: Record<string, unknown>
    if (form.fonte === 'manual') {
      const meta = form.formato === 'duracao' ? parseDuracaoParaMinutos(form.meta) : Number(form.meta.replace(',', '.'))
      if (meta === null || Number.isNaN(meta)) {
        toast({ title: 'Preencha a meta corretamente', variant: 'destructive' })
        return
      }
      payload = { setor, ano: Number(ano), nome, meta, formato: form.formato, natureza: form.natureza, pontos, fonte: 'manual', fonte_chave: null }
    } else {
      if (form.fonte !== 'rotinas' && !form.fonteChave) {
        toast({ title: 'Selecione o indicador/pacote de origem', variant: 'destructive' })
        return
      }
      const fonteChave = form.fonte === 'rotinas' ? null : form.fonteChave
      const auto = naturezaEFormatoAutomaticos(form.fonte, fonteChave)
      if (!auto) {
        toast({ title: 'Não consegui identificar a fonte selecionada', variant: 'destructive' })
        return
      }
      payload = { setor, ano: Number(ano), nome, meta: null, formato: auto.formato, natureza: auto.natureza, pontos, fonte: form.fonte, fonte_chave: fonteChave }
    }

    setSalvando(true)
    const { error } = editando
      ? await supabase.from('reuniao_resultados_indicadores').update(payload).eq('id', editando.id)
      : await supabase.from('reuniao_resultados_indicadores').insert({ ...payload, ativo: true, ordem: indicadores.length })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar indicador', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: editando ? 'Indicador atualizado' : 'Indicador cadastrado' })
    setDialogAberto(false)
    await carregar()
  }

  async function toggleAtivo(i: ReuniaoIndicador) {
    const { error } = await supabase.from('reuniao_resultados_indicadores').update({ ativo: !i.ativo }).eq('id', i.id)
    if (error) { toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }); return }
    await carregar()
  }

  const [excluindo, setExcluindo] = useState<ReuniaoIndicador | null>(null)
  const [excluindoSalvando, setExcluindoSalvando] = useState(false)

  async function handleExcluir() {
    if (!excluindo) return
    setExcluindoSalvando(true)
    const { error } = await supabase.from('reuniao_resultados_indicadores').delete().eq('id', excluindo.id)
    setExcluindoSalvando(false)
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return }
    toast({ title: 'Indicador excluído' })
    setExcluindo(null)
    await carregar()
  }

  const [participantesDe, setParticipantesDe] = useState<ReuniaoIndicador | null>(null)
  const [participantesSel, setParticipantesSel] = useState<Set<string>>(new Set())
  const [carregandoParticipantes, setCarregandoParticipantes] = useState(false)

  async function abrirParticipantes(i: ReuniaoIndicador) {
    setParticipantesDe(i)
    setCarregandoParticipantes(true)
    const { data } = await supabase.from('reuniao_resultados_participantes').select('unidade').eq('indicador_id', i.id)
    setParticipantesSel(new Set((data ?? []).map(r => r.unidade as string)))
    setCarregandoParticipantes(false)
  }

  async function toggleParticipante(unidadeCodigo: string) {
    if (!participantesDe) return
    const participa = participantesSel.has(unidadeCodigo)
    setParticipantesSel(prev => {
      const novo = new Set(prev)
      if (participa) novo.delete(unidadeCodigo)
      else novo.add(unidadeCodigo)
      return novo
    })
    if (participa) {
      const { error } = await supabase.from('reuniao_resultados_participantes')
        .delete().eq('indicador_id', participantesDe.id).eq('unidade', unidadeCodigo)
      if (error) toast({ title: 'Erro ao atualizar participante', description: error.message, variant: 'destructive' })
    } else {
      const { error } = await supabase.from('reuniao_resultados_participantes')
        .insert({ indicador_id: participantesDe.id, unidade: unidadeCodigo })
      if (error) toast({ title: 'Erro ao atualizar participante', description: error.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={abrirNovo} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo indicador
        </Button>
      </div>

      <TableCard
        titulo={`Indicadores ${ano}`}
        subtitulo={`${totalPontos}/${PONTOS_MAX_SETOR} pontos cadastrados (ativos)`}
      >
        {carregando ? (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : indicadores.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum indicador cadastrado pra {ano} ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-center">Meta</TableHead>
                <TableHead className="text-center">Natureza</TableHead>
                <TableHead className="text-center">Pontos</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center w-40">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {indicadores.map(i => {
                const { natureza } = resolverNaturezaFormato(i)
                return (
                <TableRow key={i.id}>
                  <TableCell className={cn('text-sm font-medium', !i.ativo && 'text-muted-foreground line-through')}>{i.nome}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {i.fonte === 'manual' ? formatarResultado(i.meta, i.formato) : (
                      <span className="text-xs text-muted-foreground">
                        Automático · {labelFonteChave(i.fonte, i.fonte_chave)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">{natureza === 'custo' ? 'Custo (menor melhor)' : 'Performance (maior melhor)'}</TableCell>
                  <TableCell className="text-center text-sm font-semibold tabular-nums">{i.pontos}</TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => toggleAtivo(i)}
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
                        i.ativo
                          ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground hover:bg-muted/70',
                      )}
                    >
                      {i.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => abrirParticipantes(i)} aria-label={`Participantes de ${i.nome}`}>
                        <Users className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => abrirEdicao(i)} aria-label={`Editar ${i.nome}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400" onClick={() => setExcluindo(i)} aria-label={`Excluir ${i.nome}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </TableCard>

      {/* Novo/editar indicador */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar indicador' : 'Novo indicador'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ind-nome">Nome</Label>
              <Input id="ind-nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: TMA, Presenteísmo, Aderência..." />
            </div>

            <div className="space-y-1.5">
              <Label>Fonte</Label>
              <Select value={form.fonte} onValueChange={v => setForm(f => ({ ...f, fonte: v as ReuniaoFonte, fonteChave: '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONTES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.fonte === 'manual' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ind-meta">Meta</Label>
                    <Input id="ind-meta" value={form.meta} onChange={e => setForm(f => ({ ...f, meta: e.target.value }))} placeholder="Ex: 95, 5000, 01:30" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Formato</Label>
                    <Select value={form.formato} onValueChange={v => setForm(f => ({ ...f, formato: v as ReuniaoFormato }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FORMATOS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Natureza</Label>
                  <Select value={form.natureza} onValueChange={v => setForm(f => ({ ...f, natureza: v as Natureza }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="performance">Performance (maior é melhor)</SelectItem>
                      <SelectItem value="custo">Custo (menor é melhor)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : form.fonte === 'perdas' ? (
              <div className="space-y-1.5">
                <Label>Indicador do Painel de Perdas</Label>
                <Select value={form.fonteChave} onValueChange={v => setForm(f => ({ ...f, fonteChave: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {INDICADORES_PERDAS.map(ind => <SelectItem key={ind.key} value={ind.key}>{ind.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Meta e resultado ficam automáticos (Metas de Perdas + DRE) — formato R$, quanto menos negativo (ou positivo) melhor.</p>
              </div>
            ) : form.fonte === 'farol_pacote' ? (
              <div className="space-y-1.5">
                <Label>Pacote do Farol de Metas</Label>
                <Select value={form.fonteChave} onValueChange={v => setForm(f => ({ ...f, fonteChave: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PACOTES).map(([codigo, info]) => <SelectItem key={codigo} value={codigo}>{info.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Meta e resultado (AVR) ficam automáticos (Orçamento + DRE) — formato %.</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Meta e resultado ficam automáticos: % de aderência mensal das Rotinas Financeiras (Área Financeira &gt;
                Rotinas) contra a meta cadastrada em Metas &gt; Financeiro &gt; Metas de Resultado — quanto maior, melhor.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ind-pontos">Pontos</Label>
              <Input id="ind-pontos" value={form.pontos} onChange={e => setForm(f => ({ ...f, pontos: e.target.value }))} placeholder="Ex: 50" />
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

      {/* Participantes */}
      <Dialog open={participantesDe !== null} onOpenChange={v => { if (!v) setParticipantesDe(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Participantes — {participantesDe?.nome}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Quais unidades concorrem nesse indicador. Desmarcadas ficam de fora da tabela dele no Acompanhamento.</p>
          {carregandoParticipantes ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-80 overflow-y-auto sm:grid-cols-3">
              {unidades.map(u => (
                <div key={u.codigo} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`part-${u.codigo}`}
                    checked={participantesSel.has(u.codigo)}
                    onCheckedChange={() => toggleParticipante(u.codigo)}
                  />
                  <Label htmlFor={`part-${u.codigo}`} className="cursor-pointer text-sm font-normal">{u.nome}</Label>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <Dialog open={excluindo !== null} onOpenChange={v => { if (!v) setExcluindo(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir indicador</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remover <span className="font-semibold text-foreground">{excluindo?.nome}</span>? Isso também apaga os participantes e todos os resultados mensais já lançados pra ele.
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
