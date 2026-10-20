import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { IndicadorChart } from '@/components/farol/IndicadorChart'
import { COR_META, COR_NEGATIVO, COR_POSITIVO, MES_ABREV, getChartColors } from '@/components/farol/chart-shared'
import { normalizarParaCalculo, somaReal, somaRealComSinal } from '@/lib/farol-calculations'
import { buscarOrcadoRs } from '@/lib/orcamento-farol'
import { metaPerdasMensalUnidade, somaDif } from '@/lib/painel-perdas-calculations'
import { useContas } from '@/hooks/useContas'
import { PACOTES } from '@/lib/constants'
import { PillToggle } from '@/components/ui/pill-toggle'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { cn, formatCurrencyInteiro, formatInteiroPtBr, formatPercent } from '@/lib/utils'
import type { DreLongoRow, MetaPerdaIndicador, OrcamentoLinha } from '@/types'
import {
  AcompanhamentoConta, BlocoPacote, corGapRs, type GrupoAberturaConta, MESES_12, Separador, somaRemunerado, TabelaAberturaConta,
} from '@/pages/sdg/abertura-conta-shared'

/**
 * Cópia independente de `SlidePacoteDeGenteGerentes.tsx` (SDG Gerentes) —
 * DE PROPÓSITO duplicada, não reaproveitada: o slide da apresentação precisa
 * ficar resumido, enquanto essa página (Análise Detalhada > Pacote de Gente)
 * vai receber novas análises ao longo do tempo que não fazem sentido na
 * apresentação. As peças de baixo nível continuam reaproveitadas
 * (`BlocoPacote`/`TabelaAberturaConta`/`AcompanhamentoConta` de
 * `abertura-conta-shared.tsx`, `IndicadorChart` etc.) — só o conteúdo desta
 * página em si (estrutura das seções, o que cada uma mostra) é independente
 * do slide. Ajustar o slide da apresentação NÃO deve mexer aqui, e
 * vice-versa.
 */

const GRUPOS_BENEFICIOS: GrupoAberturaConta[] = [
  { rotulo: 'Vale Refeição', codigos: [57, 173] },
  { rotulo: 'Vale Transporte', codigos: [58, 174] },
  { rotulo: 'Plano de Saúde', codigos: [59, 175] },
  { rotulo: 'Cesta Básica', codigos: [60, 176] },
  { rotulo: 'Café da Manhã', codigos: [61] },
  { rotulo: 'Seguro de Vida', codigos: [62, 178] },
  { rotulo: 'PLR – Participação nos Resultados', codigos: [63, 183] },
  { rotulo: 'Plano Odontológico', codigos: [64, 180] },
  { rotulo: 'Taxas ADM VT/VA', codigos: [65] },
  { rotulo: 'Cesta Básica - Cartão', codigos: [66] },
  { rotulo: 'Incentivos', codigos: [67] },
  { rotulo: 'Outras Despesas Gerais', codigos: [68] },
  { rotulo: 'Auxílio Educação', codigos: [177] },
  { rotulo: 'Assistência Médica e Social', codigos: [179] },
  { rotulo: 'Cursos e Treinamentos', codigos: [181] },
  { rotulo: 'Previdência Privada', codigos: [182] },
]

/**
 * "Gastos Contratação/Demissão" — mesmo caso de Benefícios: conta-mãe em
 * DUAS árvores (069 operacional, 184 administrativo, registradas em
 * `PACOTES['069']`). Das 3 folhas administrativas (185-187), todas têm par
 * operacional — só "Cursos e Treinamentos" (073) existe apenas no
 * operacional, sem par administrativo.
 */
const GRUPOS_CONTRATACAO_DEMISSAO: GrupoAberturaConta[] = [
  { rotulo: 'PCMSO/PPRA', codigos: [70, 185] },
  { rotulo: 'Exames Médicos', codigos: [71, 186] },
  { rotulo: 'Despesas Recrutamento e Seleção', codigos: [72, 187] },
  { rotulo: 'Cursos e Treinamentos', codigos: [73] },
]

const CONTAS_SEGURANCA = [75, 76, 77, 78]
const CONTAS_ENCARGOS = Array.from({ length: 50 - 39 + 1 }, (_, i) => 39 + i)

