import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Moon, Sun, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDreLongo } from '@/hooks/useDreLongo'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/hooks/useTheme'
import { fetchOrcamentoPaginado } from '@/lib/orcamento-fetch'
import { useEncontroContas } from '@/hooks/useEncontroContas'
import { usePlanosAcao, usePlanoAcaoTags } from '@/hooks/usePlanosAcao'
import { useSdgJustificativas } from '@/hooks/useSdgJustificativas'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slide01Ebitda } from '@/pages/sdg/Slide01Ebitda'
import { SlideIndicador } from '@/pages/sdg/SlideIndicador'
import { Slide03AdmGeral } from '@/pages/sdg/Slide03AdmGeral'
import { SlidePerdaDre } from '@/pages/sdg/SlidePerdaDre'
import { SlideIndicadorArmazem } from '@/pages/sdg/SlideIndicadorArmazem'
import { SlideEncontroContas } from '@/pages/sdg/SlideEncontroContas'
import { SlideRotinas } from '@/pages/sdg/SlideRotinas'
import { SlidePlanoAcao } from '@/pages/sdg/SlidePlanoAcao'
import { SlideAssuntosGerais } from '@/pages/sdg/SlideAssuntosGerais'
import { cn } from '@/lib/utils'
import type { OrcamentoLinha, PlanoAcao, SdgIndicador, Unidade } from '@/types'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const SLIDES = [
  { id: 'ebitda',              titulo: 'EBITDA'                },
  { id: 'adm-geral',           titulo: 'Despesa Administrativa' },
  { id: 'despesa-adm',         titulo: 'Despesas ADM Gerais'    },
  { id: 'vales',               titulo: 'Vales (Pacote Geral)'   },
  { id: 'vales-financeiros',  titulo: 'Vales Financeiros'      },
  { id: 'vales-fisicos',      titulo: 'Vales Físicos'          },
  { id: 'refugo',              titulo: 'Refugo'                 },
  { id: 'quebras',             titulo: 'Quebras'                },
  { id: 'encontro-contas',     titulo: 'Encontro de Contas'     },
  { id: 'multas',              titulo: 'Multas'                 },
  { id: 'rotinas',             titulo: 'Rotinas'                },
  { id: 'plano-acao',          titulo: 'Plano de Ação'          },
  { id: 'assuntos-gerais',     titulo: 'Assuntos Gerais'        },
] as const

function unicos<T>(arr: T[]): T[] { return Array.from(new Set(arr)) }

