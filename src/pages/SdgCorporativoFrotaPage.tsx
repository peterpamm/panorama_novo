import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Moon, RefreshCw, Sun, X } from 'lucide-react'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import { useData } from '@/context/DataContext'
import { useTheme } from '@/hooks/useTheme'
import { useUltimaImportacao } from '@/hooks/useUltimaImportacao'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PillToggle } from '@/components/ui/pill-toggle'
import { UnidadesMultiSelect } from '@/components/ranking/UnidadesMultiSelect'
import { SlideVisaoGeralFrota } from '@/pages/sdg-corporativo-frota/SlideVisaoGeralFrota'
import { SlideCombustiveisDiesel } from '@/pages/sdg-corporativo-frota/SlideCombustiveisDiesel'
import { SlideManutencoes } from '@/pages/sdg-corporativo-frota/SlideManutencoes'
import { SlidePneus } from '@/pages/sdg-corporativo-frota/SlidePneus'
import { TELAS_FROTA } from '@/pages/sdg-corporativo-frota/frota-contas'
import { cn } from '@/lib/utils'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function unicos<T>(arr: T[]): T[] { return Array.from(new Set(arr)) }

/**
 * SDG Corporativo de Frota — apresentação pra reunião mensal de diretoria de
 * Frota, mesmo espírito do SDG Corporativo (Financeiro) mas olhando só pra
 * estrutura de custos de Frota (conta 114 e sua árvore). Qualquer admin
 * acessa (`ProtectedRoute adminOnly`, ver App.tsx) — diferente do SDG
 * Corporativo Financeiro, que é só do dono do sistema.
 *
 * "Consolidado" (o toggle Consolidado/Por Unidade) é sempre a AMBEV inteira,
 * mesmo com unidades filtradas no multi-select — combinado com o usuário. O
 * filtro de unidades e o toggle só afetam o comparativo AVO×AVR e a tabela
 * de detalhe por unidade; os indicadores do topo, a abertura em grupos e o
 * Pareto são sempre a empresa inteira (ver `TelaFrotaBase.tsx`).
 */
