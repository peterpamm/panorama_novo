import { useEffect, useState } from 'react'
import { Layers, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { PillToggle } from '@/components/ui/pill-toggle'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { mesAnterior } from '@/lib/rotinas-financeiras'
import type { RotinaFinanceira, RotinaFinanceiraStatus, Unidade } from '@/types'

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const ANO_ATUAL = new Date().getFullYear()
const ANOS_OPCOES = [ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL + 1]

type StatusValor = 'OK' | 'NOK' | 'N/A' | ''

const OPCOES_STATUS: { valor: StatusValor; label: string; ativa: string }[] = [
  { valor: 'OK', label: 'OK', ativa: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' },
  { valor: 'NOK', label: 'NOK', ativa: 'bg-red-500/20 text-red-700 dark:text-red-400' },
  { valor: 'N/A', label: 'N/A', ativa: 'bg-gray-300/60 text-gray-700 dark:bg-gray-600/50 dark:text-gray-200' },
  { valor: '', label: '—', ativa: 'bg-gray-200/60 text-gray-500 dark:bg-gray-700/60 dark:text-gray-400' },
]

function StatusPicker({ value, onChange }: { value: StatusValor; onChange: (v: StatusValor) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      {OPCOES_STATUS.map((o, i) => (
        <button
          key={o.valor || 'vazio'}
          type="button"
          onClick={() => onChange(o.valor)}
          className={cn(
            'px-2.5 py-1 text-xs font-semibold transition-colors',
            i > 0 && 'border-l border-gray-200 dark:border-gray-700',
            value === o.valor ? o.ativa : 'bg-transparent text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface LancamentoEmMassaDialogProps {
  rotinasAtivas: RotinaFinanceira[]
  unidades: Unidade[]
  /** Ano/mês atualmente selecionado na aba de Acompanhamento — só serve de valor inicial do diálogo. */
  anoInicial: string
  mesInicial: string
  /** Chamado depois de salvar, com o ano/mês usado no lançamento — pra tela de trás poder pular pro mesmo período. */
  onSalvo: (ano: string, mes: string) => void
}

/**
 * Lançamento em massa: escolhe UMA rotina (e marca todas as unidades de uma
 * vez) ou UMA unidade (e marca todas as rotinas de uma vez) — pensado pra
 * subir retroativo manual sem clicar célula por célula na matriz. Não mexe em
 * observação (usa a matriz normal pra isso, célula a célula) — só o status.
 */
export function LancamentoEmMassaDialog({ rotinasAtivas, unidades, anoInicial, mesInicial, onSalvo }: LancamentoEmMassaDialogProps) {
  const { toast } = useToast()
  const [aberto, setAberto] = useState(false)
  const [modo, setModo] = useState<'rotina' | 'unidade'>('rotina')
  const [ano, setAno] = useState(anoInicial)
  const [mes, setMes] = useState(mesInicial)
  const [rotinaId, setRotinaId] = useState('')
  const [unidadeCodigo, setUnidadeCodigo] = useState('')
  const [valores, setValores] = useState<Record<string, StatusValor>>({})
  const [observacoesExistentes, setObservacoesExistentes] = useState<Record<string, string>>({})
  /** Chaves cujo valor veio do N/A herdado do mês anterior (ainda não confirmado neste mês) — só exibição, some ao tocar na linha. */
  const [sugeridos, setSugeridos] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setAno(anoInicial)
    setMes(mesInicial)
    if (!rotinaId && rotinasAtivas.length > 0) setRotinaId(rotinasAtivas[0].id!)
    if (!unidadeCodigo && unidades.length > 0) setUnidadeCodigo(unidades[0].codigo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  const alvos: { chave: string; label: string; setor?: string }[] = modo === 'rotina'
    ? unidades.map(u => ({ chave: u.codigo, label: u.nome }))
    : rotinasAtivas.map(r => ({ chave: r.id as string, label: r.nome, setor: r.setor }))

  useEffect(() => {
    if (!aberto) return
    const alvoEscolhido = modo === 'rotina' ? rotinaId : unidadeCodigo
    if (!alvoEscolhido) return

    let cancelado = false
    async function carregar() {
      setCarregando(true)
      const anterior = mesAnterior(Number(ano), Number(mes))
      const montarQuery = (a: number, m: number) => {
        let query = supabase.from('rotinas_financeiras_status').select('*').eq('ano', a).eq('mes', m)
        query = modo === 'rotina' ? query.eq('rotina_id', rotinaId) : query.eq('unidade', unidadeCodigo)
        return query
      }
      const [atualRes, anteriorRes] = await Promise.all([
        montarQuery(Number(ano), Number(mes)),
        montarQuery(anterior.ano, anterior.mes),
      ])
      if (cancelado) return
      if (atualRes.error) {
        toast({ title: 'Erro ao carregar', description: atualRes.error.message, variant: 'destructive' })
        setCarregando(false)
        return
      }
      const statusMap: Record<string, StatusValor> = {}
      const obsMap: Record<string, string> = {}
      for (const s of (atualRes.data as RotinaFinanceiraStatus[]) ?? []) {
        const chave = modo === 'rotina' ? s.unidade : s.rotina_id
        statusMap[chave] = (s.status ?? '') as StatusValor
        obsMap[chave] = s.observacao ?? ''
      }

      // Quem não tem resposta neste mês ainda, mas era N/A no mês anterior, já vem sugerido.
      const novosSugeridos = new Set<string>()
      if (!anteriorRes.error) {
        for (const s of (anteriorRes.data as RotinaFinanceiraStatus[]) ?? []) {
          const chave = modo === 'rotina' ? s.unidade : s.rotina_id
          if (s.status === 'N/A' && statusMap[chave] === undefined) {
            statusMap[chave] = 'N/A'
            novosSugeridos.add(chave)
          }
        }
      }

      setValores(statusMap)
      setObservacoesExistentes(obsMap)
      setSugeridos(novosSugeridos)
      setCarregando(false)
    }
    carregar()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, modo, rotinaId, unidadeCodigo, ano, mes])

  function marcarTodos(status: StatusValor) {
    const novo: Record<string, StatusValor> = {}
    for (const a of alvos) novo[a.chave] = status
    setValores(novo)
    setSugeridos(new Set())
  }

  function alterarValor(chave: string, valor: StatusValor) {
    setValores(prev => ({ ...prev, [chave]: valor }))
    setSugeridos(prev => {
      if (!prev.has(chave)) return prev
      const novo = new Set(prev)
      novo.delete(chave)
      return novo
    })
  }

  async function handleSalvar() {
    const alvoEscolhido = modo === 'rotina' ? rotinaId : unidadeCodigo
    if (!alvoEscolhido || alvos.length === 0) return

    setSalvando(true)
    const registros = alvos.map(a => ({
      rotina_id: modo === 'rotina' ? rotinaId : a.chave,
      unidade: modo === 'rotina' ? a.chave : unidadeCodigo,
      ano: Number(ano),
      mes: Number(mes),
      status: (valores[a.chave] || null) as 'OK' | 'NOK' | 'N/A' | null,
      observacao: observacoesExistentes[a.chave] ?? '',
    }))

    const { error } = await supabase
      .from('rotinas_financeiras_status')
      .upsert(registros, { onConflict: 'rotina_id,unidade,ano,mes' })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar lançamento em massa', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: `${registros.length} status salvos pra ${MESES_NOMES[Number(mes) - 1]}/${ano}` })
    setAberto(false)
    onSalvo(ano, mes)
  }

  const rotinaAtual = rotinasAtivas.find(r => r.id === rotinaId)

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setAberto(true)}>
        <Layers className="h-4 w-4" />
        Lançamento em massa
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lançamento em massa</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escolha uma rotina pra marcar todas as unidades de uma vez, ou uma unidade pra marcar todas as rotinas —
              útil pra subir retroativo. Quem já era N/A no mês anterior vem sugerido automaticamente (ainda editável).
              Observação continua sendo por célula, na matriz normal.
            </p>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Lançar por</Label>
                <PillToggle
                  opcoes={[{ value: 'rotina', label: 'Rotina' }, { value: 'unidade', label: 'Unidade' }] as const}
                  value={modo}
                  onChange={setModo}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ano</Label>
                <Select value={ano} onValueChange={setAno}>
                  <SelectTrigger className={cn('w-24', selectGlamour)}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ANOS_OPCOES.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mês</Label>
                <Select value={mes} onValueChange={setMes}>
                  <SelectTrigger className={cn('w-36', selectGlamour)}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {modo === 'rotina' ? (
                <div className="min-w-[220px] flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Rotina</Label>
                  <Select value={rotinaId} onValueChange={setRotinaId}>
                    <SelectTrigger className={cn('w-full', selectGlamour)}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {rotinasAtivas.map(r => <SelectItem key={r.id} value={r.id as string}>[{r.setor}] {r.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="min-w-[220px] flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Unidade</Label>
                  <Select value={unidadeCodigo} onValueChange={setUnidadeCodigo}>
                    <SelectTrigger className={cn('w-full', selectGlamour)}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {unidades.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {modo === 'rotina' && rotinaAtual?.prazo && (
              <p className="text-xs text-muted-foreground">Prazo: {rotinaAtual.prazo}</p>
            )}

            <div className="flex items-center gap-2 border-t pt-3">
              <span className="text-xs text-muted-foreground">Marcar tudo:</span>
              <Button variant="ghost" size="sm" className="h-7 text-emerald-700 dark:text-emerald-400" onClick={() => marcarTodos('OK')}>Tudo OK</Button>
              <Button variant="ghost" size="sm" className="h-7 text-red-700 dark:text-red-400" onClick={() => marcarTodos('NOK')}>Tudo NOK</Button>
              <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={() => marcarTodos('N/A')}>Tudo N/A</Button>
              <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={() => marcarTodos('')}>Limpar tudo</Button>
            </div>

            {carregando ? (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            ) : (
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {alvos.map(a => (
                  <div key={a.chave} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <span className="truncate text-sm">
                      {a.setor && <span className="mr-1.5 text-xs text-muted-foreground">[{a.setor}]</span>}
                      {a.label}
                      {sugeridos.has(a.chave) && (
                        <span
                          className="ml-1.5 text-[10px] font-medium italic text-muted-foreground"
                          title="Sugerido porque era N/A no mês anterior — ainda não confirmado neste mês"
                        >
                          (sugestão: N/A)
                        </span>
                      )}
                    </span>
                    <StatusPicker value={valores[a.chave] ?? ''} onChange={v => alterarValor(a.chave, v)} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando || carregando} className="gap-2">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar {alvos.length} status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
