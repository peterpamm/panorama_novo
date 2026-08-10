import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Moon, RefreshCw, Sun, X } from 'lucide-react'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import { useData } from '@/context/DataContext'
import { useSdgJustificativas } from '@/hooks/useSdgJustificativas'
import { useTheme } from '@/hooks/useTheme'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SlideReceita } from '@/pages/sdg-corporativo/SlideReceita'
import { SlideIndicadorFarol } from '@/pages/sdg-corporativo/SlideIndicadorFarol'
import { SlideDespesaAdministrativa } from '@/pages/sdg-corporativo/SlideDespesaAdministrativa'
import { SlideIndicadorPerdas } from '@/pages/sdg-corporativo/SlideIndicadorPerdas'
import { SlideAssuntosGerais } from '@/pages/sdg/SlideAssuntosGerais'
import { cn } from '@/lib/utils'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const SLIDES = [
  { id: 'receita',       titulo: 'Receita Líquida'       },
  { id: 'ebitda',        titulo: 'EBITDA'                 },
  { id: 'gastos-totais', titulo: 'Gastos Totais'          },
  { id: 'despesas',      titulo: 'Despesa Administrativa' },
  { id: 'vales',         titulo: 'Vales'                   },
  { id: 'multas',        titulo: 'Multas'                  },
  { id: 'assuntos-gerais', titulo: 'Assuntos Gerais'      },
] as const

function unicos<T>(arr: T[]): T[] { return Array.from(new Set(arr)) }

/**
 * SDG Corporativo — apresentação pra diretoria, consolidando todas as
 * unidades (visão AMBEV) por setor. Só o dono do sistema acessa (ver rota em
 * App.tsx, `ProtectedRoute donoApenas`). Diferente do SDG Financeiro (uma
 * unidade por vez, busca própria fora do DataProvider), aqui os dados vêm do
 * cache global (`DataContext`) porque o próprio propósito é mostrar todas as
 * unidades ao mesmo tempo.
 */