export function SdgCorporativoFrotaPage() {
  const { unidades } = useUnidades()
  const { rows, loading } = useDreLongoTodasUnidades()
  const { orcamentos } = useOrcamentoTodasUnidades()
  const { revalidar } = useData()
  const { isDark, toggleTheme } = useTheme()
  const { data: ultimaAtualizacao, confirmada: ultimaConfirmada } = useUltimaImportacao()
  const navigate = useNavigate()

  const [selAno, setSelAno] = useState<number | null>(null)
  const [selMes, setSelMes] = useState<number | null>(null)
  const [slideIdx, setSlideIdx] = useState(0)
  const [periodo, setPeriodo] = useState<'mensal' | 'ytd'>('mensal')
  const [mostrarPorUnidade, setMostrarPorUnidade] = useState<'consolidado' | 'unidade'>('unidade')
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState<Set<string>>(new Set())

  const unidadesSemAmbev = useMemo(() => unidades.filter(u => u.codigo !== 'AMBEV'), [unidades])
  useEffect(() => {
    if (unidadesSemAmbev.length === 0) return
    setUnidadesSelecionadas(prev => (prev.size > 0 ? prev : new Set(unidadesSemAmbev.map(u => u.codigo))))
  }, [unidadesSemAmbev])

  function toggleUnidade(codigo: string) {
    setUnidadesSelecionadas(prev => {
      const novo = new Set(prev)
      if (novo.has(codigo)) novo.delete(codigo)
      else novo.add(codigo)
      return novo
    })
  }

  // Negócio: CONS é o consolidado da unidade (padrão); ROTA/ARMAZEM deixa
  // comparar qual negócio performou melhor vs o orçado (mesma convenção do
  // SDG Corporativo Financeiro).
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
      if (e.key === 'ArrowRight') setSlideIdx(i => Math.min(i + 1, TELAS_FROTA.length - 1))
      if (e.key === 'ArrowLeft')  setSlideIdx(i => Math.max(i - 1, 0))
      if (e.key === 'Escape')     navigate('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const slideAtual = TELAS_FROTA[slideIdx]

  const propsComuns = selAno && selMes ? {
    rowsAno,
    orcamentoAno,
    unidades,
    negocio: selNegocio,
    ano: selAno,
    mes: selMes,
    periodo,
    unidadesSelecionadas,
    mostrarPorUnidade: mostrarPorUnidade === 'unidade',
  } : null

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gradient-to-br from-slate-200 via-slate-200 to-blue-100 text-gray-900 dark:bg-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:text-white">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white/80 px-6 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex min-w-0 items-center gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500">SDG Corporativo de Frota</div>
            <div className="text-lg font-bold leading-tight">{slideAtual.titulo}</div>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            {TELAS_FROTA.map((s, i) => (
              <button
                key={s.slug}
                onClick={() => setSlideIdx(i)}
                title={s.titulo}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === slideIdx ? 'w-6 bg-blue-500 dark:bg-blue-400' : 'w-2 bg-gray-300 hover:bg-gray-400 dark:bg-slate-600 dark:hover:bg-slate-400',
                )}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400 dark:text-slate-500">{slideIdx + 1}/{TELAS_FROTA.length}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <UnidadesMultiSelect
            opcoes={unidadesSemAmbev.map(u => ({ codigo: u.codigo, nome: u.nome }))}
            selecionadas={unidadesSelecionadas}
            onToggle={toggleUnidade}
            onSelecionarTodas={() => setUnidadesSelecionadas(new Set(unidadesSemAmbev.map(u => u.codigo)))}
            onLimpar={() => setUnidadesSelecionadas(new Set())}
            className="h-8 w-56 text-sm"
          />

          <PillToggle
            opcoes={[{ value: 'unidade', label: 'Por Unidade' }, { value: 'consolidado', label: 'Consolidado' }] as const}
            value={mostrarPorUnidade}
            onChange={setMostrarPorUnidade}
            className="h-8"
          />

          <PillToggle
            opcoes={[{ value: 'mensal', label: 'Mensal' }, { value: 'ytd', label: 'Acumulado' }] as const}
            value={periodo}
            onChange={setPeriodo}
            className="h-8"
          />

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

          <Select value={selMes?.toString() ?? ''} onValueChange={v => setSelMes(Number(v))} disabled={periodo === 'ytd'}>
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
      <main className="relative flex-1 min-h-0 overflow-y-auto">
        {loading || !propsComuns ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-gray-400 dark:text-slate-500">
              {loading ? 'Carregando dados...' : 'Selecione um período'}
            </div>
          </div>
        ) : (
          <>
            {slideIdx === 0 && <SlideVisaoGeralFrota {...propsComuns} />}
            {slideIdx === 1 && <SlideCombustiveisDiesel {...propsComuns} />}
            {slideIdx === 2 && <SlideManutencoes {...propsComuns} />}
            {slideIdx === 3 && <SlidePneus {...propsComuns} />}
          </>
        )}

        <button
          onClick={() => setSlideIdx(i => Math.max(i - 1, 0))}
          disabled={slideIdx === 0}
          className="fixed left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-500 shadow backdrop-blur-sm transition hover:bg-gray-100 disabled:opacity-20 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => setSlideIdx(i => Math.min(i + 1, TELAS_FROTA.length - 1))}
          disabled={slideIdx === TELAS_FROTA.length - 1}
          className="fixed right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-500 shadow backdrop-blur-sm transition hover:bg-gray-100 disabled:opacity-20 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-gray-200 bg-white/60 px-6 py-2 text-center text-xs text-gray-400 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-600">
        AMBEV · {selNegocio} · {periodo === 'ytd' ? `Acumulado até ${MESES[(selMes ?? 1) - 1]}/${selAno}` : `${MESES[(selMes ?? 1) - 1]}/${selAno}`}
        {' · '}
        {ultimaConfirmada ? 'Última importação' : 'Carregado nesta sessão'} em {ultimaAtualizacao.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        {' · Use ← → para navegar entre slides'}
      </footer>
    </div>
  )
}
