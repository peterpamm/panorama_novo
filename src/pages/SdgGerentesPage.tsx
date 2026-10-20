import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Moon, Sun, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useTheme } from '@/hooks/useTheme'
import { useSdgJustificativas } from '@/hooks/useSdgJustificativas'
import { useRelatosSeguranca } from '@/hooks/useRelatosSeguranca'
import { disponibilidadesDaUnidade } from '@/lib/farol-gerentes'
import { usePlanoAcaoTags, usePlanosAcao } from '@/hooks/usePlanosAcao'
import { mapaLogosPorUnidade } from '@/lib/logos-unidades'
import { CAMACARI_CDL_ID, CAMACARI_CDR_ID, CAMACARI_CODIGO } from '@/lib/ranking-calculations'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SlideAberturaGerentes } from '@/pages/sdg/SlideAberturaGerentes'
import { SlideReceitaGerentes } from '@/pages/sdg/SlideReceitaGerentes'
import { SlideEbitdaGerentes } from '@/pages/sdg/SlideEbitdaGerentes'
import { SlideGastosTotaisGerentes } from '@/pages/sdg/SlideGastosTotaisGerentes'
import { SlidePacoteDeGenteGerentes } from '@/pages/sdg/SlidePacoteDeGenteGerentes'
import { SlidePacoteDeFrotaGerentes } from '@/pages/sdg/SlidePacoteDeFrotaGerentes'
import { SlideDespesaAdministrativaGerentes } from '@/pages/sdg/SlideDespesaAdministrativaGerentes'
import { SlideCustosFreteirosGerentes } from '@/pages/sdg/SlideCustosFreteirosGerentes'
import { SlidePacoteDePerdasGerentes } from '@/pages/sdg/SlidePacoteDePerdasGerentes'
import { SlidePiramideSeguranca } from '@/pages/sdg/SlidePiramideSeguranca'
import { SlideResumoExecutivoGerentes } from '@/pages/sdg/SlideResumoExecutivoGerentes'
import { SlideMetasBonusGerentes } from '@/pages/sdg/SlideMetasBonusGerentes'
import { SlideScoreCardGerentes } from '@/pages/sdg/SlideScoreCardGerentes'
import { SlidePlanoAcaoGerentes } from '@/pages/sdg/SlidePlanoAcaoGerentes'
import { useFarolGerentesDados } from '@/hooks/useFarolGerentesDados'
import type { MetaPerdaIndicador } from '@/types'

const ANO_ATUAL = new Date().getFullYear()
const ANOS_OPCOES = [ANO_ATUAL + 1, ANO_ATUAL, ANO_ATUAL - 1]

// Abre sempre no mês anterior ao atual (mês corrente normalmente ainda não
// fechou) — em Janeiro, o "mês anterior" é Dezembro do ano passado.
const MES_ATUAL = new Date().getMonth() + 1
const MES_INICIAL = MES_ATUAL === 1 ? 12 : MES_ATUAL - 1
const ANO_MES_INICIAL = MES_ATUAL === 1 ? ANO_ATUAL - 1 : ANO_ATUAL
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const SLIDES = [
  { id: 'abertura',          titulo: 'Abertura' },
  { id: 'resumo-executivo',  titulo: 'Resumo Executivo' },
  { id: 'piramide',          titulo: 'Pirâmide de Segurança' },
  { id: 'metas-bonus',       titulo: 'Metas Bônus' },
  { id: 'receita',           titulo: 'Receita Líquida' },
  { id: 'ebitda',            titulo: 'EBITDA' },
  { id: 'gastos-totais',     titulo: 'Gastos Totais' },
  { id: 'pacote-de-gente',   titulo: 'Pacote de Gente' },
  { id: 'pacote-de-frota',   titulo: 'Pacote de Frota' },
  { id: 'despesa-adm',       titulo: 'Despesa Administrativa' },
  { id: 'custos-freteiros',  titulo: 'Custos com Freteiros' },
  { id: 'pacote-de-perdas',  titulo: 'Pacote de Perdas' },
  { id: 'score-card',        titulo: 'Score Card' },
  { id: 'plano-de-acao',     titulo: 'Plano de Ação' },
] as const

