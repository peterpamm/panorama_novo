import { useEffect, useMemo, useState } from 'react'
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
import { formatarResultado, naturezaEFormatoAutomaticos, resolverNaturezaFormato, unidadesParticipaveis } from '@/lib/reuniao-resultados'
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
  { value: 'termometro', label: 'Automático — Termômetro (importação de planilha, sem meta)' },
  { value: 'importado', label: 'Automático — importado de planilha (meta, resultado e pontos prontos)' },
]

const PONTOS_MAX_SETOR = 200

const FORM_INICIAL = {
  nome: '', nomeT1: '', meta: '', formato: 'numero' as ReuniaoFormato, natureza: 'performance' as Natureza, pontos: '',
  fonte: 'manual' as ReuniaoFonte, fonteChave: '', metaFixa: '',
}

/** Nome amigável da fonte automática escolhida — só pra mostrar na listagem e no formulário. */
function labelFonteChave(fonte: ReuniaoFonte, fonteChave: string | null): string {
  if (fonte === 'rotinas') return 'Aderência das Rotinas Financeiras'
  if (fonte === 'termometro') return 'Pontuação direta (sem meta) — importada mensalmente'
  if (fonte === 'importado') return 'Meta, resultado e pontos prontos — importados mensalmente'
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
  const linhasParticipaveis = useMemo(() => unidadesParticipaveis(unidades, setor), [unidades, setor])

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
      nomeT1: i.nome_t1 ?? '',
      meta: i.fonte === 'manual' && i.meta !== null ? (i.formato === 'duracao' ? formatarMinutosComoDuracao(i.meta) : String(i.meta)) : '',
      formato: i.formato,
      natureza: i.natureza,
      pontos: String(i.pontos),
      fonte: i.fonte,
      fonteChave: i.fonte_chave ?? '',
      metaFixa: i.meta_fixa !== null ? String(i.meta_fixa) : '',
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

    const nomeT1 = form.nomeT1.trim() || null

    let metaFixa: number | null = null
    if (form.fonte === 'perdas' && form.metaFixa.trim() !== '') {
      metaFixa = Number(form.metaFixa.replace(',', '.'))
      if (Number.isNaN(metaFixa)) {
        toast({ title: 'Preencha a meta fixa corretamente', variant: 'destructive' })
        return
      }
    }

    let payload: Record<string, unknown>
    if (form.fonte === 'manual') {
      const meta = form.formato === 'duracao' ? parseDuracaoParaMinutos(form.meta) : Number(form.meta.replace(',', '.'))
      if (meta === null || Number.isNaN(meta)) {
        toast({ title: 'Preencha a meta corretamente', variant: 'destructive' })
        return
      }
      payload = { setor, ano: Number(ano), nome, nome_t1: nomeT1, meta, formato: form.formato, natureza: form.natureza, pontos, fonte: 'manual', fonte_chave: null, meta_fixa: null }
    } else if (form.fonte === 'importado') {
      // Meta/resultado/pontos vêm prontos da planilha (por unidade/mês) — só formato/natureza ficam a critério de quem cadastra, iguais ao manual, só pra exibição.
      payload = { setor, ano: Number(ano), nome, nome_t1: nomeT1, meta: null, formato: form.formato, natureza: form.natureza, pontos, fonte: 'importado', fonte_chave: null, meta_fixa: null }
    } else {
      if (form.fonte !== 'rotinas' && form.fonte !== 'termometro' && !form.fonteChave) {
        toast({ title: 'Selecione o indicador/pacote de origem', variant: 'destructive' })
        return
      }
      const fonteChave = form.fonte === 'rotinas' || form.fonte === 'termometro' ? null : form.fonteChave
      const auto = naturezaEFormatoAutomaticos(form.fonte, fonteChave)
      if (!auto) {
        toast({ title: 'Não consegui identificar a fonte selecionada', variant: 'destructive' })
        return
      }
      payload = { setor, ano: Number(ano), nome, nome_t1: nomeT1, meta: null, formato: auto.formato, natureza: auto.natureza, pontos, fonte: form.fonte, fonte_chave: fonteChave, meta_fixa: metaFixa }
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
    const { data } = await supabase.from('reuniao_resultados_participantes').select('unidade,negocio').eq('indicador_id', i.id)
    setParticipantesSel(new Set((data ?? []).map(r => `${r.unidade}|${r.negocio}`)))
    setCarregandoParticipantes(false)
  }

  async function toggleParticipante(unidadeCodigo: string, negocio: string) {
    if (!participantesDe) return
    const chave = `${unidadeCodigo}|${negocio}`
    const participa = participantesSel.has(chave)
    setParticipantesSel(prev => {
      const novo = new Set(prev)
      if (participa) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
    if (participa) {
      const { error } = await supabase.from('reuniao_resultados_participantes')
        .delete().eq('indicador_id', participantesDe.id).eq('unidade', unidadeCodigo).eq('negocio', negocio)
      if (error) toast({ title: 'Erro ao atualizar participante', description: error.message, variant: 'destructive' })
    } else {
      const { error } = await supabase.from('reuniao_resultados_participantes')
        .insert({ indicador_id: participantesDe.id, unidade: unidadeCodigo, negocio })
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
                  <TableCell className={cn('text-sm font-medium', !i.ativo && 'text-muted-foreground line-through')}>
                    {i.nome}
                    {i.nome_t1 && <span className="text-muted-foreground"> / {i.nome_t1}</span>}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {i.fonte === 'manual' ? formatarResultado(i.meta, i.formato) : (
                      <span className="text-xs text-muted-foreground">
                        Automático · {labelFonteChave(i.fonte, i.fonte_chave)}
                        {i.fonte === 'perdas' && i.meta_fixa !== null && ` · Meta fixa: ${formatarResultado(i.meta_fixa, i.formato)}`}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {i.nome_t1
                      ? 'Varia (T2 ≠ T1)'
                      : natureza === 'custo' ? 'Custo (menor melhor)' : 'Performance (maior melhor)'}
                  </TableCell>
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
              <Label htmlFor="ind-nome-t1">Nome no T1 (opcional)</Label>
              <Input id="ind-nome-t1" value={form.nomeT1} onChange={e => setForm(f => ({ ...f, nomeT1: e.target.value }))} placeholder="Ex: DEV PDV no T2, GTY no T1 — deixe em branco se for o mesmo nome" />
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
                <p className="text-xs text-muted-foreground">O resultado sempre vem do Painel de Perdas (DRE/AUX). A meta também, por padrão — só pra essa Reunião, dá pra travar uma meta fixa pra todas as unidades (o Painel de Perdas/RV continuam usando a meta normal).</p>
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="ind-meta-fixa">Meta fixa nessa Reunião (opcional)</Label>
                  <Input
                    id="ind-meta-fixa"
                    value={form.metaFixa}
                    onChange={e => setForm(f => ({ ...f, metaFixa: e.target.value }))}
                    placeholder="Ex: 0 — deixe em branco pra usar a meta do Painel de Perdas"
                  />
                </div>
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
            ) : form.fonte === 'rotinas' ? (
              <p className="text-xs text-muted-foreground">
                Meta e resultado ficam automáticos: % de aderência mensal das Rotinas Financeiras (Área Financeira &gt;
                Rotinas) contra a meta cadastrada em Metas &gt; Financeiro &gt; Metas de Resultado — quanto maior, melhor.
              </p>
            ) : form.fonte === 'termometro' ? (
              <p className="text-xs text-muted-foreground">
                Sem meta — a pontuação ganha no mês é o próprio valor importado na aba Importação, limitado ao total de
                pontos cadastrado abaixo (ex: indicador vale até 110 pontos, importou 85 → ganha 85 pontos).
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Formato</Label>
                  <Select value={form.formato} onValueChange={v => setForm(f => ({ ...f, formato: v as ReuniaoFormato }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMATOS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
                <p className="text-xs text-muted-foreground">
                  Sem meta — meta, resultado e pontos vêm prontos da planilha padrão (aba Importação), por unidade/mês.
                  Formato/natureza são só pra exibição (a pontuação nunca é calculada a partir deles) — se o "Nome no T1"
                  for diferente e a direção mudar entre T2/T1 (ex: ON TIME quanto maior melhor, TMV quanto menor melhor),
                  pode escolher qualquer uma das duas aqui: não afeta a pontuação, e a tela para de afirmar uma direção
                  única sempre que houver Nome no T1 cadastrado.
                </p>
              </>
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
              {linhasParticipaveis.map(p => {
                const chave = `${p.unidade}|${p.negocio}`
                return (
                  <div key={chave} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`part-${chave}`}
                      checked={participantesSel.has(chave)}
                      onCheckedChange={() => toggleParticipante(p.unidade, p.negocio)}
                    />
                    <Label htmlFor={`part-${chave}`} className="cursor-pointer text-sm font-normal">{p.nome}</Label>
                  </div>
                )
              })}
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
