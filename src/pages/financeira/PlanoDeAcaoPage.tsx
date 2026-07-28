import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronLeft, Clock, Loader2, PlayCircle, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useUnidades } from '@/hooks/useUnidades'
import { usePlanosAcao } from '@/hooks/usePlanosAcao'
import { PillToggle } from '@/components/ui/pill-toggle'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FilterLabel, filterTriggerClass } from '@/components/farol/FarolFilters'
import { TableCard } from '@/components/ui/table-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { STATUS_LABEL, STATUS_PILL, estaAtrasado, formatDataBr, hojeIso } from '@/lib/plano-acao'
import { PlanoAcaoDetalhe } from '@/components/financeira/PlanoAcaoDetalhe'
import { PlanoAcaoFormDialog } from '@/components/financeira/PlanoAcaoFormDialog'
import type { PlanoAcao, PlanoAcaoStatus } from '@/types'

type Aba = 'ativas' | 'historico'
type FiltroPrazo = 'todos' | 'atrasadas' | 'este_mes' | 'proximo_mes'

function dentroDoPrazo(prazo: string, filtro: FiltroPrazo): boolean {
  if (filtro === 'todos') return true
  if (filtro === 'atrasadas') return prazo < hojeIso()
  const hoje = new Date()
  const alvo = filtro === 'este_mes' ? hoje.getMonth() : (hoje.getMonth() + 1) % 12
  const anoAlvo = filtro === 'este_mes' ? hoje.getFullYear() : (hoje.getMonth() === 11 ? hoje.getFullYear() + 1 : hoje.getFullYear())
  const [ano, mes] = prazo.split('-').map(Number)
  return ano === anoAlvo && mes - 1 === alvo
}

/**
 * Plano de Ação — /area-financeira/plano-de-acao. Layout split-screen: lista
 * filtrável à esquerda, detalhe (status + observação + histórico) à direita.
 * "Concluído" fica na lista ativa até o admin "Validar" — só aí some pra
 * aba Histórico (ver comentário em PlanoAcaoDetalhe/migration_063).
 */