/**
 * SDG dos Gerentes — /sdg-gerentes, tela cheia fora do AppShell/sidebar,
 * igual o SDG Financeiro. Primeira leva: Abertura (`SlideAberturaGerentes`,
 * capa "SDG — <UNIDADE>"), "Resumo Executivo" (`SlideResumoExecutivoGerentes`
 * — 4 blocos coloridos: Pontos Positivos/Negativos/Atenção/Andamento, logo
 * depois da Abertura — pedido do chefe do usuário depois de ver a
 * apresentação real), Receita Líquida (`SlideReceitaGerentes` — mensal +
 * comparativo acumulado ano×ano + tabela), Pirâmide de Segurança
 * (`SlidePiramideSeguranca` — relatos importados agrupados por classificação,
 * com pílula de SIF). Conteúdo editado em Área Financeira > SDG > SDG
 * Gerentes (`SdgGerentesGestaoPage.tsx`): Resumo Executivo (indicador
 * `assuntos-gerais-gerentes`, migration 114 + colunas novas da migration 121
 * — era "Assuntos Gerais", mesmo indicador, só ganhou 2 blocos a mais; o
 * componente genérico `SlideAssuntosGerais.tsx` continua existindo sem
 * mudança, usado pelo SDG Financeiro/Corp) e Importação dos Relatos de
 * Segurança (`relatos_seguranca`, migration 115). Qualquer usuário acessa
 * (`ProtectedRoute` sem `adminOnly`/`donoApenas`) — os próprios gerentes
 * apresentam. Por unidade: admin escolhe, usuário de unidade fica travado na
 * própria (mesmo padrão do SDG Financeiro). Mais slides entram aqui do mesmo
 * jeito que o SDG Financeiro foi crescendo.
 */
