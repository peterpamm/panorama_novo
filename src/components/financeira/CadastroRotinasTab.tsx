import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { interpretarPrazoTexto, rotuloPrazoEstruturado } from '@/lib/rotina-prazo'
import type { PrazoTipo, RotinaFinanceira } from '@/types'

const FORM_INICIAL = { setor: '', nome: '', prazo: '', ordem: '0', prazoTipo: 'sem_data' as PrazoTipo, prazoDia: '' }

const OPCOES_PRAZO_TIPO: { valor: PrazoTipo; label: string }[] = [
  { valor: 'dia_fixo', label: 'Dia fixo do mês' },
  { valor: 'dia_util', label: 'N-ésimo dia útil' },
  { valor: 'sem_data', label: 'Sem data (depende de outro evento)' },
]

/**
 * Cadastro das rotinas financeiras — nome e prazo editáveis livremente, sem
 * afetar o histórico já preenchido no Acompanhamento (que referencia a rotina
 * por id, não por texto). Desativar (em vez de excluir) tira a rotina da
 * matriz de meses futuros mas preserva o que já foi respondido.
 *
 * Além do prazo em texto (que é o que aparece na tela), cada rotina tem o
 * prazo estruturado (Vencimento: dia fixo / n-ésimo dia útil / sem data) —
 * é só ele que posiciona a rotina no Calendário. O botão "Sugerir
 * vencimentos" preenche as que ainda estão sem data lendo o próprio texto
 * (ver `interpretarPrazoTexto`), pra não ter que cadastrar tudo à mão; o que
 * o texto não permite deduzir fica 'sem data' pra revisão.
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
    setForm({
      setor: r.setor,
      nome: r.nome,
      prazo: r.prazo,
      ordem: String(r.ordem),
      prazoTipo: r.prazo_tipo,
      prazoDia: r.prazo_dia === null ? '' : String(r.prazo_dia),
    })
    setDialogAberto(true)
  }

  /** Sugere o vencimento a partir do texto do prazo — só pra quem digitou o texto e ainda não escolheu o tipo. */
  function sugerirDoTexto(prazoTexto: string) {
    const sugestao = interpretarPrazoTexto(prazoTexto)
    setForm(f => ({
      ...f,
      prazo: prazoTexto,
      // Só sugere enquanto o usuário não escolheu nada — nunca sobrescreve escolha manual.
      ...(f.prazoTipo === 'sem_data' && f.prazoDia === ''
        ? { prazoTipo: sugestao.tipo, prazoDia: sugestao.dia === null ? '' : String(sugestao.dia) }
        : {}),
    }))
  }

  async function handleSalvar() {
    const setor = form.setor.trim()
    const nome = form.nome.trim()
    if (!setor || !nome) {
      toast({ title: 'Preencha setor e nome da rotina', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const prazoDia = form.prazoTipo === 'sem_data' ? null : Number(form.prazoDia) || null
    const payload = {
      setor,
      nome,
      prazo: form.prazo.trim(),
      ordem: Number(form.ordem) || 0,
      // Tipo sem dia não posiciona nada no calendário — cai pra 'sem_data'
      // em vez de virar uma rotina com vencimento pela metade.
      prazo_tipo: prazoDia === null ? 'sem_data' : form.prazoTipo,
      prazo_dia: prazoDia,
    }
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

  // Rotinas que ainda não têm vencimento definido mas cujo texto de prazo dá
  // pra interpretar — são as que o botão "Sugerir vencimentos" preenche.
  const sugestoesPendentes = useMemo(
    () => rotinas
      .filter(r => r.prazo_tipo === 'sem_data' && r.prazo_dia === null)
      .map(r => ({ rotina: r, sugestao: interpretarPrazoTexto(r.prazo) }))
      .filter(s => s.sugestao.tipo !== 'sem_data'),
    [rotinas],
  )
  const [sugerindo, setSugerindo] = useState(false)

  async function aplicarSugestoes() {
    setSugerindo(true)
    const erros: string[] = []
    for (const { rotina, sugestao } of sugestoesPendentes) {
      const { error } = await supabase
        .from('rotinas_financeiras')
        .update({ prazo_tipo: sugestao.tipo, prazo_dia: sugestao.dia })
        .eq('id', rotina.id)
      if (error) erros.push(`${rotina.nome}: ${error.message}`)
    }
    setSugerindo(false)
    if (erros.length > 0) {
      toast({ title: `${erros.length} rotina(s) não atualizaram`, description: erros[0], variant: 'destructive' })
    } else {
      toast({
        title: `${sugestoesPendentes.length} vencimento(s) preenchido(s)`,
        description: 'Confira na coluna Vencimento e ajuste o que estiver diferente do combinado.',
      })
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
          Prazo é texto livre (ex: "Dia 10", "4º dia útil"); o <span className="font-medium text-foreground">Vencimento</span>{' '}
          é a versão estruturada dele — é o que posiciona a rotina no Calendário.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {sugestoesPendentes.length > 0 && (
            <Button variant="outline" onClick={aplicarSugestoes} disabled={sugerindo} className="gap-2">
              {sugerindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Sugerir vencimentos ({sugestoesPendentes.length})
            </Button>
          )}
          <Button onClick={abrirNova} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova rotina
          </Button>
        </div>
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
                <TableHead className="w-32">Vencimento</TableHead>
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
                  <TableCell className="text-sm">
                    {r.prazo_tipo === 'sem_data' ? (
                      <span className="text-amber-600 dark:text-amber-500" title="Não entra na grade do calendário — fica na lista de sem data definida">
                        Sem data
                      </span>
                    ) : (
                      rotuloPrazoEstruturado({ tipo: r.prazo_tipo, dia: r.prazo_dia })
                    )}
                  </TableCell>
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
                <Label htmlFor="rotina-prazo">Prazo (texto)</Label>
                <Input id="rotina-prazo" value={form.prazo} onChange={e => sugerirDoTexto(e.target.value)} placeholder="Dia 10 / 4º dia útil" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rotina-ordem">Ordem</Label>
                <Input id="rotina-ordem" type="number" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5 rounded-lg border border-gray-200/60 p-3 dark:border-gray-700/60">
              <Label>Vencimento no calendário</Label>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={form.prazoTipo}
                  onValueChange={v => setForm(f => ({ ...f, prazoTipo: v as PrazoTipo, prazoDia: v === 'sem_data' ? '' : f.prazoDia }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPCOES_PRAZO_TIPO.map(o => <SelectItem key={o.valor} value={o.valor}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.prazoDia}
                  onChange={e => setForm(f => ({ ...f, prazoDia: e.target.value }))}
                  disabled={form.prazoTipo === 'sem_data'}
                  placeholder={form.prazoTipo === 'dia_util' ? 'Qual dia útil (1-22)' : 'Dia do mês (1-31)'}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {form.prazoTipo === 'dia_util'
                  ? 'Conta só seg-sex, sem considerar feriado — em mês com feriado no começo, ajuste arrastando o chip no calendário.'
                  : form.prazoTipo === 'dia_fixo'
                    ? 'Dia 31 cai sempre no último dia do mês. Se cair em fim de semana, não é empurrado sozinho — você arrasta no calendário.'
                    : 'Sem data não aparece na grade do calendário: fica na lista lateral de "sem data definida".'}
              </p>
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
