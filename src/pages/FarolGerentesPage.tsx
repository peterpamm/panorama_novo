import { useMemo } from 'react'
import { BarChart3, Building2, CalendarDays, MapPin } from 'lucide-react'
import { useUnidades } from '@/hooks/useUnidades'
import { useFarolGerentesDados } from '@/hooks/useFarolGerentesDados'
import { Skeleton } from '@/components/ui/skeleton'
import { CardFarolGerente } from '@/components/farol-gerentes/CardFarolGerente'
import { ResumoExecutivoFarolGerentes, type LinhaResumoFarolGerente } from '@/components/farol-gerentes/ResumoExecutivoFarolGerentes'
import {
  calcularAcidentesTriPorUnidade, calcularIndicadorPorNegocio, calcularPacotePerdasPorUnidade,
  linhaAcidentesTri, linhaDisponibilidadeArmazem, linhaDisponibilidadeEmpurrada, linhaDisponibilidadeRota,
  linhaIndicadorDre, linhaPacotePerdas, linhaPosicaoLog20, type LinhaFarolGerente, participaContagemEbitda, unidadesCardsFarol,
} from '@/lib/farol-gerentes'
import { perdasPctPorNegocio } from '@/lib/painel-perdas-calculations'

const ANO_ATUAL = new Date().getFullYear()

/**
 * Farol Gerentes — recriação do painel antigo (Streamlit, 06_Farol_Gerentes.py)
 * no layout novo. Estrutura idêntica ao original: card corporativo (AMBEV)
 * consolidado, Resumo Executivo (ranking Semestre/Ano) e um card por unidade
 * com os mesmos indicadores (Gastos Totais, Acidentes TRI, Disponibilidade
 * ARM/ROTA/EMP no Semestre; Posição LOG20, Pacote de Perdas, EBITDA Unidade/
 * Global no Ano). Posição LOG20 e EBITDA Global são sempre o mesmo valor em
 * todo card (empresa toda); Gastos Totais e EBITDA Unidade variam de fato
 * entre os 2 cards de Camaçari/Ponta Grossa (cada gerente responde pelo
 * resultado do próprio negócio). Pacote de Perdas: Meta sempre 0% no card do
 * Armazém (sem orçamento de Perdas por negócio, só pro consolidado), mas o
 * Realizado já vem separado por negócio nesse card (`perdasPctPorNegocio`);
 * no card de Rota/Empurrada continua o Realizado/Meta da unidade inteira.
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
 * de Perdas — sempre CONS, exceto no card do Armazém de Camaçari/Ponta
 * Grossa, ver docstring acima), Disp. Rota, Disp.
 * Armazém e Disp. Empurrada (snapshots únicos importados em Importação >
 * Financeiro > Disponibilidade Rota/Armazém/Empurrada — a de Armazém pode
 * ficar sem meta se a planilha não trouxer essa coluna; a de Empurrada só
 * tem dado de verdade pra Ponta Grossa/Estância, únicas unidades com esse
 * negócio) e Posição LOG20 (Importação > Financeiro > Dados auxiliares —
 * faixa manual da LOG20 no ranking de operadores da Ambev, meta fixa de
 * top 5, ver `META_POSICAO_LOG20`). Posição LOG20 é da empresa toda, não
 * por unidade — mesmo valor em todo card, como o EBITDA Global já é
 * (substituiu o antigo Scorecard por unidade, que a Ambev não fornece mais).
 */