interface BlocoGapOrcamentoMensalProps {
  /** Código do pacote (`036` Salários, `056` Gastos com Benefícios...) — chave em `PACOTES`/`PACOTE_CONTA_ORCAMENTO`, sempre registrado como [operacional, administrativo] nessa ordem. */
  codigo: string
  /** Nome exibido nos títulos dos cards/tabela (ex: "Salários", "Gastos com Benefícios"). */
  titulo: string
  /** Todas as linhas da unidade selecionada, sem filtro de ano (`rowsAno` filtra aqui dentro). */
  rowsUnidadeCons: DreLongoRow[]
  orcamentoAno: OrcamentoLinha[]
  unidade: string
  negocio: string
  ano: number
  mes: number
  /** Realizado do Pacote de Gente inteiro (159) — denominador do Impacto % no Pacote, mês e acumulado do ano. */
  realizadoGenteMaeMes: number
  realizadoGenteMae: number
  /** Mostra a 1ª linha "Orçamento" na tabela — default true. false quando o pacote não tem orçamento relevante cadastrado (ex: Gastos Contratação/Demissão). */
  mostrarOrcamento?: boolean
}

type SegmentoOperacionalAdm = 'consolidado' | 'operacional' | 'adm'
const OPCOES_SEGMENTO_OPERACIONAL_ADM = [
  { value: 'consolidado', label: 'Consolidado' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'adm', label: 'ADM' },
] as const

/**
 * Cards (Gap Remunerado × Realizado do mês/acumulado + Impacto % no Pacote
 * de Gente) + tabela mensal (com uma 1ª linha "Orçamento", valor em R$ direto
 * da planilha de Orçamento via `buscarOrcadoRs`) pra um pacote que soma
 * operacional + administrativo — usado tanto em "Salários" (036) quanto
 * "Gastos com Benefícios" (056). Recorte próprio dessa página, pedido pelo
 * usuário, diferente do `BlocoPacote` genérico usado no slide da
 * apresentação: sem os 2 gráficos (mensal + comparativo), só a tabela.
 *
 * Pílula Consolidado/Operacional/ADM (`PACOTES[codigo].prefixos` = [código
 * operacional, código administrativo] nessa ordem, mesma ordem em
 * `PACOTE_CONTA_ORCAMENTO` pras unidades antigas) controla os 3 cards E a
 * tabela ao mesmo tempo — índice 0/1 vai direto pro `indiceApenas` de
 * `buscarOrcadoRs` (Orçamento) e filtra os prefixos usados em
 * `somaRemunerado`/`somaReal` (Remunerado/Realizado/Impacto %).
 */
