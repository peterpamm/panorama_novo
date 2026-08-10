import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { useAuth } from '@/context/AuthContext'
import { useUnidades } from '@/hooks/useUnidades'
import { useReuniaoDados, valorFarolPacoteUnidadeMes } from '@/hooks/useReuniaoDados'
import { useResumoGeralRanking } from '@/hooks/useResumoGeralRanking'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { unidadesParticipaveis, type ReuniaoParticipavel } from '@/lib/reuniao-resultados'
import { resolverResumoMesUnidade, type ContribuicaoSetor, type ResumoMesUnidade } from '@/lib/resumo-geral-calculations'
import { mesAnterior } from '@/lib/rotinas-financeiras'
import { ResumoGeralTab } from '@/components/reuniao/resumo-geral/ResumoGeralTab'
import { RankingPorSetorTab } from '@/components/reuniao/resumo-geral/RankingPorSetorTab'
import { DetalhesUnidadeTab } from '@/components/reuniao/resumo-geral/DetalhesUnidadeTab'
import { RankingAnualTab } from '@/components/reuniao/resumo-geral/RankingAnualTab'
import { ImportacaoHistoricoTab } from '@/components/reuniao/resumo-geral/ImportacaoHistoricoTab'

export const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const ANOS_RESUMO_GERAL = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

const DEFAULT = mesAnterior(new Date().getFullYear(), new Date().getMonth() + 1)

const SETORES_LABEL = {
  financeiro: 'Financeiro', gente: 'Gente', frota: 'Frota',
  seguranca: 'Segurança', distribuicao: 'Distribuição', armazem: 'Armazém',
} as const

export interface SetorConsolidado {
  setor: keyof typeof SETORES_LABEL
  label: string
  carregando: boolean
  unidadesDoTotal: { unidade: string; negocio: string }[]
  totalPorUnidadeMes: Record<string, number | null>
  maiorPorMes: Record<number, number>
}

/**
 * Resumo Geral e Ranking Corporativo — /reuniao-resultados/resumo-geral.
 * Consolida a pontuação dos 6 setores da Reunião Resultados por unidade,
 * soma as bonificações extras (EBITDA batido + os 3 Rankings Ambev de
 * Gente/Frota/Segurança) e define o vencedor do mês/ano. Monta
 * `useReuniaoDados` 6× (uma por setor, mesmo padrão de
 * `MatrizRvPage.tsx`/`PainelGeralRvPage.tsx` com `useRvApuracao`).
 *
 * Admin vê as 5 abas inteiras. Usuário de unidade (quando o admin libera a
 * página `reuniao_resumo_geral` pra ele) só vê "Detalhes da Unidade", já
 * travada na própria unidade, e sem o card de Colocação — a posição no
 * ranking é surpresa até a reunião mensal com todo mundo; se aparecesse
 * aqui, cada unidade já saberia se ganhou ou perdeu antes da reunião.
 *
 * AMBEV (consolidado LOG20) nunca entra como "unidade" aqui. Camaçari abre
 * em 2 linhas (Rota/Armazém — mesma regra de `unidadesParticipaveis`, que já
 * é usada pra isso em qualquer setor fora do Financeiro); como o Financeiro
 * não separa Camaçari (um número só), a contribuição dele conta inteira nas
 * duas linhas — decisão confirmada com o usuário, não divide o valor.
 */
