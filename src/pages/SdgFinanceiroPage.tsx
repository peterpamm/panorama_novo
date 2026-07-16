import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Moon, Sun, X } from 'lucide-react'
import { useDreLongo } from '@/hooks/useDreLongo'
import { useMetas } from '@/hooks/useMetas'
import { useUnidades } from '@/hooks/useUnidades'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/hooks/useTheme'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slide01Ebitda } from '@/pages/sdg/Slide01Ebitda'
import { SlideIndicador } from '@/pages/sdg/SlideIndicador'
import { Slide03AdmGeral } from '@/pages/sdg/Slide03AdmGeral'
import { SlidePerdaDre } from '@/pages/sdg/SlidePerdaDre'
import { cn } from '@/lib/utils'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const SLIDES = [
  { id: 'ebitda',      titulo: 'EBITDA'                },
  { id: 'adm-geral',   titulo: 'Despesa Administrativa' },
  { id: 'despesa-adm', titulo: 'Despesas ADM Gerais'    },
  { id: 'vales',       titulo: 'Vales'                  },
  { id: 'multas',      titulo: 'Multas'                 },
] as const

function unicos<T>(arr: T[]): T[] { return Array.from(new Set(arr)) }

export function SdgFinanceiroPage() {
  const { role, unidade: unidadeUsuario } = useAuth()
  const { unidades } = useUnidades()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  // ── Filtros ──────────────────────────────────────────────────────────────
  const [selUnidade, setSelUnidade] = useState<string>('')
  const [selAno, setSelAno] = useState<number | null>(null)
  const [selMes, setSelMes] = useState<number | null>(null)
  const [slideIdx, setSlideIdx] = useState(0)

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
  const { metas } = useMetas(selUnidade || null)

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
                metas={metas}
                unidade={selUnidade}
                negocio="CONS"
                ano={selAno}
                mes={selMes}
                mesAcumMax={mesAcumMax}
              />
            )}
            {slideIdx === 1 && (
              <SlideIndicador
                codigo="157"
                rowsAno={rowsAno}
                metas={metas}
                unidade={selUnidade}
                negocio="CONS"
                ano={selAno}
                mes={selMes}
                mesAcumMax={mesAcumMax}
              />
            )}
            {slideIdx === 2 && (
              <Slide03AdmGeral
                rowsAno={rowsAno}
                metas={metas}
                unidade={selUnidade}
                negocio="CONS"
                ano={selAno}
                mes={selMes}
                mesAcumMax={mesAcumMax}
              />
            )}
            {slideIdx === 3 && (
              <SlidePerdaDre
                titulo="Vales"
                contas={['051', '052']}
                rowsTodosAnos={rowsNegocio}
                unidadeSel={selUnidade}
                unidades={unidades}
                ano={selAno}
                mes={selMes}
              />
            )}
            {slideIdx === 4 && (
              <SlidePerdaDre
                titulo="Multas"
                contas={['137', '222']}
                rowsTodosAnos={rowsNegocio}
                unidadeSel={selUnidade}
                unidades={unidades}
                ano={selAno}
                mes={selMes}
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