export function SdgGerentesPage() {
  const { role, unidade: unidadeUsuario } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [selUnidade, setSelUnidade] = useState('')
  const [selNegocio, setSelNegocio] = useState<'CONS' | 'ROTA' | 'ARM' | 'EMP'>('CONS')
  const [selAno, setSelAno] = useState(ANO_MES_INICIAL)
  const [selMes, setSelMes] = useState(MES_INICIAL)
  const [slideIdx, setSlideIdx] = useState(0)

  // Unidades/DRE/Orçamento/Painel de Perdas de TODAS as unidades, vindos do
  // DataProvider próprio dessa rota (ver App.tsx) — carrega uma vez só por
  // sessão dessa página, não a cada troca de unidade no seletor (era assim
  // antes: `useDreLongo(selUnidade)` + `fetchOrcamentoPaginado` refaziam a
  // busca completa toda vez que o admin trocava de unidade pra revisar o
  // SDG de outro gerente, multiplicando o egress do Supabase). Filtra pela
  // unidade selecionada abaixo, em memória.
  const { unidades, rowsDreTodas, orcamentos, rowsAux, loading: loadingDados } = useData()

  useEffect(() => {
    if (selUnidade || unidades.length === 0) return
    const primeira = role === 'admin'
      ? unidades.find(u => u.codigo !== 'AMBEV')?.codigo
      : (unidadeUsuario ?? undefined)
    if (primeira) setSelUnidade(primeira)
  }, [unidades, role, unidadeUsuario, selUnidade])

  const logosPorUnidade = useMemo(() => mapaLogosPorUnidade(unidades), [unidades])

  // Resumo Executivo é por negócio em unidade com 2 gerentes reais (Camaçari/
  // Ponta Grossa, ver ResumoExecutivoGerentesTab.tsx/migration_132) — passa o
  // `selNegocio` direto (ROTA/ARM/EMP já é o mesmo valor gravado na edição);
  // CONS não bate com nenhuma linha dessas unidades (de propósito — não tem
  // "resumo combinado" dos dois gerentes, cada um só vê o próprio).
  const { porIndicador: justificativas, loading: loadingJustificativas } = useSdgJustificativas(selUnidade, selAno, selMes, selNegocio)
  const { relatos, loading: loadingRelatos } = useRelatosSeguranca(selUnidade, selAno)
  // Só pro slide final "Plano de Ação" — mesmas tabelas/RLS já usadas em
  // Área Financeira > Plano de Ação, independentes do loading geral.
  const { planos } = usePlanosAcao()
  const { tags: tagsPlanoAcao } = usePlanoAcaoTags()

  // Dataset do Farol Gerentes (TODAS as unidades, não só a selecionada) — só
  // pro slide "Metas Bônus", que reaproveita o mesmo card de
  // `FarolGerentesPage.tsx`. Independente do loading geral da apresentação
  // (o slide mostra seu próprio estado de carregamento).
  const {
    rows: rowsFarolGerentes, orcamentos: orcamentosFarolGerentes, resultadosTri, rowsAux: rowsAuxFarolGerentes,
    metasPerdasIndicadores: metasPerdasIndicadoresFarolGerentes, disponibilidadeRota, disponibilidadeArmazem,
    disponibilidadeEmpurrada, posicoesLog20, loading: loadingFarolGerentes,
  } = useFarolGerentesDados(unidades)
  const posicaoLog20 = useMemo(
    () => posicoesLog20.find(p => p.ano === selAno)?.faixa ?? null,
    [posicoesLog20, selAno],
  )

  // DRE da unidade (todos os anos — o comparativo de Receita precisa do ano
  // anterior também), filtrado em memória do cache global.
  const rowsDre = useMemo(() => rowsDreTodas.filter(r => r.unidade === selUnidade), [rowsDreTodas, selUnidade])
  // Filtra pelo negócio selecionado no cabeçalho (CONS por padrão, com opção
  // de ver Rota/Armazém separados).
  const rowsUnidadeCons = useMemo(() => rowsDre.filter(r => r.negocio === selNegocio), [rowsDre, selNegocio])

  // Orçamento da unidade/negócio/ano selecionados, também filtrado em
  // memória (o cache global já vem limitado às contas usadas por algum
  // pacote — `CONTAS_ORCAMENTO_USADAS` — e aos últimos ~2 anos, suficiente
  // pra tudo que esses slides calculam).
  const orcamentoRows = useMemo(
    () => orcamentos.filter(o => o.unidade === selUnidade && o.negocio === selNegocio && o.ano === selAno),
    [orcamentos, selUnidade, selNegocio, selAno],
  )

  // Meta de Perdas (Vales, no Pacote de Gente) — só do ano selecionado, sem
  // filtro de unidade (tabela pequena, `metaPerdasMensalUnidade` filtra por
  // unidade internamente). Não faz parte do cache global (é outra tabela,
  // `metas_perdas_indicadores` — não confundir com `metas_perdas`, essa sim
  // já cacheada), mas é pequena e só refaz a busca quando o ano muda.
  const [metasPerdasAno, setMetasPerdasAno] = useState<MetaPerdaIndicador[]>([])
  useEffect(() => {
    supabase.from('metas_perdas_indicadores').select('*').eq('ano', selAno)
      .then(({ data }) => setMetasPerdasAno((data ?? []) as MetaPerdaIndicador[]))
  }, [selAno])
  const dataEntradaUnidade = useMemo(() => unidades.find(u => u.codigo === selUnidade)?.data_entrada ?? null, [unidades, selUnidade])

  // Painel de Perdas (indicadores AUX — Indisponibilidade/Devolução) da
  // unidade selecionada, filtrado em memória do cache global (`rowsAux`).
  const rowsPerdasAux = useMemo(() => rowsAux.filter(r => r.unidade === selUnidade), [rowsAux, selUnidade])

  const loading = loadingDados || loadingJustificativas || loadingRelatos

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setSlideIdx(i => Math.min(i + 1, SLIDES.length - 1))
      if (e.key === 'ArrowLeft') setSlideIdx(i => Math.max(i - 1, 0))
      if (e.key === 'Escape') navigate('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  // Esse seletor só aparece pro admin (role === 'admin', ver abaixo) — Ambev
  // entra aqui de propósito, pra admin conseguir ver o SDG consolidado dela.
  const unidadesDisponiveis = unidades
  const nomeUnidadeReal = unidades.find(u => u.codigo === selUnidade)?.nome ?? selUnidade

  // Camaçari tem 2 gerentes reais e até logo separado por negócio (CDL
  // Camaçari = Rota, CDR Bahia = Armazém — mesmos IDs sintéticos e rótulos
  // já usados na página Ranking, ver ranking-calculations.ts/
  // logos-unidades.ts) — o seletor de Unidade do admin mostra as 2 opções (+
  // a Camaçari consolidada, pra quem quiser ver as duas juntas) em vez de só
  // 1 entrada genérica, pra não depender do seletor de Negócio (separado)
  // pra saber qual dos dois gerentes está sendo revisado. `subUnidadeCamacari`
  // é null fora de Camaçari (ou Camaçari no Consolidado) — nesse caso tudo
  // cai no comportamento normal (nome/logo/valor da unidade real).
  const subUnidadeCamacari = selUnidade === CAMACARI_CODIGO
    ? (selNegocio === 'ROTA' ? 'CDL' : selNegocio === 'ARM' ? 'CDR' : null)
    : null
  const nomeUnidade = subUnidadeCamacari === 'CDL' ? 'CDL Camaçari' : subUnidadeCamacari === 'CDR' ? 'CDR Bahia' : nomeUnidadeReal
  const valorSelectUnidade = subUnidadeCamacari === 'CDL' ? CAMACARI_CDL_ID : subUnidadeCamacari === 'CDR' ? CAMACARI_CDR_ID : selUnidade
  function selecionarUnidade(valor: string) {
    if (valor === CAMACARI_CDL_ID) { setSelUnidade(CAMACARI_CODIGO); setSelNegocio('ROTA'); return }
    if (valor === CAMACARI_CDR_ID) { setSelUnidade(CAMACARI_CODIGO); setSelNegocio('ARM'); return }
    setSelUnidade(valor)
  }
  const itensSelectUnidade = unidadesDisponiveis.flatMap(u => u.codigo === CAMACARI_CODIGO
    ? [
        { value: CAMACARI_CDL_ID, label: 'CDL Camaçari' },
        { value: CAMACARI_CDR_ID, label: 'CDR Bahia' },
        { value: u.codigo, label: `${u.nome} (Consolidado)` },
      ]
    : [{ value: u.codigo, label: u.nome }])

  // Negócios do seletor variam por unidade — a maioria é Rota+Armazém, mas
  // Ponta Grossa/Estância são Empurrada+Armazém (nunca tiveram Rota, mesma
  // regra de `disponibilidadesDaUnidade`, já usada no Farol Gerentes) e Rio
  // de Janeiro é só Rota. Consolidado sempre aparece, pra qualquer unidade.
  const negociosDisponiveis = useMemo(
    () => ['CONS', ...disponibilidadesDaUnidade(nomeUnidade)] as const,
    [nomeUnidade],
  )
  useEffect(() => {
    if (!negociosDisponiveis.includes(selNegocio)) setSelNegocio('CONS')
  }, [negociosDisponiveis, selNegocio])

  // Unidade com 2 gerentes reais (hoje: Camaçari — CDL=Rota, CDR=Armazém — e
  // Ponta Grossa) já tinha o Negócio travado no `rvNegocio` de quem está
  // logado, mas isso deixava o gerente sem conseguir nem ver o próprio
  // Resumo Executivo quando o `rvNegocio` cadastrado não bate exatamente
  // (ex: unidade antiga sem essa separação ainda, ou campo não preenchido) —
  // pedido do usuário pra tirar a trava: o seletor fica sempre disponível
  // pra qualquer um, gerente ou admin, livre pra escolher qualquer negócio.
  const ROTULO_NEGOCIO: Record<string, string> = { CONS: 'Consolidado', ROTA: 'Rota', ARM: 'Armazém', EMP: 'Empurrada' }
  const slideAtual = SLIDES[slideIdx]

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gradient-to-br from-slate-200 via-slate-200 to-blue-100 text-gray-900 dark:bg-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:text-white">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="grid shrink-0 grid-cols-1 items-center gap-4 border-b border-gray-200 bg-white/80 px-6 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center gap-4 min-w-0">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500">SDG Gerentes</div>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setSlideIdx(i)}
                title={s.titulo}
                className={`h-2 rounded-full transition-all ${i === slideIdx ? 'w-6 bg-blue-500 dark:bg-blue-400' : 'w-2 bg-gray-300 hover:bg-gray-400 dark:bg-slate-600 dark:hover:bg-slate-400'}`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400 dark:text-slate-500">{slideIdx + 1}/{SLIDES.length}</span>
        </div>

        {/* Título do slide em destaque, centralizado de verdade (coluna
            "auto" entre duas colunas 1fr iguais) independente de quanto
            conteúdo tem dos lados. */}
        <p className="text-center text-xl font-black uppercase tracking-wide text-gray-900 dark:text-white">
          {slideAtual.titulo}
        </p>

        <div className="flex shrink-0 items-center justify-self-end gap-2">
          {role === 'admin' && (
            <Select value={valorSelectUnidade} onValueChange={selecionarUnidade}>
              <SelectTrigger className="h-8 w-44 text-sm">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                {itensSelectUnidade.map(i => (
                  <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={selNegocio} onValueChange={v => setSelNegocio(v as typeof selNegocio)}>
            <SelectTrigger className="h-8 w-32 text-sm">
              <SelectValue placeholder="Negócio" />
            </SelectTrigger>
            <SelectContent>
              {negociosDisponiveis.map(n => (
                <SelectItem key={n} value={n}>{ROTULO_NEGOCIO[n]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(selMes)} onValueChange={v => setSelMes(Number(v))}>
            <SelectTrigger className="h-8 w-24 text-sm">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m.slice(0, 3)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(selAno)} onValueChange={v => setSelAno(Number(v))}>
            <SelectTrigger className="h-8 w-24 text-sm">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {ANOS_OPCOES.map(a => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {role !== 'admin' && (
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{nomeUnidade}</span>
          )}

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
        {loading || !selUnidade ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-gray-400 dark:text-slate-500">
              {loading ? 'Carregando dados...' : 'Selecione uma unidade'}
            </div>
          </div>
        ) : (
          <>
            {slideIdx === 0 && (
              <SlideAberturaGerentes unidade={nomeUnidade} mes={selMes} ano={selAno} logoUrl={logosPorUnidade.get(valorSelectUnidade)} />
            )}
            {slideIdx === 1 && (
              <SlideResumoExecutivoGerentes justificativa={justificativas['assuntos-gerais-gerentes']} />
            )}
            {slideIdx === 2 && (
              <SlidePiramideSeguranca relatos={relatos} ano={selAno} mes={selMes} />
            )}
            {slideIdx === 3 && (
              <SlideMetasBonusGerentes
                unidades={unidades} unidade={selUnidade} negocio={selNegocio} rows={rowsFarolGerentes} orcamentos={orcamentosFarolGerentes}
                resultadosTri={resultadosTri} rowsAux={rowsAuxFarolGerentes} metasPerdasIndicadores={metasPerdasIndicadoresFarolGerentes}
                disponibilidadeRota={disponibilidadeRota} disponibilidadeArmazem={disponibilidadeArmazem}
                disponibilidadeEmpurrada={disponibilidadeEmpurrada} posicaoLog20={posicaoLog20}
                ano={selAno} loading={loadingFarolGerentes}
              />
            )}
            {slideIdx === 4 && (
              <SlideReceitaGerentes rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoRows} ano={selAno} mes={selMes} />
            )}
            {slideIdx === 5 && (
              <SlideEbitdaGerentes rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoRows} unidade={selUnidade} negocio={selNegocio} ano={selAno} mes={selMes} />
            )}
            {slideIdx === 6 && (
              <SlideGastosTotaisGerentes rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoRows} unidade={selUnidade} negocio={selNegocio} ano={selAno} mes={selMes} />
            )}
            {slideIdx === 7 && (
              <SlidePacoteDeGenteGerentes
                rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoRows}
                unidade={selUnidade} negocio={selNegocio} ano={selAno} mes={selMes}
              />
            )}
            {slideIdx === 8 && (
              <SlidePacoteDeFrotaGerentes rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoRows} unidade={selUnidade} negocio={selNegocio} ano={selAno} mes={selMes} />
            )}
            {slideIdx === 9 && (
              <SlideDespesaAdministrativaGerentes rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoRows} unidade={selUnidade} negocio={selNegocio} ano={selAno} mes={selMes} />
            )}
            {slideIdx === 10 && (
              <SlideCustosFreteirosGerentes rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoRows} unidade={selUnidade} negocio={selNegocio} ano={selAno} mes={selMes} />
            )}
            {slideIdx === 11 && (
              <SlidePacoteDePerdasGerentes
                rowsTodosNegocios={rowsDre} rowsAux={rowsPerdasAux} unidade={selUnidade} nomeUnidade={nomeUnidadeReal} negocio={selNegocio} ano={selAno} mes={selMes}
                metasPerdasAno={metasPerdasAno} dataEntradaUnidade={dataEntradaUnidade}
              />
            )}
            {slideIdx === 12 && (
              <SlideScoreCardGerentes />
            )}
            {slideIdx === 13 && (
              <SlidePlanoAcaoGerentes planos={planos} tags={tagsPlanoAcao} unidadeSel={selUnidade} />
            )}
          </>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-gray-200 bg-white/60 px-6 py-2 text-center text-xs text-gray-400 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-600">
        {nomeUnidade} · {MESES_NOMES[selMes - 1].slice(0, 3)}/{selAno} · Use ← → para navegar entre slides
      </footer>
    </div>
  )
}
