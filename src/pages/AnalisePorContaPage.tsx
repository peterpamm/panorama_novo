import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import { useContas } from '@/hooks/useContas'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContaCombobox } from '@/components/analise-conta/ContaCombobox'
import { FilterLabel, filterTriggerClass } from '@/components/farol/FarolFilters'
import { ResumoCards } from '@/components/analise-conta/ResumoCards'
import { EvolucaoChart } from '@/components/analise-conta/EvolucaoChart'
import { DetalhesTable } from '@/components/analise-conta/DetalhesTable'
import { AberturaContas } from '@/components/analise-conta/AberturaContas'
import { AnoVsAnoPanel } from '@/components/analise-conta/AnoVsAnoPanel'
import { PorUnidadePanel } from '@/components/analise-conta/PorUnidadePanel'
import { CONTA_RECEITA } from '@/lib/constants'
import { normalizarParaCalculo } from '@/lib/farol-calculations'
import { calcularResumoConta, calcularSerieMensalConta } from '@/lib/analise-conta-calculations'

function unicos<T>(valores: T[]): T[] {
  return Array.from(new Set(valores))
}

export function AnalisePorContaPage() {
  const { role, unidade: minhaUnidade } = useAuth()
  const { unidades: todasUnidades, loading: loadingUnidades } = useUnidades()
  const { contas, loading: loadingContas } = useContas()

  const unidadesDisponiveis = useMemo(() => {
    if (role === 'admin') return todasUnidades
    return todasUnidades.filter(u => u.codigo === minhaUnidade || u.codigo === 'AMBEV')
  }, [role, minhaUnidade, todasUnidades])

  const [selUnidade, setSelUnidade] = useState('')
  useEffect(() => {
    if (!selUnidade && unidadesDisponiveis.length > 0) setSelUnidade(unidadesDisponiveis[0].codigo)
  }, [unidadesDisponiveis, selUnidade])

  // Cache global (DataContext) — carregado uma vez por sessão do app, filtrado
  // pela unidade selecionada em memória em vez de um `useDreLongo(selUnidade)`
  // próprio (redundante: a aba "Por Unidade", bem abaixo, já usa esse mesmo
  // cache cru, todas as unidades juntas).
  const { rows: rowsTodasUnidades, loading: loadingDre } = useDreLongoTodasUnidades()
  const rowsUnidade = useMemo(() => rowsTodasUnidades.filter(r => r.unidade === selUnidade), [rowsTodasUnidades, selUnidade])

  const negociosDisponiveis = useMemo(() => unicos(rowsUnidade.map(r => r.negocio)).sort(), [rowsUnidade])
  const [selNegocio, setSelNegocio] = useState('')
  useEffect(() => {
    if (negociosDisponiveis.length === 0) return
    if (selNegocio && negociosDisponiveis.includes(selNegocio)) return
    setSelNegocio(negociosDisponiveis.includes('CONS') ? 'CONS' : negociosDisponiveis[0])
  }, [negociosDisponiveis, selNegocio])

  const rowsNegocio = useMemo(() => rowsUnidade.filter(r => r.negocio === selNegocio), [rowsUnidade, selNegocio])

  const anosDisponiveis = useMemo(() => unicos(rowsNegocio.map(r => r.ano)).sort((a, b) => a - b), [rowsNegocio])
  const [selAno, setSelAno] = useState<number | null>(null)
  useEffect(() => {
    if (anosDisponiveis.length === 0) return
    if (selAno && anosDisponiveis.includes(selAno)) return
    setSelAno(anosDisponiveis[anosDisponiveis.length - 1])
  }, [anosDisponiveis, selAno])

  const rowsNegocioAno = useMemo(() => rowsNegocio.filter(r => r.ano === selAno), [rowsNegocio, selAno])
  const nomesPorCodigo = useMemo(() => new Map(contas.map(c => [c.codigo, c.descricao])), [contas])

  const [selConta, setSelConta] = useState(CONTA_RECEITA)
  const [selContaAnoVsAno, setSelContaAnoVsAno] = useState(CONTA_RECEITA)
  const [selContaPorUnidade, setSelContaPorUnidade] = useState(CONTA_RECEITA)

  // Aba "Por Unidade" — a mesma conta em todas as unidades, do cache global
  // (`rowsTodasUnidades`, já carregado acima). Só faz sentido pra quem
  // enxerga várias unidades (admin/corporativo); usuário de unidade nem vê a
  // aba, e a RLS já limitaria o dado de qualquer jeito.
  // Meta do modo AVR sai só daqui — o orçamento importado, mesma fonte do
  // Farol de Metas e do Ranking (nunca o AVO do DRE).
  const { orcamentos: orcamentosTodasUnidades } = useOrcamentoTodasUnidades()
  const mostrarPorUnidade = role === 'admin'
  // Todas as contas (não só a selecionada): o impacto em R$ do AVR precisa da
  // receita de cada unidade, que vem da conta 002 dessas mesmas linhas.
  const rowsTodasNegocioAno = useMemo(
    () => rowsTodasUnidades.filter(r => r.negocio === selNegocio && r.ano === selAno && r.tipo_periodo === 'MENSAL'),
    [rowsTodasUnidades, selNegocio, selAno],
  )
  const nomesUnidade = useMemo(() => new Map(todasUnidades.map(u => [u.codigo, u.nome])), [todasUnidades])
  const nomeContaPorUnidade = contas.find(c => c.codigo === selContaPorUnidade)?.descricao ?? selContaPorUnidade

  const rowsContaAtual = useMemo(
    () => rowsNegocio.filter(r => r.ano === selAno && r.conta_codigo === selConta && r.tipo_periodo === 'MENSAL'),
    [rowsNegocio, selAno, selConta],
  )
  const rowsContaAnterior = useMemo(
    () => rowsNegocio.filter(r => r.ano === (selAno ?? 0) - 1 && r.conta_codigo === selConta && r.tipo_periodo === 'MENSAL'),
    [rowsNegocio, selAno, selConta],
  )
  const rowsContaTodosAnos = useMemo(
    () => rowsNegocio.filter(r => r.conta_codigo === selContaAnoVsAno && r.tipo_periodo === 'MENSAL'),
    [rowsNegocio, selContaAnoVsAno],
  )

  const calcAtual = useMemo(() => normalizarParaCalculo(rowsContaAtual), [rowsContaAtual])
  const calcAnterior = useMemo(() => normalizarParaCalculo(rowsContaAnterior), [rowsContaAnterior])
  const resumo = useMemo(() => calcularResumoConta(calcAtual, calcAnterior), [calcAtual, calcAnterior])
  const serieMensal = useMemo(() => calcularSerieMensalConta(rowsContaAtual), [rowsContaAtual])

  const nomeConta = contas.find(c => c.codigo === selConta)?.descricao ?? selConta
  const nomeContaAnoVsAno = contas.find(c => c.codigo === selContaAnoVsAno)?.descricao ?? selContaAnoVsAno

  const carregando = loadingUnidades || loadingDre || loadingContas

  if (carregando && !selUnidade) {
    return (
      <div className="space-y-6 p-4 md:p-6 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gray-200/20 dark:bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gray-200/20 dark:bg-white/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 space-y-4">
          <Skeleton className="h-24 w-full bg-gray-200/50 dark:bg-gray-700/50 rounded-2xl" />
          <Skeleton className="h-64 w-full bg-gray-200/50 dark:bg-gray-700/50 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (unidadesDisponiveis.length === 0) {
    return (
      <div className="p-4 md:p-6 relative">
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-gray-200/30 dark:border-gray-700/30 shadow-xl shadow-gray-200/20 dark:shadow-black/20 p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma unidade disponível para o seu usuário.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 relative">
      {/* Elementos decorativos sutis */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gray-200/20 dark:bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gray-200/20 dark:bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* BLOCO 1: Filtros com fundo azul gradiente */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[hsl(222,45%,20%)] to-[hsl(222,35%,30%)] dark:from-[hsl(224,28%,14%)] dark:to-[hsl(224,22%,20%)] shadow-xl shadow-blue-900/20 overflow-hidden">
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3 md:p-6">
            <div className="space-y-1.5">
              <FilterLabel>Unidade</FilterLabel>
              <Select value={selUnidade} onValueChange={v => { setSelUnidade(v); setSelNegocio(''); setSelAno(null) }}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/20 focus:ring-white/30">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-gray-200/30 dark:border-gray-700/30">
                  {unidadesDisponiveis.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FilterLabel>Negócio</FilterLabel>
              <Select value={selNegocio} onValueChange={v => { setSelNegocio(v); setSelAno(null) }}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/20 focus:ring-white/30">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-gray-200/30 dark:border-gray-700/30">
                  {negociosDisponiveis.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FilterLabel>Ano</FilterLabel>
              <Select value={String(selAno ?? '')} onValueChange={v => setSelAno(Number(v))}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/20 focus:ring-white/30">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-gray-200/30 dark:border-gray-700/30">
                  {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* CONTEÚDO: Abas com estilo premium */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/30 dark:border-gray-700/30 shadow-xl shadow-gray-200/20 dark:shadow-black/20 overflow-hidden">
          <div className="p-4 md:p-6">
            <Tabs defaultValue="conta" className="w-full">
              <TabsList className="bg-gray-200/70 dark:bg-gray-700/70 p-1 rounded-xl inline-flex w-full md:w-auto">
                <TabsTrigger
                  value="conta"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex-1 md:flex-none"
                >
                  Visão da conta
                </TabsTrigger>
                <TabsTrigger
                  value="anovsano"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex-1 md:flex-none"
                >
                  Ano vs Ano
                </TabsTrigger>
                <TabsTrigger
                  value="abertura"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex-1 md:flex-none"
                >
                  Abertura de Contas
                </TabsTrigger>
                {mostrarPorUnidade && (
                  <TabsTrigger
                    value="porunidade"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex-1 md:flex-none"
                  >
                    Por Unidade
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="conta" className="space-y-6 pt-6">
                <div className="max-w-md space-y-1.5">
                  <Label className="text-gray-700 dark:text-gray-300">Conta</Label>
                  <ContaCombobox 
                    contas={contas} 
                    value={selConta} 
                    onChange={setSelConta}
                  />
                </div>

                {rowsContaAtual.length === 0 ? (
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/30 dark:border-gray-700/30 p-8 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum dado importado para essa conta neste período.</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-gray-200/30 dark:border-gray-700/30 bg-white/50 dark:bg-gray-800/50 p-4">
                      <ResumoCards resumo={resumo} />
                    </div>
                    <div className="rounded-xl border border-gray-200/30 dark:border-gray-700/30 bg-white/50 dark:bg-gray-800/50 p-4">
                      <EvolucaoChart serie={serieMensal} />
                    </div>
                    <DetalhesTable serie={serieMensal} nomeConta={nomeConta} ano={selAno ?? 0} />
                  </>
                )}
              </TabsContent>

              <TabsContent value="anovsano" className="space-y-6 pt-6">
                <div className="max-w-md space-y-1.5">
                  <Label className="text-gray-700 dark:text-gray-300">Conta</Label>
                  <ContaCombobox 
                    contas={contas} 
                    value={selContaAnoVsAno} 
                    onChange={setSelContaAnoVsAno}
                  />
                </div>
                <AnoVsAnoPanel rowsContaTodosAnos={rowsContaTodosAnos} nomeConta={nomeContaAnoVsAno} />
              </TabsContent>

              <TabsContent value="abertura" className="pt-6">
                <AberturaContas rowsNegocioAno={rowsNegocioAno} nomesPorCodigo={nomesPorCodigo} />
              </TabsContent>

              {mostrarPorUnidade && (
                <TabsContent value="porunidade" className="space-y-6 pt-6">
                  <div className="max-w-md space-y-1.5">
                    <Label className="text-gray-700 dark:text-gray-300">Conta</Label>
                    <ContaCombobox
                      contas={contas}
                      value={selContaPorUnidade}
                      onChange={setSelContaPorUnidade}
                    />
                  </div>
                  <PorUnidadePanel
                    rowsNegocioAno={rowsTodasNegocioAno}
                    orcamentos={orcamentosTodasUnidades}
                    conta={selContaPorUnidade}
                    negocio={selNegocio}
                    nomesUnidade={nomesUnidade}
                    nomeConta={nomeContaPorUnidade}
                    ano={selAno ?? 0}
                  />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}