export function ReuniaoResumoGeralPage() {
  const [ano, setAno] = useState(String(DEFAULT.ano))
  const [mes, setMes] = useState(String(DEFAULT.mes))

  const { role, unidade: minhaUnidade, rvNegocio } = useAuth()
  const isAdmin = role === 'admin'
  const { unidades } = useUnidades()
  const { rows: rowsDre } = useDreLongoTodasUnidades()
  const { orcamentos: orcamentoRows } = useOrcamentoTodasUnidades()
  const { rankingAmbev, carregando: carregandoRanking, posicoesAmbev, historicoDoAno, salvarPosicaoAmbev } = useResumoGeralRanking(ano)

  const financeiro = useReuniaoDados('financeiro', ano)
  const gente = useReuniaoDados('gente', ano)
  const frota = useReuniaoDados('frota', ano)
  const seguranca = useReuniaoDados('seguranca', ano)
  const distribuicao = useReuniaoDados('distribuicao', ano)
  const armazem = useReuniaoDados('armazem', ano)

  const setores = useMemo<SetorConsolidado[]>(() => [
    { setor: 'financeiro', label: SETORES_LABEL.financeiro, ...financeiro },
    { setor: 'gente', label: SETORES_LABEL.gente, ...gente },
    { setor: 'frota', label: SETORES_LABEL.frota, ...frota },
    { setor: 'seguranca', label: SETORES_LABEL.seguranca, ...seguranca },
    { setor: 'distribuicao', label: SETORES_LABEL.distribuicao, ...distribuicao },
    { setor: 'armazem', label: SETORES_LABEL.armazem, ...armazem },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [financeiro, gente, frota, seguranca, distribuicao, armazem])

  const carregando = carregandoRanking || setores.some(s => s.carregando)

  // Linhas participáveis do módulo: sem AMBEV, Camaçari em 2 linhas (Rota/Armazém) — mesma regra usada em qualquer setor fora do Financeiro (ver unidadesParticipaveis).
  const linhas = useMemo<ReuniaoParticipavel[]>(
    () => unidadesParticipaveis(unidades.filter(u => u.codigo !== 'AMBEV'), 'gente'),
    [unidades],
  )

  // Usuário de unidade só vê a própria — nunca as outras. Em Camaçari, que
  // abre em 2 linhas (Rota/Armazém, dois gerentes diferentes), `rvNegocio`
  // restringe à linha do próprio negócio, senão o gerente do CDR veria
  // também os pontos da liderança do CDL (e vice-versa) — mesma trava já
  // aplicada em RV > Painel Geral (`PainelGeralRvPage.tsx`).
  const linhasDetalhesUnidade = useMemo(() => {
    if (isAdmin) return linhas
    let filtrado = linhas.filter(l => l.unidade === minhaUnidade)
    if (rvNegocio) filtrado = filtrado.filter(l => l.negocio === rvNegocio)
    return filtrado
  }, [isAdmin, linhas, minhaUnidade, rvNegocio])

  // Consolidado de todas as linhas × 12 meses do ano selecionado — base
  // única reaproveitada pelas abas Resumo Geral, Ranking por Setor (parcial),
  // Detalhes da Unidade e Ranking Anual.
  const resumoPorLinhaMes = useMemo(() => {
    const mapa: Record<string, ResumoMesUnidade> = {}
    if (carregando) return mapa
    for (const linha of linhas) {
      for (let m = 1; m <= 12; m++) {
        const contribuicoesSetores: ContribuicaoSetor[] = setores.map(s => {
          // Financeiro não separa Camaçari (um número só) — conta inteiro nas duas linhas (Rota/Armazém).
          const negocioBusca = s.setor === 'financeiro' ? 'CONS' : linha.negocio
          return {
            setor: s.label,
            unidade: linha.unidade,
            negocio: linha.negocio,
            pontos: s.totalPorUnidadeMes[`${linha.unidade}|${negocioBusca}|${m}`] ?? null,
          }
        })
        const ebitdaAvr = valorFarolPacoteUnidadeMes(rowsDre, '232', linha.unidade, Number(ano), m, 'CONS')
        const ebitdaMeta = buscarMetaOrcamento(orcamentoRows, { unidade: linha.unidade, negocio: 'CONS', ano: Number(ano), codigo: '232', mes: m })
        mapa[`${linha.unidade}|${linha.negocio}|${m}`] = resolverResumoMesUnidade({
          contribuicoesSetores,
          ebitdaAvr,
          ebitdaMeta,
          posicoesAmbev: posicoesAmbev(linha.unidade, linha.negocio, m),
        })
      }
    }
    return mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, setores, rowsDre, orcamentoRows, ano, rankingAmbev, carregando])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/reuniao-resultados"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Reunião Resultados
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h2 className="text-base font-semibold text-foreground">Resumo Geral</h2>
      </div>

      {!isAdmin ? (
        <DetalhesUnidadeTab
          ano={ano} setAno={setAno} mes={mes} setMes={setMes}
          linhas={linhasDetalhesUnidade} setores={setores} resumoPorLinhaMes={resumoPorLinhaMes} carregando={carregando}
          mostrarColocacao={false}
        />
      ) : (
        <Tabs defaultValue="resumo-geral">
          <TabsList>
            <TabsTrigger value="resumo-geral">Resumo Geral</TabsTrigger>
            <TabsTrigger value="ranking-setor">Ranking por Setor</TabsTrigger>
            <TabsTrigger value="detalhes-unidade">Detalhes da Unidade</TabsTrigger>
            <TabsTrigger value="ranking-anual">Ranking Anual</TabsTrigger>
            <TabsTrigger value="importacao-historico">Importação de Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo-geral" className="pt-4">
            <ResumoGeralTab
              ano={ano} setAno={setAno} mes={mes} setMes={setMes}
              linhas={linhas} resumoPorLinhaMes={resumoPorLinhaMes}
              carregando={carregando} salvarPosicaoAmbev={salvarPosicaoAmbev}
            />
          </TabsContent>

          <TabsContent value="ranking-setor" className="pt-4">
            <RankingPorSetorTab
              ano={ano} setAno={setAno} mes={mes} setMes={setMes} unidades={unidades} setores={setores}
              historicoDoAno={historicoDoAno} carregando={carregando}
            />
          </TabsContent>

          <TabsContent value="detalhes-unidade" className="pt-4">
            <DetalhesUnidadeTab
              ano={ano} setAno={setAno} mes={mes} setMes={setMes}
              linhas={linhas} setores={setores} resumoPorLinhaMes={resumoPorLinhaMes} carregando={carregando}
            />
          </TabsContent>

          <TabsContent value="ranking-anual" className="pt-4">
            <RankingAnualTab
              ano={ano} setAno={setAno} linhas={linhas} resumoPorLinhaMes={resumoPorLinhaMes}
              historicoDoAno={historicoDoAno} carregando={carregando}
            />
          </TabsContent>

          <TabsContent value="importacao-historico" className="pt-4">
            <ImportacaoHistoricoTab />
          </TabsContent>
        </Tabs>
      )}

      <Toaster />
    </div>
  )
}