export function SdgCorporativoPage() {
  const { unidades } = useUnidades()
  const { rows, loading } = useDreLongoTodasUnidades()
  const { orcamentos } = useOrcamentoTodasUnidades()
  const { revalidar } = useData()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [selAno, setSelAno] = useState<number | null>(null)
  const [selMes, setSelMes] = useState<number | null>(null)
  const [slideIdx, setSlideIdx] = useState(0)

  // Assuntos Gerais é conteúdo global da empresa (não por unidade) — reaproveita
  // a mesma tabela/hook do SDG Financeiro com `unidade='AMBEV'` como sentinela,
  // já que AMBEV existe em `unidades` mas nunca é usada por nenhum fluxo por
  // unidade (é sempre excluída dos seletores de unidade do SDG Financeiro).
  const { porIndicador: justificativasCorp } = useSdgJustificativas('AMBEV', selAno, selMes)

  // Negócio: CONS é o consolidado da unidade (padrão); ROTA/ARMAZEM (Camaçari)
  // deixa o diretor comparar qual negócio performou melhor vs o orçado.
  const negociosDisponiveis = useMemo(() => unicos(rows.map(r => r.negocio)).sort(), [rows])
  const [selNegocio, setSelNegocio] = useState('')
  useEffect(() => {
    if (negociosDisponiveis.length === 0) return
    if (selNegocio && negociosDisponiveis.includes(selNegocio)) return
    setSelNegocio(negociosDisponiveis.includes('CONS') ? 'CONS' : negociosDisponiveis[0])
  }, [negociosDisponiveis, selNegocio])

  const rowsNegocio = useMemo(() => rows.filter(r => r.negocio === selNegocio), [rows, selNegocio])
  const orcamentoNegocio = useMemo(() => orcamentos.filter(o => o.negocio === selNegocio), [orcamentos, selNegocio])

  const anosDisponiveis = useMemo(
    () => unicos(rowsNegocio.map(r => r.ano)).sort((a, b) => a - b),
    [rowsNegocio],
  )
  useEffect(() => {
    if (anosDisponiveis.length === 0) return
    if (selAno && anosDisponiveis.includes(selAno)) return
    setSelAno(anosDisponiveis[anosDisponiveis.length - 1])
  }, [anosDisponiveis, selAno])

  const rowsAno = useMemo(() => rowsNegocio.filter(r => r.ano === selAno), [rowsNegocio, selAno])
  const orcamentoAno = useMemo(() => orcamentoNegocio.filter(o => o.ano === selAno), [orcamentoNegocio, selAno])

  // Indicadores do Painel de Perdas (Vales, Multas etc.) são sempre CONS —
  // não participam da quebra por negócio (ver painel-perdas-calculations.ts).
  // Por isso esses slides recebem as linhas do ano já filtradas por CONS
  // internamente, sem depender do `selNegocio` da tela.
  const rowsAnoTodosNegocios = useMemo(() => rows.filter(r => r.ano === selAno), [rows, selAno])

  const mesesDisponiveis = useMemo(
    () => unicos(rowsAno.filter(r => r.tipo_periodo === 'MENSAL').map(r => r.mes)).sort((a, b) => a - b),
    [rowsAno],
  )
  useEffect(() => {
    if (mesesDisponiveis.length === 0) return
    if (selMes && mesesDisponiveis.includes(selMes)) return
    setSelMes(mesesDisponiveis[mesesDisponiveis.length - 1])
  }, [mesesDisponiveis, selMes])

  // ── Navegação por teclado ─────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setSlideIdx(i => Math.min(i + 1, SLIDES.length - 1))
      if (e.key === 'ArrowLeft')  setSlideIdx(i => Math.max(i - 1, 0))
      if (e.key === 'Escape')     navigate('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const slideAtual = SLIDES[slideIdx]

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gradient-to-br from-slate-200 via-slate-200 to-blue-100 text-gray-900 dark:bg-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:text-white">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white/80 px-6 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-4 min-w-0">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500">SDG Corporativo</div>
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

        <div className="flex shrink-0 items-center gap-2">
          <Select value={selNegocio} onValueChange={setSelNegocio}>
            <SelectTrigger className="h-8 w-28 text-sm">
              <SelectValue placeholder="Negócio" />
            </SelectTrigger>
            <SelectContent>
              {negociosDisponiveis.map(n => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>

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

          <button
            onClick={() => revalidar()}
            title="Recarregar dados (se algum gráfico parecer sem meta/cor, tenta isso antes de sair e entrar de novo)"
            aria-label="Recarregar dados"
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            onClick={toggleTheme}
            aria-label={isDark ? 'Modo claro' : 'Modo escuro'}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

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
              {loading ? 'Carregando dados...' : 'Selecione um período'}
            </div>
          </div>
        ) : (
          <>
            {slideIdx === 0 && (
              <SlideReceita
                rowsAno={rowsAno}
                orcamentoAno={orcamentoAno}
                unidades={unidades}
                negocio={selNegocio}
                ano={selAno}
                mes={selMes}
              />
            )}
            {slideIdx === 1 && (
              <SlideIndicadorFarol
                titulo="EBITDA"
                codigo="232"
                rowsAno={rowsAno}
                orcamentoAno={orcamentoAno}
                unidades={unidades}
                negocio={selNegocio}
                ano={selAno}
                mes={selMes}
              />
            )}
            {slideIdx === 2 && (
              <SlideIndicadorFarol
                titulo="Gastos Totais"
                codigo="900"
                rowsAno={rowsAno}
                orcamentoAno={orcamentoAno}
                unidades={unidades}
                negocio={selNegocio}
                ano={selAno}
                mes={selMes}
              />
            )}
            {slideIdx === 3 && (
              <SlideDespesaAdministrativa
                rowsAno={rowsAno}
                orcamentoAno={orcamentoAno}
                unidades={unidades}
                negocio={selNegocio}
                ano={selAno}
                mes={selMes}
              />
            )}
            {slideIdx === 4 && (
              <SlideIndicadorPerdas
                titulo="Vales"
                indicador="vales"
                contas={['051', '052']}
                rowsAnoTodosNegocios={rowsAnoTodosNegocios}
                unidades={unidades}
                ano={selAno}
                mes={selMes}
              />
            )}
            {slideIdx === 5 && (
              <SlideIndicadorPerdas
                titulo="Multas"
                indicador="multas"
                contas={['137', '222']}
                rowsAnoTodosNegocios={rowsAnoTodosNegocios}
                unidades={unidades}
                ano={selAno}
                mes={selMes}
              />
            )}
            {slideIdx === 6 && (
              <SlideAssuntosGerais justificativa={justificativasCorp['assuntos-gerais']} />
            )}
          </>
        )}

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
        Todas as unidades · {selNegocio} · {MESES[(selMes ?? 1) - 1]}/{selAno} · Use ← → para navegar entre slides
      </footer>
    </div>
  )
}
