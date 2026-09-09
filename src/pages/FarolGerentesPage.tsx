import { useMemo } from 'react'
import { BarChart3, Building2, CalendarDays, MapPin } from 'lucide-react'
import { useUnidades } from '@/hooks/useUnidades'
import { useFarolGerentesDados } from '@/hooks/useFarolGerentesDados'
import { Skeleton } from '@/components/ui/skeleton'
import { CardFarolGerente } from '@/components/farol-gerentes/CardFarolGerente'
import { ResumoExecutivoFarolGerentes, type LinhaResumoFarolGerente } from '@/components/farol-gerentes/ResumoExecutivoFarolGerentes'
import {
  NOME_DISPONIBILIDADE, calcularAcidentesTriPorUnidade, calcularIndicadorPorNegocio, calcularPacotePerdasPorUnidade,
  linhaAcidentesTri, linhaDisponibilidadeArmazem, linhaDisponibilidadeRota, linhaIndicadorDre, linhaPacotePerdas,
  linhaPendente, linhaScorecard, participaContagemEbitda, unidadesCardsFarol,
} from '@/lib/farol-gerentes'

const ANO_ATUAL = new Date().getFullYear()

/**
 * Farol Gerentes — recriação do painel antigo (Streamlit, 06_Farol_Gerentes.py)
 * no layout novo. Estrutura idêntica ao original: card corporativo (AMBEV)
 * consolidado, Resumo Executivo (ranking Semestre/Ano) e um card por unidade
 * com os mesmos indicadores (Gastos Totais, Acidentes TRI, Disponibilidade
 * ARM/ROTA/EMP no Semestre; Scorecard por negócio, Pacote de Perdas, EBITDA
 * Unidade/Global no Ano). O Scorecard é uma linha por negócio da unidade
 * (Scorecard Rota./Arm./Empur.), na mesma divisão da Disponibilidade —
 * Carambeí, que não tem negócio nenhum nessa régua, fica sem Scorecard.
 *
 * Camaçari e Ponta Grossa (unidades com 2 gerentes) não têm card
 * consolidado — aparecem como 2 cards cada, um por negócio (Rota/Armazém
 * pra Camaçari, Empurrada/Armazém pra Ponta Grossa), já que os resultados
 * de cada gerente são ligados ao próprio negócio (ver `unidadesCardsFarol`).
 *
 * Ligados a dado real (acumulado do ano — YTD): Gastos Totais e EBITDA
 * (DRE, pacotes '900'/'233', igual o resto do app — EBITDA Global é sempre
 * o resultado da AMBEV consolidada, mesmo valor em todo card), Acidentes
 * TRI (registro manual, RV de Segurança > Importação > TRI — meta sempre 0),
 * Pacote de Perdas (% de perdas sobre faturamento, mesmo cálculo do Painel
 * de Perdas — sempre CONS, não quebra por negócio), Disp. Rota e Disp.
 * Armazém (snapshots únicos importados em Importação > Financeiro >
 * Disponibilidade Rota/Armazém — a de Armazém pode ficar sem meta se a
 * planilha não trouxer essa coluna) e Scorecard por negócio (Importação >
 * Financeiro > Scorecard — meta fixa de 80%, ver `META_SCORECARD`). Só
 * Disp. Empurrada continua "—"/pendente.
 */
