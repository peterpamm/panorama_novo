import { useEffect, useMemo, useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { LancamentoEmMassaDialog } from '@/components/financeira/LancamentoEmMassaDialog'
import { mesAnterior } from '@/lib/rotinas-financeiras'
import type { RotinaFinanceira, RotinaFinanceiraStatus } from '@/types'

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ANO_ATUAL = new Date().getFullYear()
const ANOS_OPCOES = [ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL + 1]

const STATUS_ESTILO: Record<string, string> = {
  OK: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  NOK: 'bg-red-500/15 text-red-700 dark:text-red-400',
  'N/A': 'bg-muted text-muted-foreground',
}


interface AcompanhamentoRotinasTabProps {
  /** false = só visualização (usuário de unidade) — some o lançamento em massa e as células viram só leitura, sem abrir o dialog de edição. */
  podeEditar: boolean
}

/**
 * Matriz clicável rotina × unidade pro mês escolhido — substitui a aba
 * Dash_Mensal da planilha antiga, só que lendo direto do cadastro (renomear
 * uma rotina não desalinha nada, já que a resposta referencia o id).
 */
export function AcompanhamentoRotinasTab({ podeEditar }: AcompanhamentoRotinasTabProps) {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const unidadesFiltro = useMemo(() => unidades.filter(u => u.codigo !== 'AMBEV'), [unidades])

  const [ano, setAno] = useState(String(ANO_ATUAL))
  const [mes, setMes] = useState(String(new Date().getMonth() + 1))

  const [rotinas, setRotinas] = useState<RotinaFinanceira[]>([])
  const [statusLista, setStatusLista] = useState<RotinaFinanceiraStatus[]>([])
  const [statusListaAnterior, setStatusListaAnterior] = useState<RotinaFinanceiraStatus[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    const anterior = mesAnterior(Number(ano), Number(mes))
    const [r, s, sAnt] = await Promise.all([
      supabase.from('rotinas_financeiras').select('*').eq('ativo', true).order('setor').order('ordem'),
      supabase.from('rotinas_financeiras_status').select('*').eq('ano', Number(ano)).eq('mes', Number(mes)),
      supabase.from('rotinas_financeiras_status').select('*').eq('ano', anterior.ano).eq('mes', anterior.mes),
    ])
    if (r.error) toast({ title: 'Erro ao carregar rotinas', description: r.error.message, variant: 'destructive' })
    if (s.error) toast({ title: 'Erro ao carregar acompanhamento', description: s.error.message, variant: 'destructive' })
    setRotinas((r.data as RotinaFinanceira[]) ?? [])
    setStatusLista((s.data as RotinaFinanceiraStatus[]) ?? [])
    setStatusListaAnterior((sAnt.data as RotinaFinanceiraStatus[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [ano, mes]) // eslint-disable-line react-hooks/exhaustive-deps

  const statusPorChave = useMemo(() => {
    const mapa = new Map<string, RotinaFinanceiraStatus>()
    for (const s of statusLista) mapa.set(`${s.rotina_id}|${s.unidade}`, s)
    return mapa
  }, [statusLista])

  /**
   * Célula do mês atual, com fallback pro N/A do mês anterior quando ainda
   * não foi respondida neste mês — N/A normalmente é estrutural (a rotina não
   * se aplica àquela unidade/negócio), então tende a se repetir mês a mês.
   * OK/NOK nunca herdam: são um julgamento que precisa ser refeito toda vez.
   * `herdado: true` só existe na tela — confirmar ou mudar grava uma linha
   * de verdade neste mês.
   */
  const statusExibicaoPorChave = useMemo(() => {
    const anteriorPorChave = new Map<string, RotinaFinanceiraStatus>()
    for (const s of statusListaAnterior) anteriorPorChave.set(`${s.rotina_id}|${s.unidade}`, s)

    const mapa = new Map<string, { status: 'OK' | 'NOK' | 'N/A' | null; observacao: string; herdado: boolean }>()
    for (const rotina of rotinas) {
      for (const u of unidadesFiltro) {
        const chave = `${rotina.id}|${u.codigo}`
        const atual = statusPorChave.get(chave)
        if (atual) {
          mapa.set(chave, { status: atual.status, observacao: atual.observacao, herdado: false })
          continue
        }
        const anteriorStatus = anteriorPorChave.get(chave)
        if (anteriorStatus?.status === 'N/A') {
          mapa.set(chave, { status: 'N/A', observacao: '', herdado: true })
        }
      }
    }
    return mapa
  }, [rotinas, unidadesFiltro, statusPorChave, statusListaAnterior])

  // ── Edição de uma célula ────────────────────────────────────────────────
  const [editando, setEditando] = useState<{ rotina: RotinaFinanceira; unidadeCodigo: string; unidadeNome: string } | null>(null)
  const [obsForm, setObsForm] = useState('')
  const [salvando, setSalvando] = useState(false)

  function abrirCelula(rotina: RotinaFinanceira, unidadeCodigo: string, unidadeNome: string) {
    const atual = statusPorChave.get(`${rotina.id}|${unidadeCodigo}`)
    setObsForm(atual?.observacao ?? '')
    setEditando({ rotina, unidadeCodigo, unidadeNome })
  }

  async function salvarStatus(status: 'OK' | 'NOK' | 'N/A' | null) {
    if (!editando) return
    setSalvando(true)
    const { error } = await supabase.from('rotinas_financeiras_status').upsert(
      {
        rotina_id: editando.rotina.id,
        unidade: editando.unidadeCodigo,
        ano: Number(ano),
        mes: Number(mes),
        status,
        observacao: obsForm.trim(),
      },
      { onConflict: 'rotina_id,unidade,ano,mes' },
    )
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
      return
    }
    setEditando(null)
    await carregar()
  }

  const carregandoTudo = carregando

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS_OPCOES.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className={cn('w-40', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {podeEditar && (
          <LancamentoEmMassaDialog
            rotinasAtivas={rotinas}
            unidades={unidadesFiltro}
            anoInicial={ano}
            mesInicial={mes}
            onSalvo={(anoSalvo, mesSalvo) => {
              // Se o lançamento foi pro mesmo período em tela, o useEffect não dispara sozinho
              // (deps iguais) — recarrega na mão. Se foi outro período, só troca e o efeito recarrega.
              if (anoSalvo === ano && mesSalvo === mes) carregar()
              else { setAno(anoSalvo); setMes(mesSalvo) }
            }}
          />
        )}
      </div>

      <TableCard
        titulo={`Acompanhamento — ${MESES_NOMES[Number(mes) - 1]} ${ano}`}
        subtitulo={carregandoTudo
          ? 'Carregando...'
          : podeEditar
            ? 'Clique numa célula pra marcar OK/NOK/N-A e registrar observação · células tracejadas herdaram N/A do mês anterior'
            : 'Somente visualização · células tracejadas herdaram N/A do mês anterior'}
      >
        {carregandoTudo ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : rotinas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma rotina ativa cadastrada — cadastre na aba Cadastro.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setor</TableHead>
                <TableHead>Rotina</TableHead>
                {unidadesFiltro.map(u => (
                  <TableHead key={u.codigo} className="text-center">{u.nome}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rotinas.map(rotina => (
                <TableRow key={rotina.id} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="py-1.5 text-xs text-muted-foreground">{rotina.setor}</TableCell>
                  <TableCell className="max-w-xs py-1.5 text-sm" title={rotina.prazo ? `Prazo: ${rotina.prazo}` : undefined}>
                    {rotina.nome}
                    {rotina.prazo && <span className="ml-1.5 text-xs text-muted-foreground">({rotina.prazo})</span>}
                  </TableCell>
                  {unidadesFiltro.map(u => {
                    const s = statusExibicaoPorChave.get(`${rotina.id}|${u.codigo}`)
                    const tooltip = s?.herdado
                      ? 'Herdado do N/A do mês anterior — clique pra confirmar ou mudar'
                      : s?.observacao || undefined
                    const badgeClass = cn(
                      'inline-flex min-w-[52px] items-center justify-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
                      s?.herdado
                        ? 'border border-dashed border-gray-300 bg-transparent text-muted-foreground dark:border-gray-600'
                        : s?.status
                          ? STATUS_ESTILO[s.status]
                          : 'bg-gray-100 text-gray-400 dark:bg-gray-800',
                    )
                    return (
                      <TableCell key={u.codigo} className="py-1.5 text-center">
                        {podeEditar ? (
                          <button
                            onClick={() => abrirCelula(rotina, u.codigo, u.nome)}
                            title={tooltip}
                            className={cn(badgeClass, 'transition-colors', s?.herdado ? 'hover:bg-gray-100 dark:hover:bg-gray-800' : !s?.status ? 'hover:bg-gray-200 dark:hover:bg-gray-700' : '')}
                          >
                            {s?.status ?? '—'}
                            {s?.observacao && <MessageSquare className="h-3 w-3" />}
                          </button>
                        ) : (
                          <span title={tooltip} className={badgeClass}>
                            {s?.status ?? '—'}
                            {s?.observacao && <MessageSquare className="h-3 w-3" />}
                          </span>
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <Dialog open={editando !== null} onOpenChange={v => { if (!v) setEditando(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando?.unidadeNome}</DialogTitle>
          </DialogHeader>
          {editando && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {editando.rotina.nome}
                {editando.rotina.prazo && <span className="ml-1.5">— prazo: {editando.rotina.prazo}</span>}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  disabled={salvando}
                  onClick={() => salvarStatus('OK')}
                  className="gap-2 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                >
                  OK
                </Button>
                <Button
                  variant="outline"
                  disabled={salvando}
                  onClick={() => salvarStatus('NOK')}
                  className="gap-2 border-red-500/30 text-red-700 hover:bg-red-500/10 dark:text-red-400"
                >
                  NOK
                </Button>
                <Button variant="outline" disabled={salvando} onClick={() => salvarStatus('N/A')}>
                  N/A
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rotina-obs">Observação</Label>
                <Textarea
                  id="rotina-obs"
                  value={obsForm}
                  onChange={e => setObsForm(e.target.value)}
                  placeholder="Opcional — ex: justificativa, data combinada..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={salvando}
              onClick={() => salvarStatus(null)}
            >
              Limpar status
            </Button>
            <Button onClick={() => salvarStatus(editando ? (statusExibicaoPorChave.get(`${editando.rotina.id}|${editando.unidadeCodigo}`)?.status ?? null) : null)} disabled={salvando} className="gap-2">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar observação (mantém status)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