function BlocoGapOrcamentoMensal({
  codigo, titulo, rowsUnidadeCons, orcamentoAno, unidade, negocio, ano, mes, realizadoGenteMaeMes, realizadoGenteMae,
  mostrarOrcamento = true,
}: BlocoGapOrcamentoMensalProps) {
  const [segmento, setSegmento] = useState<SegmentoOperacionalAdm>('consolidado')
  const ctx = { unidade, negocio, ano, codigo }
  const prefixosBase = PACOTES[codigo].prefixos
  const indiceSegmento = segmento === 'operacional' ? 0 : segmento === 'adm' ? 1 : undefined
  const prefixos = indiceSegmento === undefined ? prefixosBase : [prefixosBase[indiceSegmento]]
  const rowsAno = useMemo(() => rowsUnidadeCons.filter(r => r.ano === ano), [rowsUnidadeCons, ano])

  const serie = useMemo(() => {
    let acumuladoOrcado = 0
    let acumuladoRemunerado = 0
    let acumuladoRealizado = 0
    let acumuladoRealizadoComSinal = 0
    return MESES_12.map(m => {
      const rowsMes = rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === m)
      const calc = rowsMes.length > 0 ? normalizarParaCalculo(rowsMes) : null
      const remunerado = calc ? somaRemunerado(calc, prefixos) : null
      const realizado = calc ? somaReal(calc, prefixos) : null
      // Sinal original do GInfo, só pra exibição — ver `DreCalculoRow.realComSinal`.
      const realizadoComSinal = calc ? somaRealComSinal(calc, prefixos) : null
      if (remunerado !== null) acumuladoRemunerado += remunerado
      if (realizado !== null) acumuladoRealizado += realizado
      if (realizadoComSinal !== null) acumuladoRealizadoComSinal += realizadoComSinal
      // remunerado + realizadoComSinal, não `- realizado` (magnitude) — ver comentário em `comPercentualEDelta` (abertura-conta-shared.tsx).
      const gap = remunerado !== null && realizadoComSinal !== null ? remunerado + realizadoComSinal : null

      const orcado = buscarOrcadoRs(orcamentoAno, { ...ctx, mes: m }, indiceSegmento)
      if (orcado !== null) acumuladoOrcado += orcado

      return {
        mes: m, orcado, remunerado, realizado, realizadoComSinal, gap,
        acumuladoOrcado: orcado !== null ? acumuladoOrcado : null,
        acumuladoRemunerado: remunerado !== null ? acumuladoRemunerado : null,
        acumuladoRealizado: realizado !== null ? acumuladoRealizado : null,
        acumuladoRealizadoComSinal: realizadoComSinal !== null ? acumuladoRealizadoComSinal : null,
        acumuladoGap: gap !== null ? acumuladoRemunerado + acumuladoRealizadoComSinal : null,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsAno, orcamentoAno, unidade, negocio, ano, codigo, segmento])

  const linhaMesSel = serie[mes - 1]
  const gapMes = linhaMesSel.gap
  const gapAno = linhaMesSel.acumuladoGap
  // Impacto % no Pacote de Gente — segue o recorte selecionado: Consolidado
  // compara o Salários inteiro, Operacional/ADM compara só aquele pedaço
  // (`linhaMesSel.realizado`/`acumuladoRealizado`, já filtrado pelo
  // `prefixos` do segmento ativo) contra o Pacote de Gente inteiro (159).
  const percentualDoPacoteMes = realizadoGenteMaeMes === 0 || linhaMesSel.realizado === null
    ? null
    : (linhaMesSel.realizado / realizadoGenteMaeMes) * 100
  const percentualDoPacoteAno = realizadoGenteMae === 0 || linhaMesSel.acumuladoRealizado === null
    ? null
    : (linhaMesSel.acumuladoRealizado / realizadoGenteMae) * 100

  return (
    <>
      <div className="flex justify-end">
        <PillToggle opcoes={OPCOES_SEGMENTO_OPERACIONAL_ADM} value={segmento} onChange={setSegmento} />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Gap Remunerado × Realizado — Mês — {MES_ABREV[mes]}/{ano}
          </p>
          <p className={cn('mt-2 text-3xl font-bold', corGapRs(gapMes))}>
            {gapMes === null ? '—' : formatCurrencyInteiro(gapMes)}
          </p>
        </div>
        <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Gap Remunerado × Realizado — Acumulado Ano
          </p>
          <p className={cn('mt-2 text-3xl font-bold', corGapRs(gapAno))}>
            {gapAno === null ? '—' : formatCurrencyInteiro(gapAno)}
          </p>
        </div>
        <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Impacto % no Pacote de Gente
          </p>
          <div className="mt-2 flex items-end gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">Mês — {MES_ABREV[mes]}/{ano}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPercent(percentualDoPacoteMes, 1)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">Ano</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPercent(percentualDoPacoteAno, 1)}</p>
            </div>
          </div>
        </div>
      </div>

      <TableCard
        titulo={`${titulo} por mês`}
        subtitulo={`Orçamento × Remunerado × Realizado — gap (Remunerado − Realizado) · Acumulado soma Jan até ${MES_ABREV[mes]}`}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Métrica</TableHead>
              {MESES_12.map(m => (
                <TableHead key={m} className="text-center">{MES_ABREV[m]}</TableHead>
              ))}
              <TableHead className="text-center">Acumulado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mostrarOrcamento && (
              <TableRow className="border-gray-200/30 dark:border-gray-700/30">
                <TableCell className="text-sm font-medium">Orçamento</TableCell>
                {serie.map(p => (
                  <TableCell key={p.mes} className="text-center text-sm tabular-nums">
                    {p.mes > mes || p.orcado === null ? '—' : formatInteiroPtBr(p.orcado)}
                  </TableCell>
                ))}
                <TableCell className="text-center text-sm font-semibold tabular-nums">
                  {linhaMesSel.acumuladoOrcado === null ? '—' : formatInteiroPtBr(linhaMesSel.acumuladoOrcado)}
                </TableCell>
              </TableRow>
            )}
            <TableRow className="border-gray-200/30 dark:border-gray-700/30">
              <TableCell className="text-sm font-medium">Remunerado</TableCell>
              {serie.map(p => (
                <TableCell key={p.mes} className="text-center text-sm tabular-nums">
                  {p.mes > mes || p.remunerado === null ? '—' : formatInteiroPtBr(p.remunerado)}
                </TableCell>
              ))}
              <TableCell className="text-center text-sm font-semibold tabular-nums">
                {linhaMesSel.acumuladoRemunerado === null ? '—' : formatInteiroPtBr(linhaMesSel.acumuladoRemunerado)}
              </TableCell>
            </TableRow>
            <TableRow className="border-gray-200/30 dark:border-gray-700/30">
              <TableCell className="text-sm font-medium">Realizado</TableCell>
              {/* Mostra com o sinal ORIGINAL do GInfo (`realizadoComSinal`),
                  não a magnitude (`realizado`, usada só no Gap/cálculo) —
                  sem isso, um mês com Remunerado zerado (ex: Camaçari
                  Armazém) mostrava o Realizado sempre "positivo" e o gerente
                  lia como se tivesse sobrado, mesmo sendo 100% estouro. Mas
                  forçar sempre negativo (tentativa anterior) também mentia
                  nos poucos casos em que a conta teve mais crédito que
                  débito no período de verdade (ex: Vales Financeiros em
                  Praia Grande) — o sinal de verdade é positivo nesse caso. */}
              {serie.map(p => (
                <TableCell key={p.mes} className="text-center text-sm tabular-nums">
                  {p.mes > mes || p.realizadoComSinal === null ? '—' : formatInteiroPtBr(p.realizadoComSinal)}
                </TableCell>
              ))}
              <TableCell className="text-center text-sm font-semibold tabular-nums">
                {linhaMesSel.acumuladoRealizadoComSinal === null ? '—' : formatInteiroPtBr(linhaMesSel.acumuladoRealizadoComSinal)}
              </TableCell>
            </TableRow>
            <TableRow className="border-gray-200/30 bg-muted/40 dark:border-gray-700/30">
              <TableCell className="text-sm font-semibold">Gap</TableCell>
              {serie.map(p => (
                <TableCell key={p.mes} className={cn('text-center text-sm font-semibold tabular-nums', p.mes > mes ? 'text-muted-foreground' : corGapRs(p.gap))}>
                  {p.mes > mes || p.gap === null ? '—' : formatInteiroPtBr(p.gap)}
                </TableCell>
              ))}
              <TableCell className={cn('text-center text-sm font-bold tabular-nums', corGapRs(gapAno))}>
                {gapAno === null ? '—' : formatInteiroPtBr(gapAno)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableCard>
    </>
  )
}

/** Folhas de Gastos com Vales (051) — ordem de exibição pedida pelo usuário: Vales Físicos (053) antes de Vales Financeiros (052). */
const CONTAS_VALES_ORDENADAS = [53, 52]
const CONTAS_VALES = ['052', '053']

interface BlocoValesProps {
  rowsTodosNegocios: DreLongoRow[]
  unidade: string
  ano: number
  mes: number
  nomesConta: Map<string, string>
  realizadoGenteMaeMes: number
  realizadoGenteMae: number
  metasPerdasAno: MetaPerdaIndicador[]
  dataEntradaUnidade: string | null
}

function BlocoVales({
  rowsTodosNegocios, unidade, ano, mes, nomesConta, realizadoGenteMaeMes, realizadoGenteMae, metasPerdasAno, dataEntradaUnidade,
}: BlocoValesProps) {
  const { axis, cursor } = getChartColors()

  const rowsCons = useMemo(() => rowsTodosNegocios.filter(r => r.negocio === 'CONS'), [rowsTodosNegocios])
  const rowsAno = useMemo(() => rowsCons.filter(r => r.ano === ano), [rowsCons, ano])
  const rowsAnoAnterior = useMemo(() => rowsCons.filter(r => r.ano === ano - 1), [rowsCons, ano])

  const rowsMesAtual = useMemo(() => rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === mes), [rowsAno, mes])
  const rowsAcumulado = useMemo(() => rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes <= mes), [rowsAno, mes])
  const rowsAcumuladoAnterior = useMemo(() => rowsAnoAnterior.filter(r => r.tipo_periodo === 'MENSAL' && r.mes <= mes), [rowsAnoAnterior, mes])

  const realizadoMes = useMemo(() => somaReal(normalizarParaCalculo(rowsMesAtual), CONTAS_VALES), [rowsMesAtual])
  const dispersaoMes = useMemo(() => somaDif(rowsMesAtual, CONTAS_VALES), [rowsMesAtual])

  const realizadoAno = useMemo(() => somaReal(normalizarParaCalculo(rowsAcumulado), CONTAS_VALES), [rowsAcumulado])
  const dispersaoAno = useMemo(() => somaDif(rowsAcumulado, CONTAS_VALES), [rowsAcumulado])

  const dispersaoAnoAnterior = useMemo(() => somaDif(rowsAcumuladoAnterior, CONTAS_VALES), [rowsAcumuladoAnterior])

  const percentualDoPacoteMes = realizadoGenteMaeMes === 0 ? null : (realizadoMes / realizadoGenteMaeMes) * 100
  const percentualDoPacoteAno = realizadoGenteMae === 0 ? null : (realizadoAno / realizadoGenteMae) * 100

  const melhorou = dispersaoAno >= dispersaoAnoAnterior
  const diferencaRs = dispersaoAno - dispersaoAnoAnterior
  const serieComparativo = [
    { rotulo: `${ano - 1}`, valor: dispersaoAnoAnterior, atual: false },
    { rotulo: `${ano}`, valor: dispersaoAno, atual: true },
  ]
  // Folga do eixo Y proporcional ao INTERVALO (max-min), não ao valor de cada
  // barra — evita o rótulo de uma barra pertinho de zero colar no eixo X.
  const minComparativo = Math.min(0, dispersaoAnoAnterior, dispersaoAno)
  const maxComparativo = Math.max(0, dispersaoAnoAnterior, dispersaoAno)
  const folgaComparativo = (maxComparativo - minComparativo || 1) * 0.18
  const domainComparativo: [number, number] = [minComparativo - folgaComparativo, maxComparativo + folgaComparativo]

  function TooltipComparativo({ active, payload }: { active?: boolean; payload?: { value: number | null }[] }) {
    if (!active || !payload?.length || payload[0].value == null) return null
    return (
      <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
        Dispersão: <span className="font-medium">{formatInteiroPtBr(payload[0].value)}</span>
      </div>
    )
  }

  const metaMensalVales = useMemo(
    () => metaPerdasMensalUnidade(metasPerdasAno, 'vales', unidade, ano, dataEntradaUnidade),
    [metasPerdasAno, unidade, ano, dataEntradaUnidade],
  )
  const serieDispersaoMensal = useMemo(() => {
    const meses = Array.from(new Set(rowsAno.filter(r => r.tipo_periodo === 'MENSAL').map(r => r.mes))).sort((a, b) => a - b)
    return meses.map(m => ({
      mes: m,
      avr: somaDif(rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === m), CONTAS_VALES),
      meta: metaMensalVales,
    }))
  }, [rowsAno, metaMensalVales])

  const porContaEMes = useMemo(() => {
    return MESES_12.map(m => {
      const rowsMes = rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === m)
      const dispersaoPorConta = CONTAS_VALES_ORDENADAS.map(c => somaDif(rowsMes, [String(c).padStart(3, '0')]))
      return { mes: m, dispersaoPorConta, total: dispersaoPorConta.reduce((acc, v) => acc + v, 0) }
    })
  }, [rowsAno])
  const acumuladoPorConta = CONTAS_VALES_ORDENADAS.map((_, i) =>
    porContaEMes.slice(0, mes).reduce((acc, p) => acc + p.dispersaoPorConta[i], 0))
  const acumuladoTotal = acumuladoPorConta.reduce((a, b) => a + b, 0)

  return (
    <>
      <Separador titulo="VALES" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Vales — Dispersão
          </p>
          <div className="mt-2 grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">Mês — {MES_ABREV[mes]}/{ano}</p>
              <p className={cn('text-3xl font-bold', corGapRs(dispersaoMes))}>{formatInteiroPtBr(dispersaoMes)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">Ano</p>
              <p className={cn('text-3xl font-bold', corGapRs(dispersaoAno))}>{formatInteiroPtBr(dispersaoAno)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Impacto % no Pacote de Gente
          </p>
          <div className="mt-2 flex items-end gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">Mês — {MES_ABREV[mes]}/{ano}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPercent(percentualDoPacoteMes, 1)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">Ano</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPercent(percentualDoPacoteAno, 1)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5 lg:col-span-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Vales — Dispersão Mensal — {ano}
          </p>
          <IndicadorChart
            serie={serieDispersaoMensal}
            gradientId="analise-detalhada-gente-vales-dispersao"
            natureza="performance"
            nomeSerie="Dispersão"
            nomeMeta="Meta"
            formatter={formatInteiroPtBr}
          />
        </div>

        <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Dispersão Acumulada até {MES_ABREV[mes]}
          </p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serieComparativo} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 12, fontWeight: 600 }} />
                <YAxis hide domain={domainComparativo} />
                <Tooltip content={<TooltipComparativo />} cursor={{ fill: cursor }} />
                <Bar dataKey="valor" name="Dispersão" radius={[4, 4, 0, 0]} barSize={36}>
                  {serieComparativo.map(p => (
                    <Cell key={p.rotulo} fill={p.valor === null ? COR_META : !p.atual ? COR_META : melhorou ? COR_POSITIVO : COR_NEGATIVO} />
                  ))}
                  <LabelList
                    dataKey="valor"
                    position="top"
                    formatter={(v: unknown) => typeof v === 'number' ? formatInteiroPtBr(v) : '—'}
                    style={{ fontSize: 13, fontWeight: 700 }}
                    className="fill-gray-600 dark:fill-slate-300"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className={cn(
            'mt-2 text-center text-sm font-semibold',
            melhorou ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
          )}>
            {`${diferencaRs >= 0 ? '+' : ''}${formatInteiroPtBr(diferencaRs)} vs ${ano - 1}`}
          </p>
        </div>
      </div>

      <TableCard titulo="Vales por mês" subtitulo={`Dispersão (Remunerado − Realizado) por conta filha — vermelho = estourou o remunerado do mês · Acumulado soma Jan até ${MES_ABREV[mes]}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conta</TableHead>
              {MESES_12.map(m => (
                <TableHead key={m} className="text-center">{MES_ABREV[m]}</TableHead>
              ))}
              <TableHead className="text-center">Acumulado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CONTAS_VALES_ORDENADAS.map((c, i) => (
              <TableRow key={c} className="border-gray-200/30 dark:border-gray-700/30">
                <TableCell className="text-sm">{nomesConta.get(String(c).padStart(3, '0')) ?? c}</TableCell>
                {porContaEMes.map(p => (
                  <TableCell key={p.mes} className={cn('text-center text-sm font-semibold tabular-nums', p.mes > mes ? 'text-muted-foreground' : corGapRs(p.dispersaoPorConta[i]))}>
                    {p.mes > mes ? '—' : formatInteiroPtBr(p.dispersaoPorConta[i])}
                  </TableCell>
                ))}
                <TableCell className={cn('text-center text-sm font-bold tabular-nums', corGapRs(acumuladoPorConta[i]))}>
                  {formatInteiroPtBr(acumuladoPorConta[i])}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-gray-200/30 bg-muted/40 font-semibold dark:border-gray-700/30">
              <TableCell className="text-sm">Total</TableCell>
              {porContaEMes.map(p => (
                <TableCell key={p.mes} className={cn('text-center text-sm font-semibold tabular-nums', p.mes > mes ? 'text-muted-foreground' : corGapRs(p.total))}>
                  {p.mes > mes ? '—' : formatInteiroPtBr(p.total)}
                </TableCell>
              ))}
              <TableCell className={cn('text-center text-sm font-bold tabular-nums', corGapRs(acumuladoTotal))}>
                {formatInteiroPtBr(acumuladoTotal)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableCard>
    </>
  )
}

interface Props {
  /** Todas as linhas da unidade selecionada, sem filtro de ano (precisa do ano anterior pro comparativo acumulado) — já filtradas pro `negocio` selecionado no filtro da página. */
  rowsUnidadeCons: DreLongoRow[]
  /** Todas as linhas da unidade selecionada, TODOS os negócios (sem filtro nenhum) — só pra Vales/Painel de Perdas, que é sempre CONS por convenção própria, independente do filtro de negócio da página. */
  rowsTodosNegocios: DreLongoRow[]
  orcamentoAno: OrcamentoLinha[]
  unidade: string
  negocio: string
  ano: number
  mes: number
  metasPerdasAno: MetaPerdaIndicador[]
  dataEntradaUnidade: string | null
}

export function PacoteDeGenteDetalhado({
  rowsUnidadeCons, rowsTodosNegocios, orcamentoAno, unidade, negocio, ano, mes, metasPerdasAno, dataEntradaUnidade,
}: Props) {
  const { contas } = useContas()
  const nomesConta = useMemo(() => new Map(contas.map(c => [c.codigo, c.descricao])), [contas])

  const rowsAno = useMemo(() => rowsUnidadeCons.filter(r => r.ano === ano), [rowsUnidadeCons, ano])
  const calcAcumulado = useMemo(
    () => normalizarParaCalculo(rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes <= mes)),
    [rowsAno, mes],
  )
  const calcMesSelecionado = useMemo(
    () => normalizarParaCalculo(rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === mes)),
    [rowsAno, mes],
  )
  const realizadoGenteMae = useMemo(() => somaReal(calcAcumulado, PACOTES['159'].prefixos), [calcAcumulado])
  const realizadoGenteMaeMes = useMemo(() => somaReal(calcMesSelecionado, PACOTES['159'].prefixos), [calcMesSelecionado])

  const realizadoSegurancaMae = useMemo(() => somaReal(calcAcumulado, PACOTES['074'].prefixos), [calcAcumulado])
  const percentualSegurancaDoPacoteAno = realizadoGenteMae === 0 ? null : (realizadoSegurancaMae / realizadoGenteMae) * 100
  const realizadoSegurancaMaeMes = useMemo(() => somaReal(calcMesSelecionado, PACOTES['074'].prefixos), [calcMesSelecionado])
  const percentualSegurancaDoPacoteMes = realizadoGenteMaeMes === 0 ? null : (realizadoSegurancaMaeMes / realizadoGenteMaeMes) * 100

  return (
    <div className="flex flex-col gap-5">
      <BlocoPacote
        codigo="159" titulo="Pacote de Gente" prefixos={PACOTES['159'].prefixos} natureza={PACOTES['159'].natureza}
        rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoAno} unidade={unidade} negocio={negocio} ano={ano} mes={mes}
        mostrarToggleCurvaCaptura
      />

      <Separador titulo="SALÁRIOS" />
      <BlocoGapOrcamentoMensal
        codigo="036" titulo="Salários"
        rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoAno}
        unidade={unidade} negocio={negocio} ano={ano} mes={mes}
        realizadoGenteMaeMes={realizadoGenteMaeMes} realizadoGenteMae={realizadoGenteMae}
      />

      <Separador titulo="GASTOS COM BENEFÍCIOS" />
      <BlocoGapOrcamentoMensal
        codigo="056" titulo="Gastos com Benefícios"
        rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoAno}
        unidade={unidade} negocio={negocio} ano={ano} mes={mes}
        realizadoGenteMaeMes={realizadoGenteMaeMes} realizadoGenteMae={realizadoGenteMae}
      />
      <TabelaAberturaConta
        titulo="Abertura por conta — Gastos com Benefícios"
        grupos={GRUPOS_BENEFICIOS}
        descricaoContas="057-068 operacional + 173-183 administrativo"
        calcMes={calcMesSelecionado}
        calcAno={calcAcumulado}
        realizadoMaeMes={realizadoGenteMaeMes}
        realizadoMaeAno={realizadoGenteMae}
        rotuloPercentual="Peso % no Pacote"
        linhasDestaque={['Incentivos']}
        nomesConta={nomesConta}
        mes={mes}
        ano={ano}
        unidade={unidade}
        negocio={negocio}
        orcamentoAno={orcamentoAno}
      />

      <Separador titulo="SEGURANÇA" />
      <BlocoPacote
        codigo="074" titulo="Gastos com Uniformes e EPI's" prefixos={PACOTES['074'].prefixos} natureza={PACOTES['074'].natureza}
        rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoAno}
        unidade={unidade} negocio={negocio} ano={ano} mes={mes}
        percentualDoPacoteMes={percentualSegurancaDoPacoteMes} percentualDoPacoteAno={percentualSegurancaDoPacoteAno}
        tituloImpactoPacote="Impacto % no Pacote de Gente"
      />
      <TabelaAberturaConta
        titulo="Abertura por conta — Segurança"
        codigos={CONTAS_SEGURANCA}
        descricaoContas="075-078"
        calcMes={calcMesSelecionado}
        calcAno={calcAcumulado}
        realizadoMaeMes={realizadoGenteMaeMes}
        realizadoMaeAno={realizadoGenteMae}
        rotuloPercentual="Peso % no Pacote"
        nomesConta={nomesConta}
        mes={mes}
        ano={ano}
        unidade={unidade}
        negocio={negocio}
        orcamentoAno={orcamentoAno}
      />

      <Separador titulo="ENCARGOS" />
      <TabelaAberturaConta
        titulo="Abertura por conta — Encargos"
        codigos={CONTAS_ENCARGOS}
        descricaoContas="039-050"
        calcMes={calcMesSelecionado}
        calcAno={calcAcumulado}
        realizadoMaeMes={realizadoGenteMaeMes}
        realizadoMaeAno={realizadoGenteMae}
        rotuloPercentual="Peso % no Pacote"
        linhasDestaque={['043']}
        nomesConta={nomesConta}
        mes={mes}
        ano={ano}
        unidade={unidade}
        negocio={negocio}
        orcamentoAno={orcamentoAno}
      />
      <AcompanhamentoConta
        rowsAno={rowsAno}
        codigos={CONTAS_ENCARGOS}
        nomesConta={nomesConta}
        contaPadrao="043"
        mes={mes}
      />

      <BlocoVales
        rowsTodosNegocios={rowsTodosNegocios}
        unidade={unidade}
        ano={ano}
        mes={mes}
        nomesConta={nomesConta}
        realizadoGenteMaeMes={realizadoGenteMaeMes}
        realizadoGenteMae={realizadoGenteMae}
        metasPerdasAno={metasPerdasAno}
        dataEntradaUnidade={dataEntradaUnidade}
      />

      <Separador titulo="GASTOS CONTRATAÇÃO/DEMISSÃO" />
      <BlocoGapOrcamentoMensal
        codigo="069" titulo="Gastos Contratação/Demissão"
        rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoAno}
        unidade={unidade} negocio={negocio} ano={ano} mes={mes}
        realizadoGenteMaeMes={realizadoGenteMaeMes} realizadoGenteMae={realizadoGenteMae}
        mostrarOrcamento={false}
      />
      <TabelaAberturaConta
        titulo="Abertura por conta — Gastos Contratação/Demissão"
        grupos={GRUPOS_CONTRATACAO_DEMISSAO}
        descricaoContas="070-073 operacional + 185-187 administrativo"
        calcMes={calcMesSelecionado}
        calcAno={calcAcumulado}
        realizadoMaeMes={realizadoGenteMaeMes}
        realizadoMaeAno={realizadoGenteMae}
        rotuloPercentual="Peso % no Pacote"
        nomesConta={nomesConta}
        mes={mes}
        ano={ano}
        unidade={unidade}
        negocio={negocio}
        orcamentoAno={orcamentoAno}
      />
    </div>
  )
}