export function FarolGerentesPage() {
  const { unidades, loading: loadingUnidades } = useUnidades()
  const {
    rows, orcamentos, resultadosTri, rowsAux, metasPerdasIndicadores, disponibilidadeRota, disponibilidadeArmazem,
    disponibilidadeEmpurrada, posicoesLog20, loading: loadingDados,
  } = useFarolGerentesDados(unidades)

  const posicaoLog20 = useMemo(
    () => posicoesLog20.find(p => p.ano === ANO_ATUAL)?.faixa ?? null,
    [posicoesLog20],
  )

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
  const mapaDispEmpurrada = useMemo(
    () => new Map(disponibilidadeEmpurrada.map(d => [d.unidade, d])),
    [disponibilidadeEmpurrada],
  )
  // EBITDA Global é sempre o resultado da AMBEV consolidada — mesmo valor
  // (meta, real e status) em todos os cards, unidade nenhuma tem o "seu
  // próprio" EBITDA Global.
  const linhaEbitdaGlobal = useMemo(
    () => linhaIndicadorDre('EBITDA Global', mapaEbitda.get('AMBEV|CONS')),
    [mapaEbitda],
  )
  // Posição LOG20 (empresa toda) — mesmo valor em todo card, como o EBITDA Global.
  const linhaPosicaoLog20Global = useMemo(() => linhaPosicaoLog20(posicaoLog20), [posicaoLog20])

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
          return linhaDisponibilidadeEmpurrada(mapaDispEmpurrada.get(card.unidadeCodigo))
        }),
      ],
      ano: [
        linhaPosicaoLog20Global,
        // Pacote de Perdas só tem orçamento pro consolidado da unidade — no
        // card do Armazém de Camaçari/Ponta Grossa o Realizado vem separado
        // por negócio (`perdasPctPorNegocio`) e a Meta vira 0% (sem
        // orçamento próprio pra ela), mesma régua do slide Metas Bônus
        // (`montarCardsFarolGerentes`, farol-gerentes.ts).
        linhaPacotePerdas(
          card.negocio === 'ARM'
            ? { realPct: perdasPctPorNegocio(rows, rowsAux, card.unidadeCodigo, 'ARM', ANO_ATUAL), metaPct: 0 }
            : mapaPerdas.get(card.unidadeCodigo),
        ),
        linhaIndicadorDre('EBITDA Unidade', mapaEbitda.get(chaveNegocio)),
        linhaEbitdaGlobal,
      ],
    }
  }), [unidades, rows, rowsAux, mapaGastos, mapaEbitda, mapaTri, mapaPerdas, mapaDispRota, mapaDispArmazem, mapaDispEmpurrada, linhaPosicaoLog20Global, linhaEbitdaGlobal])

  const resumo = useMemo<LinhaResumoFarolGerente[]>(() => cards.map(c => ({
    unidade: c.card.chave,
    nome: c.card.titulo,
    semestreBatidos: c.semestre.filter(l => l.status === 'bateu').length,
    semestreTotal: c.semestre.length,
    anoBatidos: c.ano.filter(l => l.status === 'bateu').length,
    anoTotal: c.ano.length,
  })), [cards])

  // Conta sobre os `cards` já montados (pós-split Camaçari/Ponta Grossa),
  // não sobre a lista crua de unidades — senão Camaçari/Ponta Grossa contam
  // como 1 unidade só em vez de 2 (CDL/CDR ou Empurrada/Armazém, cada
  // negócio com seu próprio gerente e seu próprio resultado de EBITDA).
  const cardsParaEbitda = useMemo(
    () => cards.filter(c => participaContagemEbitda(c.card.titulo)),
    [cards],
  )
  const unidadesEbitdaBatidas = useMemo(
    () => cardsParaEbitda.filter(c => c.ano[2]?.status === 'bateu').length,
    [cardsParaEbitda],
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
        linhaDisponibilidadeEmpurrada(mapaDispEmpurrada.get('AMBEV')),
      ],
    },
    {
      titulo: 'Anual',
      icone: BarChart3,
      linhas: [
        linhaPosicaoLog20Global,
        linhaPacotePerdas(mapaPerdas.get('AMBEV')),
        {
          indicador: 'Unid. EBITDA',
          meta: String(cardsParaEbitda.length),
          real: String(unidadesEbitdaBatidas),
          status: unidadesEbitdaBatidas >= cardsParaEbitda.length ? 'bateu' : 'perdeu',
        } satisfies LinhaFarolGerente,
        linhaEbitdaGlobal,
      ],
    },
  ], [mapaGastos, mapaTri, mapaPerdas, mapaDispRota, mapaDispArmazem, mapaDispEmpurrada, linhaPosicaoLog20Global, cardsParaEbitda, unidadesEbitdaBatidas, linhaEbitdaGlobal])

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