export function SdgFinanceiroPage() {
  const { role, unidade: unidadeUsuario } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  // ── Filtros ──────────────────────────────────────────────────────────────
  const [selUnidade, setSelUnidade] = useState<string>('')
  const [selAno, setSelAno] = useState<number | null>(null)
  const [selMes, setSelMes] = useState<number | null>(null)
  const [slideIdx, setSlideIdx] = useState(0)

  // Busca própria de unidades — essa página roda numa rota tela-cheia fora
  // do DataProvider (sem sidebar/AppShell), então não pode usar useUnidades()
  // (que depende do cache global do DataContext); só precisa da lista, não
  // do DRE/orçamento de todas as unidades que o DataProvider carregaria junto.
  const [unidades, setUnidades] = useState<Unidade[]>([])
  useEffect(() => {
    supabase.from('unidades').select('*').order('nome').then(({ data }) => setUnidades(data ?? []))
  }, [])

  // Inicializa unidade com a do usuário (ou primeira disponível para admins)
  useEffect(() => {
    if (selUnidade || unidades.length === 0) return
    const primeira = role === 'admin'
      ? unidades.find(u => u.codigo !== 'AMBEV')?.codigo
      : (unidadeUsuario ?? undefined)
    if (primeira) setSelUnidade(primeira)
  }, [unidades, role, unidadeUsuario, selUnidade])

  // ── Dados ─────────────────────────────────────────────────────────────────
  const { rows, loading } = useDreLongo(selUnidade || null)
  const { ecs } = useEncontroContas()
  const { planos } = usePlanosAcao()
  const { tags } = usePlanoAcaoTags()
  const { porIndicador: justificativas } = useSdgJustificativas(selUnidade, selAno, selMes)

  // Tags do Plano de Ação ligadas a cada indicador do SDG (ver
  // planos_acao_tags.sdg_indicador) — permite mostrar, em cada slide, só as
  // ações ativas da unidade cuja tag aponta pra aquele indicador.
  const tagsPorIndicador = useMemo(() => {
    const mapa: Partial<Record<SdgIndicador, Set<string>>> = {}
    for (const t of tags) {
      if (!t.sdg_indicador) continue
      if (!mapa[t.sdg_indicador]) mapa[t.sdg_indicador] = new Set()
      mapa[t.sdg_indicador]!.add(t.nome)
    }
    return mapa
  }, [tags])

  function acoesDoIndicador(indicador: SdgIndicador): PlanoAcao[] {
    const nomes = tagsPorIndicador[indicador]
    if (!nomes) return []
    return planos.filter(p => p.unidade === selUnidade && p.status !== 'validado' && nomes.has(p.tag))
  }

  const rowsNegocio = useMemo(() => rows.filter(r => r.negocio === 'CONS'), [rows])

  const anosDisponiveis = useMemo(
    () => unicos(rowsNegocio.map(r => r.ano)).sort((a, b) => a - b),
    [rowsNegocio],
  )
  useEffect(() => {
    if (anosDisponiveis.length === 0) return
    if (selAno && anosDisponiveis.includes(selAno)) return
    setSelAno(anosDisponiveis[anosDisponiveis.length - 1])
  }, [anosDisponiveis, selAno])

  const rowsAno = useMemo(
    () => rowsNegocio.filter(r => r.ano === selAno),
    [rowsNegocio, selAno],
  )

  // Meta vem do Orçamento (mesma fonte do Farol de Metas — ver orcamento-farol.ts),
  // não da tabela `metas`/AVO do DRE: o AVO embutido no DRE parou de vir a
  // partir da migração pro Orçamento, então a meta mensal sumiria sem isso.
  const [orcamentoRows, setOrcamentoRows] = useState<OrcamentoLinha[]>([])
  useEffect(() => {
    if (selUnidade === '' || selAno === null) { setOrcamentoRows([]); return }
    let cancelado = false
    fetchOrcamentoPaginado((from, to) =>
      supabase.from('orcamentos').select('*')
        .eq('unidade', selUnidade).eq('negocio', 'CONS').eq('ano', selAno)
        .order('id', { ascending: true })
        .range(from, to),
    )
      .then(rows => { if (!cancelado) setOrcamentoRows(rows) })
      .catch(() => { if (!cancelado) setOrcamentoRows([]) })
    return () => { cancelado = true }
  }, [selUnidade, selAno])

  const mesesDisponiveis = useMemo(
    () => unicos(rowsAno.filter(r => r.tipo_periodo === 'MENSAL').map(r => r.mes)).sort((a, b) => a - b),
    [rowsAno],
  )
  useEffect(() => {
    if (mesesDisponiveis.length === 0) return
    if (selMes && mesesDisponiveis.includes(selMes)) return
    setSelMes(mesesDisponiveis[mesesDisponiveis.length - 1])
  }, [mesesDisponiveis, selMes])

  const mesAcumMax = useMemo(() => {
    const acum = rowsAno.filter(r => r.tipo_periodo === 'ACUMULADO_ANO')
    return acum.length > 0 ? Math.max(...acum.map(r => r.mes)) : null
  }, [rowsAno])

  // ── Navegação por teclado ─────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // ↑/↓ ficam livres pro scroll vertical dos slides com tabela
      if (e.key === 'ArrowRight') setSlideIdx(i => Math.min(i + 1, SLIDES.length - 1))
      if (e.key === 'ArrowLeft')  setSlideIdx(i => Math.max(i - 1, 0))
      if (e.key === 'Escape')     navigate('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const unidadesDisponiveis = useMemo(
    () => unidades.filter(u => u.codigo !== 'AMBEV'),
    [unidades],
  )
  const nomeUnidade = unidades.find(u => u.codigo === selUnidade)?.nome ?? selUnidade

  const slideAtual = SLIDES[slideIdx]

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gradient-to-br from-slate-200 via-slate-200 to-blue-100 text-gray-900 dark:bg-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:text-white">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white/80 px-6 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
        {/* Título + slide */}
        <div className="flex items-center gap-4 min-w-0">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500">SDG Financeiro</div>
            <div className="text-lg font-bold leading-tight">{slideAtual.titulo}</div>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setSlideIdx(i)}
                title={s.titulo}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === slideIdx ? 'w-6 bg-blue-500 dark:bg-blue-400' : 'w-2 bg-gray-300 hover:bg-gray-400 dark:bg-slate-600 dark:hover:bg-slate-400',
                )}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400 dark:text-slate-500">{slideIdx + 1}/{SLIDES.length}</span>
        </div>

        {/* Filtros + toggle */}
        <div className="flex shrink-0 items-center gap-2">
          {role === 'admin' && (
            <Select value={selUnidade} onValueChange={setSelUnidade}>
              <SelectTrigger className="h-8 w-44 text-sm">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                {unidadesDisponiveis.map(u => (
                  <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={selMes?.toString() ?? ''} onValueChange={v => setSelMes(Number(v))}>
            <SelectTrigger className="h-8 w-24 text-sm">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {mesesDisponiveis.map(m => (
                <SelectItem key={m} value={m.toString()}>{MESES[m - 1]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selAno?.toString() ?? ''} onValueChange={v => setSelAno(Number(v))}>
            <SelectTrigger className="h-8 w-24 text-sm">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => (
                <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Unidade (para não-admin) */}
          {role !== 'admin' && (
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{nomeUnidade}</span>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={isDark ? 'Modo claro' : 'Modo escuro'}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Sair da apresentação */}
          <button
            onClick={() => navigate('/')}
            title="Sair da apresentação (Esc)"
            aria-label="Sair da apresentação"
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-red-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/15 dark:hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Slide area ──────────────────────────────────────────────────── */}
      <main className="relative flex-1 min-h-0">
        {loading || !selAno || !selMes ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-gray-400 dark:text-slate-500">
              {loading ? 'Carregando dados...' : 'Selecione uma unidade e período'}
            </div>
          </div>
        ) : (
          <>
            {slideIdx === 0 && (
              <Slide01Ebitda
                rowsAno={rowsAno}
                orcamentoRows={orcamentoRows}
                unidade={selUnidade}
                negocio="CONS"
                ano={selAno}
                mes={selMes}
                mesAcumMax={mesAcumMax}
                justificativa={justificativas.ebitda}
                acoesRelacionadas={acoesDoIndicador('ebitda')}
              />
            )}
            {slideIdx === 1 && (
              <SlideIndicador
                codigo="158"
                rowsAno={rowsAno}
                orcamentoRows={orcamentoRows}
                unidade={selUnidade}
                negocio="CONS"
                ano={selAno}
                mes={selMes}
                mesAcumMax={mesAcumMax}
                justificativa={justificativas['adm-geral']}
                acoesRelacionadas={acoesDoIndicador('adm-geral')}
              />
            )}
            {slideIdx === 2 && (
              <Slide03AdmGeral
                rowsAno={rowsAno}
                orcamentoRows={orcamentoRows}
                unidade={selUnidade}
                negocio="CONS"
                ano={selAno}
                mes={selMes}
                mesAcumMax={mesAcumMax}
                justificativa={justificativas['despesa-adm']}
                acoesRelacionadas={acoesDoIndicador('despesa-adm')}
              />
            )}
            {slideIdx === 3 && (
              <SlidePerdaDre
                titulo="Vales"
                contas={['052', '053']}
                rowsTodosAnos={rowsNegocio}
                unidadeSel={selUnidade}
                unidades={unidades}
                ano={selAno}
                mes={selMes}
                metaIndicador="vales"
                mostrarJustificativa={false}
              />
            )}
            {slideIdx === 4 && (
              <SlidePerdaDre
                titulo="052 Vales Financeiros"
                contas={['052']}
                rowsTodosAnos={rowsNegocio}
                unidadeSel={selUnidade}
                unidades={unidades}
                ano={selAno}
                mes={selMes}
                justificativa={justificativas['vales-financeiros']}
                acoesRelacionadas={acoesDoIndicador('vales-financeiros')}
              />
            )}
            {slideIdx === 5 && (
              <SlidePerdaDre
                titulo="053 Vales Físicos"
                contas={['053']}
                rowsTodosAnos={rowsNegocio}
                unidadeSel={selUnidade}
                unidades={unidades}
                ano={selAno}
                mes={selMes}
                justificativa={justificativas['vales-fisicos']}
                acoesRelacionadas={acoesDoIndicador('vales-fisicos')}
              />
            )}
            {slideIdx === 6 && (
              <SlideIndicadorArmazem
                tipo="refugo"
                unidadeSel={selUnidade}
                unidades={unidades}
                ano={selAno}
                mes={selMes}
                justificativa={justificativas.refugo}
                acoesRelacionadas={acoesDoIndicador('refugo')}
              />
            )}
            {slideIdx === 7 && (
              <SlideIndicadorArmazem
                tipo="quebras"
                unidadeSel={selUnidade}
                unidades={unidades}
                ano={selAno}
                mes={selMes}
                justificativa={justificativas.quebras}
                acoesRelacionadas={acoesDoIndicador('quebras')}
              />
            )}
            {slideIdx === 8 && (
              <SlideEncontroContas
                ecs={ecs}
                unidadeSel={selUnidade}
                ano={selAno}
                mes={selMes}
                justificativa={justificativas['encontro-contas']}
                acoesRelacionadas={acoesDoIndicador('encontro-contas')}
              />
            )}
            {slideIdx === 9 && (
              <SlidePerdaDre
                titulo="Multas"
                contas={['138', '223']}
                rowsTodosAnos={rowsNegocio}
                unidadeSel={selUnidade}
                unidades={unidades}
                ano={selAno}
                mes={selMes}
                justificativa={justificativas.multas}
                acoesRelacionadas={acoesDoIndicador('multas')}
              />
            )}
            {slideIdx === 10 && (
              <SlideRotinas
                unidadeSel={selUnidade}
                ano={selAno}
                mes={selMes}
              />
            )}
            {slideIdx === 11 && (
              <SlidePlanoAcao
                planos={planos}
                unidadeSel={selUnidade}
              />
            )}
            {slideIdx === 12 && (
              <SlideAssuntosGerais
                justificativa={justificativas['assuntos-gerais']}
              />
            )}
          </>
        )}

        {/* Navegação prev/next */}
        <button
          onClick={() => setSlideIdx(i => Math.max(i - 1, 0))}
          disabled={slideIdx === 0}
          className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-500 shadow backdrop-blur-sm transition hover:bg-gray-100 disabled:opacity-20 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => setSlideIdx(i => Math.min(i + 1, SLIDES.length - 1))}
          disabled={slideIdx === SLIDES.length - 1}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-500 shadow backdrop-blur-sm transition hover:bg-gray-100 disabled:opacity-20 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-gray-200 bg-white/60 px-6 py-2 text-center text-xs text-gray-400 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-600">
        {nomeUnidade} · {MESES[(selMes ?? 1) - 1]}/{selAno} · Use ← → para navegar entre slides
      </footer>
    </div>
  )
}