export function PlanoDeAcaoPage() {
  const { role, unidade: minhaUnidade } = useAuth()
  const isAdmin = role === 'admin'
  const { toast } = useToast()
  const { planos, loading, recarregar } = usePlanosAcao()
  const { unidades } = useUnidades()

  const nomesUnidades = useMemo(() => {
    const m: Record<string, string> = {}
    for (const u of unidades) m[u.codigo] = u.nome
    return m
  }, [unidades])

  const [aba, setAba] = useState<Aba>('ativas')
  const [filtroUnidade, setFiltroUnidade] = useState('todas')
  const [filtroTag, setFiltroTag] = useState('todas')
  const [filtroPrazo, setFiltroPrazo] = useState<FiltroPrazo>('todos')
  const [filtroStatus, setFiltroStatus] = useState<PlanoAcaoStatus | null>(null)
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)

  const tagsExistentes = useMemo(
    () => Array.from(new Set(planos.map(p => p.tag).filter(Boolean))).sort(),
    [planos],
  )

  const planosBase = useMemo(
    () => planos.filter(p => (aba === 'ativas' ? p.status !== 'validado' : p.status === 'validado')),
    [planos, aba],
  )

  const planosComFiltroBasico = useMemo(
    () => planosBase.filter(p =>
      (filtroUnidade === 'todas' || p.unidade === filtroUnidade)
      && (filtroTag === 'todas' || p.tag === filtroTag)
      && dentroDoPrazo(p.prazo, filtroPrazo),
    ),
    [planosBase, filtroUnidade, filtroTag, filtroPrazo],
  )

  const listaFiltrada = useMemo(
    () => planosComFiltroBasico.filter(p => !filtroStatus || p.status === filtroStatus),
    [planosComFiltroBasico, filtroStatus],
  )

  const contagens = useMemo(() => ({
    pendente: planosComFiltroBasico.filter(p => p.status === 'pendente').length,
    em_andamento: planosComFiltroBasico.filter(p => p.status === 'em_andamento').length,
    concluido: planosComFiltroBasico.filter(p => p.status === 'concluido').length,
    atrasadas: planosComFiltroBasico.filter(p => estaAtrasado(p.prazo, p.status)).length,
  }), [planosComFiltroBasico])

  // Sem seleção por padrão — a lista começa como tabela cheia; só abre o
  // detalhe quando o usuário clica numa linha. Se o filtro mudar e a linha
  // selecionada sair da lista, fecha o detalhe em vez de pular pra outra.
  useEffect(() => {
    if (selecionadoId && !listaFiltrada.some(p => p.id === selecionadoId)) setSelecionadoId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaFiltrada])

  const selecionado = listaFiltrada.find(p => p.id === selecionadoId) ?? null

  const [dialogAberto, setDialogAberto] = useState(false)
  const [editando, setEditando] = useState<PlanoAcao | null>(null)
  const [excluindo, setExcluindo] = useState<PlanoAcao | null>(null)
  const [excluindoSalvando, setExcluindoSalvando] = useState(false)

  function abrirNova() {
    setEditando(null)
    setDialogAberto(true)
  }

  function abrirEdicao(p: PlanoAcao) {
    setEditando(p)
    setDialogAberto(true)
  }

  async function handleExcluir() {
    if (!excluindo) return
    setExcluindoSalvando(true)
    const { error } = await supabase.from('planos_acao').delete().eq('id', excluindo.id)
    setExcluindoSalvando(false)
    if (error) {
      toast({ title: 'Erro ao excluir ação', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Ação excluída' })
    setExcluindo(null)
    await recarregar()
  }

  const CARDS = [
    { status: 'pendente' as const, label: 'Pendentes', valor: contagens.pendente, icone: Clock, cor: 'text-slate-600 dark:text-slate-300' },
    { status: 'em_andamento' as const, label: 'Em Andamento', valor: contagens.em_andamento, icone: PlayCircle, cor: 'text-blue-600 dark:text-blue-400' },
    { status: 'concluido' as const, label: 'Aguardando Validação', valor: contagens.concluido, icone: CheckCircle2, cor: 'text-amber-600 dark:text-amber-400' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/area-financeira"
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Área Financeira
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <h2 className="text-base font-semibold text-foreground">Plano de Ação</h2>
        </div>
        <div className="flex items-center gap-3">
          <PillToggle
            opcoes={[{ value: 'ativas', label: 'Ações' }, { value: 'historico', label: 'Histórico' }] as const}
            value={aba}
            onChange={v => { setAba(v); setFiltroStatus(null) }}
          />
          {isAdmin && (
            <Button onClick={abrirNova} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova ação
            </Button>
          )}
        </div>
      </div>

      {aba === 'ativas' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map(c => {
            const Icone = c.icone
            const ativo = filtroStatus === c.status
            return (
              <button
                key={c.status}
                onClick={() => setFiltroStatus(prev => prev === c.status ? null : c.status)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors',
                  ativo ? 'border-primary ring-1 ring-primary' : 'hover:border-muted-foreground/30',
                )}
              >
                <Icone className={cn('h-8 w-8 shrink-0', c.cor)} />
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{c.valor}</p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
              </button>
            )
          })}
          <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
            <AlertTriangle className="h-8 w-8 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{contagens.atrasadas}</p>
              <p className="text-xs text-muted-foreground">Atrasadas</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[hsl(222,45%,20%)] to-[hsl(222,35%,30%)] dark:from-[hsl(224,28%,14%)] dark:to-[hsl(224,22%,20%)] shadow-xl shadow-blue-900/20 overflow-hidden">
        <div className="flex flex-wrap items-end gap-6 p-4 md:p-6">
          {isAdmin && (
            <div className="space-y-1.5">
              <FilterLabel>Unidade</FilterLabel>
              <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
                <SelectTrigger className={cn('w-48', filterTriggerClass)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {unidades.map(u => (
                    <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <FilterLabel>Tag</FilterLabel>
            <Select value={filtroTag} onValueChange={setFiltroTag}>
              <SelectTrigger className={cn('w-48', filterTriggerClass)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {tagsExistentes.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FilterLabel>Prazo</FilterLabel>
            <Select value={filtroPrazo} onValueChange={v => setFiltroPrazo(v as FiltroPrazo)}>
              <SelectTrigger className={cn('w-40', filterTriggerClass)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="atrasadas">Atrasadas</SelectItem>
                <SelectItem value="este_mes">Este mês</SelectItem>
                <SelectItem value="proximo_mes">Próximo mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : (
        <TableCard titulo={aba === 'ativas' ? 'Ações' : 'Histórico'} subtitulo={`${listaFiltrada.length} ação(ões)`}>
          {listaFiltrada.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma ação encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="w-40">Responsável</TableHead>
                  <TableHead className="w-28">Prazo</TableHead>
                  <TableHead className="w-32">Tag</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listaFiltrada.map(p => {
                  const atrasado = estaAtrasado(p.prazo, p.status)
                  return (
                    <TableRow
                      key={p.id}
                      onClick={() => setSelecionadoId(p.id)}
                      className="cursor-pointer"
                    >
                      <TableCell className="text-sm font-medium">{nomesUnidades[p.unidade] ?? p.unidade}</TableCell>
                      <TableCell className="max-w-[320px] truncate text-sm">{p.titulo}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.responsavel || '—'}</TableCell>
                      <TableCell className={cn('text-sm', atrasado ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                        {formatDataBr(p.prazo)}
                      </TableCell>
                      <TableCell>
                        {p.tag && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{p.tag}</span>}
                      </TableCell>
                      <TableCell>
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_PILL[p.status])}>
                          {STATUS_LABEL[p.status]}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}

      <Dialog open={selecionado !== null} onOpenChange={v => { if (!v) setSelecionadoId(null) }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          {selecionado && (
            <PlanoAcaoDetalhe
              plano={selecionado}
              isAdmin={isAdmin}
              nomesUnidades={nomesUnidades}
              onAtualizado={recarregar}
              onEditar={() => abrirEdicao(selecionado)}
              onExcluir={() => setExcluindo(selecionado)}
            />
          )}
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <PlanoAcaoFormDialog
          open={dialogAberto}
          onOpenChange={setDialogAberto}
          editando={editando}
          unidades={unidades}
          tagsExistentes={tagsExistentes}
          onSalvo={recarregar}
        />
      )}

      <Dialog open={excluindo !== null} onOpenChange={v => { if (!v) setExcluindo(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir ação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remover <span className="font-semibold text-foreground">{excluindo?.titulo}</span>? Isso também apaga todo o
            histórico de observações dessa ação.
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

      <Toaster />
    </div>
  )
}
