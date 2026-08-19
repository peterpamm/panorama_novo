import { useEffect, useMemo, useState } from 'react'
import { CalendarOff, CalendarPlus, GripVertical, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { TableCard } from '@/components/ui/table-card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { chaveStatus, mapaStatusExibicao, mesAnterior, type StatusExibicaoRotina } from '@/lib/rotinas-financeiras'
import { gradeDoMes, prazoDaRotina, rotuloPrazoEstruturado } from '@/lib/rotina-prazo'
import { agruparRotinasComAjustes } from '@/lib/rotina-ajuste-dia'
import { agruparEventosPorDia, rotuloRecorrencia, type OcorrenciaEvento } from '@/lib/calendario-eventos'
import { CORES_EVENTO, EventoCalendarioDialog, eventoNovo } from '@/components/financeira/EventoCalendarioDialog'
import {
  AJUSTE_TODAS_UNIDADES,
  type CalendarioEvento, type CalendarioEventoAjusteDia, type RotinaAjusteDia, type RotinaFinanceira, type RotinaFinanceiraStatus,
} from '@/types'

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const ANO_ATUAL = new Date().getFullYear()
const ANOS_OPCOES = [ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL + 1]

/** Cor do chip por status da rotina no mês — mesma paleta da matriz de Acompanhamento. */
const CHIP_ESTILO: Record<string, string> = {
  OK: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  NOK: 'bg-red-500/15 text-red-700 dark:text-red-400',
  'N/A': 'bg-muted text-muted-foreground',
  pendente: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
}

function chaveEstilo(status: StatusExibicaoRotina | undefined): keyof typeof CHIP_ESTILO {
  if (!status || status.status === null) return 'pendente'
  return status.status
}

const LEGENDA: { chave: keyof typeof CHIP_ESTILO; label: string }[] = [
  { chave: 'OK', label: 'OK' },
  { chave: 'NOK', label: 'NOK' },
  { chave: 'N/A', label: 'N/A' },
  { chave: 'pendente', label: 'Sem resposta' },
]

/**
 * Calendário das rotinas financeiras — a mesma informação da matriz de
 * Acompanhamento, mas distribuída no mês, que é como o time enxerga o
 * trabalho ("o que vence essa semana?"). Uma unidade por vez de propósito:
 * com 15+ unidades × 20 rotinas o mês vira ilegível — o panorama entre
 * unidades continua sendo o Dashboard.
 *
 * O dia de vencimento sai do prazo estruturado do cadastro (ver
 * `rotina-prazo.ts`), com os ajustes de arrastar por cima (ver
 * `rotina-ajuste-dia.ts`). Rotina cujo prazo depende de outro evento não tem
 * dia e aparece na lista "Sem data definida" — de onde também dá pra
 * arrastar pra dentro do mês.
 *
 * Arrastar é só pra admin (`podeEditar`): pros demais o calendário é
 * estritamente leitura, sem cursor de arrastar, pra não parecer quebrado.
 */
interface CalendarioRotinasTabProps {
  /** false = só visualização; some o arrastar e o dialog de ajuste. */
  podeEditar: boolean
}

export function CalendarioRotinasTab({ podeEditar }: CalendarioRotinasTabProps) {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const unidadesFiltro = useMemo(() => unidades.filter(u => u.codigo !== 'AMBEV'), [unidades])

  const [ano, setAno] = useState(String(ANO_ATUAL))
  const [mes, setMes] = useState(String(new Date().getMonth() + 1))
  const [unidadeSel, setUnidadeSel] = useState('')

  useEffect(() => {
    if (!unidadeSel && unidadesFiltro.length > 0) setUnidadeSel(unidadesFiltro[0].codigo)
  }, [unidadesFiltro, unidadeSel])

  const [rotinas, setRotinas] = useState<RotinaFinanceira[]>([])
  const [statusLista, setStatusLista] = useState<RotinaFinanceiraStatus[]>([])
  const [statusListaAnterior, setStatusListaAnterior] = useState<RotinaFinanceiraStatus[]>([])
  const [ajustes, setAjustes] = useState<RotinaAjusteDia[]>([])
  const [eventos, setEventos] = useState<CalendarioEvento[]>([])
  const [eventoAjustes, setEventoAjustes] = useState<CalendarioEventoAjusteDia[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    const anterior = mesAnterior(Number(ano), Number(mes))
    const [r, s, sAnt, aj, ev, evAj] = await Promise.all([
      supabase.from('rotinas_financeiras').select('*').eq('ativo', true).order('setor').order('ordem'),
      supabase.from('rotinas_financeiras_status').select('*').eq('ano', Number(ano)).eq('mes', Number(mes)),
      supabase.from('rotinas_financeiras_status').select('*').eq('ano', anterior.ano).eq('mes', anterior.mes),
      // Todos os ajustes: os permanentes de meses passados continuam valendo,
      // então filtrar por mês aqui esconderia justamente o que está em vigor.
      supabase.from('rotinas_financeiras_ajuste_dia').select('*'),
      // Mesmo motivo nos eventos: um RPS criado em janeiro segue valendo hoje.
      supabase.from('calendario_eventos').select('*').order('titulo'),
      // Ajustes de dia dos eventos são sempre pontuais (sem "permanente"), já
      // filtra por ano/mês — um ajuste de outro mês não tem por que existir aqui.
      supabase.from('calendario_eventos_ajuste_dia').select('*').eq('ano', Number(ano)).eq('mes', Number(mes)),
    ])
    if (r.error) toast({ title: 'Erro ao carregar rotinas', description: r.error.message, variant: 'destructive' })
    if (s.error) toast({ title: 'Erro ao carregar acompanhamento', description: s.error.message, variant: 'destructive' })
    if (aj.error) toast({ title: 'Erro ao carregar ajustes de dia', description: aj.error.message, variant: 'destructive' })
    if (ev.error) toast({ title: 'Erro ao carregar eventos', description: ev.error.message, variant: 'destructive' })
    if (evAj.error) toast({ title: 'Erro ao carregar ajustes de evento', description: evAj.error.message, variant: 'destructive' })
    setRotinas((r.data as RotinaFinanceira[]) ?? [])
    setStatusLista((s.data as RotinaFinanceiraStatus[]) ?? [])
    setStatusListaAnterior((sAnt.data as RotinaFinanceiraStatus[]) ?? [])
    setAjustes((aj.data as RotinaAjusteDia[]) ?? [])
    // `unidades ?? []` blinda contra o schema antigo (coluna `unidade` única,
    // pré-migration 105) — sem isso, uma migration atrasada derrubava a tela
    // inteira (evento.unidades undefined quebrando o .includes() em cascata).
    setEventos(((ev.data as CalendarioEvento[]) ?? []).map(e => ({ ...e, unidades: e.unidades ?? [] })))
    setEventoAjustes((evAj.data as CalendarioEventoAjusteDia[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [ano, mes]) // eslint-disable-line react-hooks/exhaustive-deps

  const statusPorChave = useMemo(
    () => mapaStatusExibicao(statusLista, statusListaAnterior),
    [statusLista, statusListaAnterior],
  )

  const { porDia, semData } = useMemo(
    () => agruparRotinasComAjustes(rotinas, ajustes, unidadeSel, Number(ano), Number(mes)),
    [rotinas, ajustes, unidadeSel, ano, mes],
  )

  const eventosPorDia = useMemo(
    () => agruparEventosPorDia(eventos, eventoAjustes, unidadeSel, Number(ano), Number(mes)),
    [eventos, eventoAjustes, unidadeSel, ano, mes],
  )

  const semanas = useMemo(() => gradeDoMes(Number(ano), Number(mes)), [ano, mes])

  // ── Eventos (RPS e afins) ───────────────────────────────────────────────
  const [eventoEditando, setEventoEditando] = useState<CalendarioEvento | null>(null)

  function statusDaRotina(rotina: RotinaFinanceira): StatusExibicaoRotina | undefined {
    return statusPorChave.get(chaveStatus(rotina.id ?? '', unidadeSel))
  }

  // ── Arrastar pra outro dia (só admin) ───────────────────────────────────
  const [arrastando, setArrastando] = useState<RotinaFinanceira | null>(null)
  const [diaAlvo, setDiaAlvo] = useState<number | null>(null)
  const [soltura, setSoltura] = useState<{ rotina: RotinaFinanceira; dia: number } | null>(null)
  const [todasUnidades, setTodasUnidades] = useState(false)
  const [mesesSeguintes, setMesesSeguintes] = useState(false)
  const [salvandoAjuste, setSalvandoAjuste] = useState(false)

  // ── Arrastar um evento (exceção pontual dessa ocorrência) ────────────────
  const [arrastandoEvento, setArrastandoEvento] = useState<OcorrenciaEvento | null>(null)
  const [solturaEvento, setSolturaEvento] = useState<{ ocorrencia: OcorrenciaEvento; dia: number } | null>(null)
  const [todasUnidadesEvento, setTodasUnidadesEvento] = useState(false)
  const [salvandoAjusteEvento, setSalvandoAjusteEvento] = useState(false)

  function aoSoltar(dia: number) {
    setDiaAlvo(null)
    if (arrastandoEvento) {
      const ocorrencia = arrastandoEvento
      setArrastandoEvento(null)
      // O dia atualmente exibido é o diaOriginal reprocessado pelo ajuste
      // vigente — precisa achar onde a ocorrência está DESENHADA agora (não
      // o diaOriginal em si), senão soltar no mesmo lugar abriria o dialog à toa.
      const diaAtual = Array.from(eventosPorDia.entries())
        .find(([, lista]) => lista.some(o => o.evento.id === ocorrencia.evento.id && o.diaOriginal === ocorrencia.diaOriginal))?.[0] ?? null
      if (diaAtual === dia) return
      setTodasUnidadesEvento(false)
      setSolturaEvento({ ocorrencia, dia })
      return
    }
    const rotina = arrastando
    setArrastando(null)
    if (!rotina) return
    // Soltar no mesmo dia não é ajuste nenhum — não abre o dialog à toa.
    const diaAtual = Array.from(porDia.entries()).find(([, lista]) => lista.some(r => r.id === rotina.id))?.[0] ?? null
    if (diaAtual === dia) return
    setTodasUnidades(false)
    setMesesSeguintes(false)
    setSoltura({ rotina, dia })
  }

  async function confirmarAjuste() {
    if (!soltura) return
    setSalvandoAjuste(true)
    const { error } = await supabase.from('rotinas_financeiras_ajuste_dia').upsert(
      {
        rotina_id: soltura.rotina.id,
        unidade: todasUnidades ? AJUSTE_TODAS_UNIDADES : unidadeSel,
        ano: Number(ano),
        mes: Number(mes),
        dia: soltura.dia,
        permanente: mesesSeguintes,
      },
      { onConflict: 'rotina_id,unidade,ano,mes,permanente' },
    )
    setSalvandoAjuste(false)
    if (error) {
      toast({ title: 'Erro ao mover a rotina', description: error.message, variant: 'destructive' })
      return
    }
    toast({
      title: `${soltura.rotina.nome} movida pro dia ${soltura.dia}`,
      description: [
        todasUnidades ? 'Todas as unidades' : nomeUnidadeSel,
        mesesSeguintes ? `de ${MESES_NOMES[Number(mes) - 1]}/${ano} em diante` : `só em ${MESES_NOMES[Number(mes) - 1]}/${ano}`,
      ].join(' · '),
    })
    setSoltura(null)
    await carregar()
  }

  async function confirmarAjusteEvento() {
    if (!solturaEvento) return
    setSalvandoAjusteEvento(true)
    const { error } = await supabase.from('calendario_eventos_ajuste_dia').upsert(
      {
        evento_id: solturaEvento.ocorrencia.evento.id,
        unidade: todasUnidadesEvento ? AJUSTE_TODAS_UNIDADES : unidadeSel,
        ano: Number(ano),
        mes: Number(mes),
        dia_original: solturaEvento.ocorrencia.diaOriginal,
        dia_novo: solturaEvento.dia,
      },
      { onConflict: 'evento_id,unidade,ano,mes,dia_original' },
    )
    setSalvandoAjusteEvento(false)
    if (error) {
      toast({ title: 'Erro ao mover o evento', description: error.message, variant: 'destructive' })
      return
    }
    toast({
      title: `${solturaEvento.ocorrencia.evento.titulo} movido pro dia ${solturaEvento.dia}`,
      description: `${todasUnidadesEvento ? 'Todas as unidades' : nomeUnidadeSel} · só essa ocorrência (dia ${solturaEvento.ocorrencia.diaOriginal} de ${MESES_NOMES[Number(mes) - 1]}/${ano})`,
    })
    setSolturaEvento(null)
    await carregar()
  }

  const nomeUnidadeSel = unidadesFiltro.find(u => u.codigo === unidadeSel)?.nome ?? unidadeSel

  const hoje = new Date()
  const ehMesAtual = hoje.getFullYear() === Number(ano) && hoje.getMonth() + 1 === Number(mes)

  const totalNaGrade = useMemo(
    () => Array.from(porDia.values()).reduce((acc, lista) => acc + lista.length, 0),
    [porDia],
  )

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
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Unidade</Label>
          <Select value={unidadeSel} onValueChange={setUnidadeSel}>
            <SelectTrigger className={cn('w-56', selectGlamour)}><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {unidadesFiltro.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {podeEditar && (
          <div className="space-y-1.5">
            <Label className="text-xs text-transparent">.</Label>
            <Button variant="outline" onClick={() => setEventoEditando(eventoNovo(unidadeSel))} className="gap-2">
              <CalendarPlus className="h-4 w-4" />
              Novo evento
            </Button>
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-3 pb-2">
          {LEGENDA.map(l => (
            <span key={l.chave} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn('h-3 w-3 rounded', CHIP_ESTILO[l.chave])} />
              {l.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('h-3 w-3 rounded', CORES_EVENTO.roxo)} />
            Evento
          </span>
        </div>
      </div>

      <TableCard
        titulo={`Calendário — ${MESES_NOMES[Number(mes) - 1]} ${ano}`}
        subtitulo={carregando
          ? 'Carregando...'
          : `${totalNaGrade} rotina(s) no mês · ${nomeUnidadeSel} · ${podeEditar ? 'arraste um chip pra mudar o dia' : 'somente visualização'}`}
      >
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : rotinas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma rotina ativa cadastrada — cadastre na aba Cadastro.
          </p>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-gray-200/60 bg-gray-200/60 dark:border-gray-700/60 dark:bg-gray-700/60">
              {DIAS_SEMANA.map(d => (
                <div key={d} className="bg-card px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {d}
                </div>
              ))}

              {semanas.flat().map((celula, i) => {
                const doDia = celula.dia === null ? [] : porDia.get(celula.dia) ?? []
                const ehHoje = ehMesAtual && celula.dia === hoje.getDate()
                return (
                  <div
                    key={i}
                    onDragOver={podeEditar && celula.dia !== null ? e => { e.preventDefault(); setDiaAlvo(celula.dia) } : undefined}
                    onDragLeave={podeEditar ? () => setDiaAlvo(d => (d === celula.dia ? null : d)) : undefined}
                    onDrop={podeEditar && celula.dia !== null ? () => aoSoltar(celula.dia as number) : undefined}
                    className={cn(
                      'min-h-[104px] bg-card p-1.5 transition-colors',
                      celula.dia === null && 'bg-muted/30',
                      celula.fimDeSemana && celula.dia !== null && 'bg-muted/20',
                      ehHoje && 'ring-2 ring-inset ring-blue-500/60',
                      diaAlvo === celula.dia && celula.dia !== null && 'bg-blue-500/10 ring-2 ring-inset ring-blue-500/40',
                    )}
                  >
                    {celula.dia !== null && (
                      <>
                        <div className={cn(
                          'mb-1 text-xs font-semibold',
                          ehHoje ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground',
                        )}>
                          {celula.dia}
                        </div>
                        <div className="space-y-1">
                          {(eventosPorDia.get(celula.dia) ?? []).map(ocorrencia => (
                            <div
                              key={`${ocorrencia.evento.id}-${ocorrencia.diaOriginal}`}
                              draggable={podeEditar}
                              onDragStart={podeEditar ? () => setArrastandoEvento(ocorrencia) : undefined}
                              onDragEnd={podeEditar ? () => { setArrastandoEvento(null); setDiaAlvo(null) } : undefined}
                              onClick={podeEditar ? () => setEventoEditando(ocorrencia.evento) : undefined}
                              title={`${ocorrencia.evento.titulo}\n${rotuloRecorrencia(ocorrencia.evento)}${ocorrencia.evento.unidades.includes(AJUSTE_TODAS_UNIDADES) ? ' · todas as unidades' : ocorrencia.evento.unidades.length > 1 ? ` · ${ocorrencia.evento.unidades.length} unidades` : ''}${ocorrencia.evento.descricao ? `\n${ocorrencia.evento.descricao}` : ''}${podeEditar ? '\nArraste pra outro dia pra mover só essa ocorrência' : ''}`}
                              className={cn(
                                'flex items-center gap-0.5 truncate rounded px-1.5 py-1 text-[11px] font-semibold leading-tight',
                                CORES_EVENTO[ocorrencia.evento.cor],
                                podeEditar && 'cursor-grab active:cursor-grabbing hover:brightness-95',
                                arrastandoEvento?.evento.id === ocorrencia.evento.id && arrastandoEvento?.diaOriginal === ocorrencia.diaOriginal && 'opacity-40',
                              )}
                            >
                              {podeEditar && <GripVertical className="h-3 w-3 shrink-0 opacity-50" />}
                              <span className="truncate">{ocorrencia.evento.titulo}</span>
                            </div>
                          ))}
                          {doDia.map(rotina => {
                            const status = statusDaRotina(rotina)
                            return (
                              <div
                                key={rotina.id}
                                draggable={podeEditar}
                                onDragStart={podeEditar ? () => setArrastando(rotina) : undefined}
                                onDragEnd={podeEditar ? () => { setArrastando(null); setDiaAlvo(null) } : undefined}
                                title={`${rotina.setor} — ${rotina.nome}\nCadastro: ${rotuloPrazoEstruturado(prazoDaRotina(rotina))}${status?.observacao ? `\nObs: ${status.observacao}` : ''}${podeEditar ? '\nArraste pra outro dia pra ajustar' : ''}`}
                                className={cn(
                                  'flex items-center gap-0.5 rounded px-1.5 py-1 text-[11px] font-medium leading-tight',
                                  CHIP_ESTILO[chaveEstilo(status)],
                                  status?.herdado && 'border border-dashed border-current/40',
                                  podeEditar && 'cursor-grab active:cursor-grabbing',
                                  arrastando?.id === rotina.id && 'opacity-40',
                                )}
                              >
                                {podeEditar && <GripVertical className="h-3 w-3 shrink-0 opacity-50" />}
                                <span className="truncate">{rotina.nome}</span>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </TableCard>

      {!carregando && semData.length > 0 && (
        <TableCard
          titulo="Sem data definida"
          subtitulo={`${semData.length} rotina(s) cujo prazo depende de outro evento — defina o Vencimento no Cadastro pra elas entrarem na grade`}
        >
          <div className="flex flex-wrap gap-2 p-4">
            {semData.map(rotina => {
              const status = statusDaRotina(rotina)
              return (
                <span
                  key={rotina.id}
                  draggable={podeEditar}
                  onDragStart={podeEditar ? () => setArrastando(rotina) : undefined}
                  onDragEnd={podeEditar ? () => { setArrastando(null); setDiaAlvo(null) } : undefined}
                  title={`${rotina.setor} — ${rotina.nome}${rotina.prazo ? `\nPrazo: ${rotina.prazo}` : ''}${podeEditar ? '\nArraste pra um dia do calendário pra dar data a ela neste mês' : ''}`}
                  className={cn(
                    'flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium',
                    CHIP_ESTILO[chaveEstilo(status)],
                    podeEditar && 'cursor-grab active:cursor-grabbing',
                    arrastando?.id === rotina.id && 'opacity-40',
                  )}
                >
                  <CalendarOff className="h-3 w-3 shrink-0" />
                  {rotina.nome}
                </span>
              )
            })}
          </div>
        </TableCard>
      )}

      <EventoCalendarioDialog
        evento={eventoEditando}
        unidades={unidadesFiltro}
        onFechar={() => setEventoEditando(null)}
        onSalvo={() => { setEventoEditando(null); carregar() }}
      />

      {/* Confirmação do arrastar — as duas perguntas que definem o alcance do
          ajuste. O padrão é o mais conservador (só esta unidade, só este mês);
          "todas as unidades" existe pro caso do vencimento cair em fim de
          semana/feriado, que atinge todo mundo de uma vez. */}
      <Dialog open={soltura !== null} onOpenChange={v => { if (!v) setSoltura(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mover pro dia {soltura?.dia}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{soltura?.rotina.nome}</span> passa a vencer no dia{' '}
            <span className="font-medium text-foreground">{soltura?.dia}</span> de {MESES_NOMES[Number(mes) - 1]}/{ano}.
          </p>

          <div className="space-y-3 rounded-lg border border-gray-200/60 p-3 dark:border-gray-700/60">
            <label className="flex items-start gap-2.5">
              <Checkbox checked={todasUnidades} onCheckedChange={v => setTodasUnidades(v === true)} className="mt-0.5" />
              <span className="text-sm">
                Aplicar a <span className="font-medium">todas as unidades</span>
                <span className="block text-xs text-muted-foreground">
                  Desmarcado, vale só pra {nomeUnidadeSel}.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5">
              <Checkbox checked={mesesSeguintes} onCheckedChange={v => setMesesSeguintes(v === true)} className="mt-0.5" />
              <span className="text-sm">
                Aplicar aos <span className="font-medium">meses seguintes</span>
                <span className="block text-xs text-muted-foreground">
                  Desmarcado, vale só em {MESES_NOMES[Number(mes) - 1]}/{ano} — os outros meses continuam no dia do cadastro.
                </span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSoltura(null)} disabled={salvandoAjuste}>Cancelar</Button>
            <Button onClick={confirmarAjuste} disabled={salvandoAjuste} className="gap-2">
              {salvandoAjuste && <Loader2 className="h-4 w-4 animate-spin" />}
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação do arrastar de evento — sempre pontual (só essa
          ocorrência, mesmo dia_original sobrescreve se arrastar de novo), sem
          "meses seguintes": se a recorrência mudou de vez, o jeito é editar o
          evento, não empilhar exceção. */}
      <Dialog open={solturaEvento !== null} onOpenChange={v => { if (!v) setSolturaEvento(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mover pro dia {solturaEvento?.dia}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{solturaEvento?.ocorrencia.evento.titulo}</span> do dia{' '}
            <span className="font-medium text-foreground">{solturaEvento?.ocorrencia.diaOriginal}</span> passa pro dia{' '}
            <span className="font-medium text-foreground">{solturaEvento?.dia}</span> de {MESES_NOMES[Number(mes) - 1]}/{ano} — só
            essa ocorrência; nas próximas semanas/meses continua no dia normal.
          </p>

          {solturaEvento && (solturaEvento.ocorrencia.evento.unidades.length > 1 || solturaEvento.ocorrencia.evento.unidades.includes(AJUSTE_TODAS_UNIDADES)) && (
            <div className="rounded-lg border border-gray-200/60 p-3 dark:border-gray-700/60">
              <label className="flex items-start gap-2.5">
                <Checkbox checked={todasUnidadesEvento} onCheckedChange={v => setTodasUnidadesEvento(v === true)} className="mt-0.5" />
                <span className="text-sm">
                  Aplicar a <span className="font-medium">todas as unidades do evento</span>
                  <span className="block text-xs text-muted-foreground">
                    Desmarcado, vale só pra {nomeUnidadeSel} — as outras unidades continuam vendo no dia normal.
                  </span>
                </span>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSolturaEvento(null)} disabled={salvandoAjusteEvento}>Cancelar</Button>
            <Button onClick={confirmarAjusteEvento} disabled={salvandoAjusteEvento} className="gap-2">
              {salvandoAjusteEvento && <Loader2 className="h-4 w-4 animate-spin" />}
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