export function FarolGerentesPage() {
  const { unidades, loading: loadingUnidades } = useUnidades()
  const {
    rows, orcamentos, resultadosTri, rowsAux, metasPerdasIndicadores, disponibilidadeRota, disponibilidadeArmazem,
    scorecards, loading: loadingDados,
  } = useFarolGerentesDados(unidades)

  const unidadesOperacionais = useMemo(() => unidades.filter(u => u.codigo !== 'AMBEV'), [unidades])
  const dataEntradaPorUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.data_entrada])), [unidades])

  const mapaGastos = useMemo(
    () => calcularIndicadorPorNegocio(rows, orcamentos, '900', ANO_ATUAL),
    [rows, orcamentos],
  )
  const mapaEbitda = useMemo(
    () => calcularIndicadorPorNegocio(rows, orcamentos, '233', ANO_ATUAL),
    [rows, orcamentos],
  )
  const mapaTri = useMemo(
    () => calcularAcidentesTriPorUnidade(resultadosTri, ANO_ATUAL, unidades.map(u => u.codigo)),
    [resultadosTri, unidades],
  )
  const mapaPerdas = useMemo(
    () => calcularPacotePerdasPorUnidade(rows, rowsAux, metasPerdasIndicadores, ANO_ATUAL, dataEntradaPorUnidade),
    [rows, rowsAux, metasPerdasIndicadores, dataEntradaPorUnidade],
  )
  const mapaDispRota = useMemo(
    () => new Map(disponibilidadeRota.map(d => [d.unidade, d])),
    [disponibilidadeRota],
  )
  const mapaDispArmazem = useMemo(
    () => new Map(disponibilidadeArmazem.map(d => [d.unidade, d])),
    [disponibilidadeArmazem],
  )
  // Scorecard tem uma linha por unidade × negócio — chave `${unidade}|${negocio}`.
  const mapaScorecard = useMemo(
    () => new Map(scorecards.map(s => [`${s.unidade}|${s.negocio}`, s])),
    [scorecards],
  )

  // EBITDA Global é sempre o resultado da AMBEV consolidada — mesmo valor
  // (meta, real e status) em todos os cards, unidade nenhuma tem o "seu
  // próprio" EBITDA Global.
  const linhaEbitdaGlobal = useMemo(
    () => linhaIndicadorDre('EBITDA Global', mapaEbitda.get('AMBEV|CONS')),
    [mapaEbitda],
  )

  const cards = useMemo(() => unidadesCardsFarol(unidades).map(card => {
    const chaveNegocio = `${card.unidadeCodigo}|${card.negocio ?? 'CONS'}`
    return {
      card,
      semestre: [
        linhaIndicadorDre('Gastos Totais', mapaGastos.get(chaveNegocio)),
        linhaAcidentesTri(mapaTri.get(card.unidadeCodigo)),
        ...card.disponibilidades.map(d => {
          if (d === 'ROTA') return linhaDisponibilidadeRota(mapaDispRota.get(card.unidadeCodigo))
          if (d === 'ARM') return linhaDisponibilidadeArmazem(mapaDispArmazem.get(card.unidadeCodigo))
          return linhaPendente(`Disp. ${NOME_DISPONIBILIDADE[d]}`)
        }),
      ],
      ano: [
        ...card.disponibilidades.map(d => linhaScorecard(d, mapaScorecard.get(`${card.unidadeCodigo}|${d}`))),
        linhaPacotePerdas(mapaPerdas.get(card.unidadeCodigo)),
        linhaIndicadorDre('EBITDA Unidade', mapaEbitda.get(chaveNegocio)),
        linhaEbitdaGlobal,
      ],
    }
  }), [unidades, mapaGastos, mapaEbitda, mapaTri, mapaPerdas, mapaDispRota, mapaDispArmazem, mapaScorecard, linhaEbitdaGlobal])

  const resumo = useMemo<LinhaResumoFarolGerente[]>(() => cards.map(c => ({
    unidade: c.card.chave,
    nome: c.card.titulo,
    semestreBatidos: c.semestre.filter(l => l.status === 'bateu').length,
    semestreTotal: c.semestre.length,
    anoBatidos: c.ano.filter(l => l.status === 'bateu').length,
    anoTotal: c.ano.length,
  })), [cards])

  const totalUnidadesEbitda = useMemo(
    () => unidadesOperacionais.filter(u => participaContagemEbitda(u.nome)).length,
    [unidadesOperacionais],
  )

  const secoesAmbev = useMemo(() => [
    {
      titulo: 'Semestre',
      icone: CalendarDays,
      linhas: [
        linhaIndicadorDre('Gastos Totais', mapaGastos.get('AMBEV|CONS')),
        linhaAcidentesTri(mapaTri.get('AMBEV')),
        linhaDisponibilidadeArmazem(mapaDispArmazem.get('AMBEV')),
        linhaDisponibilidadeRota(mapaDispRota.get('AMBEV')),
        linhaPendente(`Disp. ${NOME_DISPONIBILIDADE.EMP}`),
      ],
    },
    {
      titulo: 'Anual',
      icone: BarChart3,
      linhas: [
        linhaScorecard('ROTA', mapaScorecard.get('AMBEV|ROTA')),
        linhaScorecard('ARM', mapaScorecard.get('AMBEV|ARM')),
        linhaScorecard('EMP', mapaScorecard.get('AMBEV|EMP')),
        linhaPacotePerdas(mapaPerdas.get('AMBEV')),
        { indicador: 'Unid. EBITDA', meta: String(totalUnidadesEbitda), real: '0', status: 'pendente' as const },
        linhaEbitdaGlobal,
      ],
    },
  ], [mapaGastos, mapaTri, mapaPerdas, mapaDispRota, mapaDispArmazem, mapaScorecard, totalUnidadesEbitda, linhaEbitdaGlobal])

  if (loadingUnidades || loadingDados) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-gray-200/30 bg-white/60 p-6 text-center shadow-xl shadow-gray-200/20 backdrop-blur-xl dark:border-gray-700/30 dark:bg-gray-800/60 dark:shadow-black/20">
        <h1 className="text-2xl font-bold text-foreground">🚦 Farol Gerentes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Metas {ANO_ATUAL}</p>
      </div>

      <ResumoExecutivoFarolGerentes linhas={resumo} />

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Building2 className="h-4 w-4" />
          Visão Consolidada
        </h2>
        <CardFarolGerente
          titulo="LOG20 — Corporativo"
          subtitulo="Consolidado AMBEV, todas as unidades"
          destaque
          secoes={secoesAmbev}
        />
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-4 w-4" />
          Unidades Operacionais
        </h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {cards.map(c => (
            <CardFarolGerente
              key={c.card.chave}
              titulo={c.card.titulo}
              secoes={[
                { titulo: 'Semestre', icone: CalendarDays, linhas: c.semestre },
                { titulo: 'Anual', icone: BarChart3, linhas: c.ano },
              ]}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
