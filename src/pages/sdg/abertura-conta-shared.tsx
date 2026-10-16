import { useMemo, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { IndicadorChart } from '@/components/farol/IndicadorChart'
import {
  avrPorPrefixo, calcularImpactoFinanceiro, calcularReceita, calcularSemaforo, calcularSerieAnual, calcularSerieCaptura,
  normalizarParaCalculo, type Semaforo,
} from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { buscarOrcadoContaFilha } from '@/lib/orcamento-conta-filha'
import {
  COR_META, COR_META_DESTAQUE, COR_NEGATIVO, COR_POSITIVO, MES_ABREV, TickComparativoAcumulado, domainComparativo, getChartColors,
  type BarraComparativo,
} from '@/components/farol/chart-shared'
import { PillToggle } from '@/components/ui/pill-toggle'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { cn, formatCurrencyInteiro, formatInteiroPtBr, formatPercent } from '@/lib/utils'
import type { DreCalculoRow, DreLongoRow, Natureza, OrcamentoLinha } from '@/types'

export const MESES_12 = Array.from({ length: 12 }, (_, i) => i + 1)

export function corSemaforo(corClasse: Semaforo['corClasse']): string {
  return corClasse === 'positivo' ? 'text-emerald-600 dark:text-emerald-400'
    : corClasse === 'negativo' ? 'text-red-600 dark:text-red-400'
    : 'text-muted-foreground'
}

export function corGapRs(gap: number | null): string {
  return gap === null ? 'text-muted-foreground' : gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
}

/** Soma REMUN (magnitude, mesma convenção de `somaReal` em farol-calculations.ts) das linhas cujo `conta_codigo` começa por algum dos `prefixos`. */
export function somaRemunerado(calc: DreCalculoRow[], prefixos: string | string[]): number {
  const lista = Array.isArray(prefixos) ? prefixos : [prefixos]
  return calc.filter(r => lista.some(p => r.conta_codigo.startsWith(p))).reduce((acc, r) => acc + r.remun, 0)
}

export interface LinhaAberturaConta {
  codigo: string
  realizado: number
  remunerado: number
  /** Orçado (R$) dessa conta-filha específica — ver `buscarOrcadoContaFilha` (orcamento-conta-filha.ts). 0 quando a conta não tem orçado cadastrado/mapeado pra essa unidade (nunca null — pedido explícito: "contas que não tem orçado mostra 0, sem problema"). */
  orcado: number
  /** (orçado ou remunerado, conforme o toggle ativo) - realizado — negativo = estourou, positivo = gastou menos (bom) — mesma convenção de sinal de `calcularImpactoFinanceiro` (meta - realizado) usada no resto do app. */
  delta: number
  /** % do realizado dessa conta sobre o realizado-base informado pelo chamador (normalmente o pacote-mãe de topo, não a conta-mãe imediata — ver `TabelaAberturaConta`). */
  percentualDoCusto: number
}

export interface ContaBruta {
  codigo: string
  realizado: number
  remunerado: number
  orcado: number
}

/**
 * Agrupa uma lista de contas (não precisa ser uma faixa contígua) por
 * `conta_codigo` (soma REAL em `realizado`, REMUN em `remunerado`, e busca
 * o Orçado em `orcadoPorConta` — mapa pré-calculado pelo chamador, ver
 * `TabelaAberturaConta`) — não reaproveita `agregarPorConta` (top-contas.ts)
 * de propósito: aquela função expõe `gap` = soma do DIF bruto (sinal
 * original, pré-abs), que pra essa tabela daria um delta diferente do que
 * faz sentido aqui (comparativo - realizado, ambos já em magnitude, mesma
 * convenção "positivo é bom" do resto do app). Contas zeradas (sem
 * realizado nem remunerado) saem fora.
 */
export function agruparContasBrutas(
  calc: DreCalculoRow[],
  codigos: readonly number[],
  orcadoPorConta: Map<string, number> = new Map(),
): ContaBruta[] {
  const alvo = new Set(codigos)
  const porConta = new Map<string, ContaBruta>()
  for (const r of calc) {
    const num = Number(r.conta_codigo)
    if (!Number.isInteger(num) || !alvo.has(num)) continue
    const atual = porConta.get(r.conta_codigo) ?? { codigo: r.conta_codigo, realizado: 0, remunerado: 0, orcado: orcadoPorConta.get(r.conta_codigo) ?? 0 }
    atual.realizado += r.real
    atual.remunerado += r.remun
    porConta.set(r.conta_codigo, atual)
  }
  return Array.from(porConta.values()).filter(c => c.realizado !== 0 || c.remunerado !== 0)
}

export interface GrupoAberturaConta {
  /** Rótulo exibido na tabela — usado como identidade da linha (não há um único `conta_codigo` quando o grupo soma mais de um código). */
  rotulo: string
  /** Códigos que compõem essa linha — normalmente 1, ou 2 quando o mesmo item conceitual tem código diferente em duas árvores do DRE (ex: Vale Refeição = 057 no pacote operacional + 173 no administrativo, mesmo motivo de Salários = 036+161). */
  codigos: readonly number[]
}

/** Como `agruparContasBrutas`, mas agrupando por `GrupoAberturaConta.rotulo` em vez de por `conta_codigo` — soma todos os códigos de cada grupo numa única linha (realizado, remunerado E orçado). Usado quando a mesma "conta" de negócio existe com códigos diferentes em duas árvores do DRE que precisam ser somadas pra dar o valor consolidado. */
export function agruparContasBrutasPorGrupo(
  calc: DreCalculoRow[],
  grupos: readonly GrupoAberturaConta[],
  orcadoPorConta: Map<string, number> = new Map(),
): ContaBruta[] {
  return grupos
    .map(g => {
      const brutas = agruparContasBrutas(calc, g.codigos, orcadoPorConta)
      return {
        codigo: g.rotulo,
        realizado: brutas.reduce((acc, c) => acc + c.realizado, 0),
        remunerado: brutas.reduce((acc, c) => acc + c.remunerado, 0),
        orcado: brutas.reduce((acc, c) => acc + c.orcado, 0),
      }
    })
    .filter(c => c.realizado !== 0 || c.remunerado !== 0)
}

export function comPercentualEDelta(brutas: ContaBruta[], realizadoMae: number, comparativo: 'orcado' | 'remunerado' = 'orcado'): LinhaAberturaConta[] {
  return brutas.map(c => ({
    codigo: c.codigo,
    realizado: c.realizado,
    remunerado: c.remunerado,
    orcado: c.orcado,
    delta: (comparativo === 'orcado' ? c.orcado : c.remunerado) - c.realizado,
    percentualDoCusto: realizadoMae === 0 ? 0 : (c.realizado / realizadoMae) * 100,
  }))
}

/**
 * Gastos (R$, pacote de código `prefixos`), Remunerado (R$) e Receita Líquida
 * (R$) acumulados de Jan até `mesCorte` num ano — soma o realizado mês a mês,
 * mesma técnica (e mesmo motivo: a linha ACUMULADO_ANO do DRE não vem
 * confiável pra toda unidade/mês) já usada em `SlideReceitaGerentes.tsx`/
 * `SlideEbitdaGerentes.tsx`/`SlideGastosTotaisGerentes.tsx`. Conta de CUSTO,
 * então `real`/`remun` já são magnitude (abs) por convenção em toda a base
 * (nunca "custo negativo") — sem o risco de sinal invertido que EBITDA
 * (performance) tinha. `remunerado` só serve pro card "Ano" de blocos com
 * `fonteMeta: 'remunerado'` (sem meta de Orçamento nesse nível). null =
 * nenhum mês com dado no intervalo.
 */
export function acumulados(rowsUnidadeCons: DreLongoRow[], ano: number, mesCorte: number, prefixos: string | string[]): { gastos: number; remunerado: number; receita: number } | null {
  let gastos = 0
  let remunerado = 0
  let receita = 0
  let temDado = false
  for (let m = 1; m <= mesCorte; m++) {
    const rowsMes = rowsUnidadeCons.filter(r => r.ano === ano && r.tipo_periodo === 'MENSAL' && r.mes === m)
    if (rowsMes.length === 0) continue
    const calc = normalizarParaCalculo(rowsMes)
    const receitaMes = calcularReceita(calc)
    const avrMes = avrPorPrefixo(calc, prefixos)
    gastos += (avrMes / 100) * receitaMes
    remunerado += somaRemunerado(calc, prefixos)
    receita += receitaMes
    temDado = true
  }
  return temDado ? { gastos, remunerado, receita } : null
}

/** Separador entre a abertura de cada conta-mãe — título grande em caixa alta, centralizado, com uma linha de cada lado e espaçamento generoso (padding vertical próprio, além do gap-5 padrão entre seções). */
export function Separador({ titulo }: { titulo: string }) {
  return (
    <div className="flex items-center gap-4 pt-20 pb-4">
      <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
      <p className="text-2xl font-black uppercase tracking-wide text-gray-700 dark:text-slate-200">{titulo}</p>
      <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
    </div>
  )
}

export interface BlocoPacoteProps {
  /** Chave pro Orçamento (Farol) — só é de fato usada quando `fonteMeta` é 'orcamento' (default). Pode ser um id sintético (ex: "036-161") quando `fonteMeta='remunerado'`, já que nesse modo nada busca `PACOTES[codigo]`/`buscarMetaOrcamento` por ele — serve só pro `gradientId` do gráfico. */
  codigo: string
  titulo: string
  prefixos: string | string[]
  natureza: Natureza
  /**
   * De onde vem a "Meta" dos cards/gráfico/tabela. 'orcamento' (default) usa
   * `buscarMetaOrcamento` — pra pacotes de verdade, com meta cadastrada no
   * Orçamento (114, 116, 118, 132, 159...). 'remunerado' usa o REMUNERADO
   * (referência do próprio GInfo) dividido pela receita do período — pra
   * combinações ad-hoc de contas-filha sem meta cadastrada nesse nível (ex:
   * Salários = 036+161), mesma convenção já usada nas tabelas de abertura por
   * conta filha e no `AcompanhamentoConta`.
   */
  fonteMeta?: 'orcamento' | 'remunerado'
  /**
   * Fonte da tabela mensal (Meta/Remunerado × Realizado × Gap), quando
   * diferente de `fonteMeta` — ex: Gastos com Benefícios tem meta % de
   * Orçamento (cards/gráfico usam `fonteMeta: 'orcamento'`), mas a tabela
   * mensal continua mostrando Remunerado × Realizado por pedido do usuário.
   * Default: mesmo valor de `fonteMeta`.
   */
  tabelaFonte?: 'orcamento' | 'remunerado'
  rowsUnidadeCons: DreLongoRow[]
  orcamentoAno: OrcamentoLinha[]
  unidade: string
  negocio: string
  ano: number
  mes: number
  /** % que essa conta-mãe representa no pacote de topo (ex: Pacote de Frota/Pacote de Gente) — mês selecionado e acumulado do ano. Só as aberturas passam isso, o bloco do pacote-mãe em si não (não faz sentido "% de si mesmo"). */
  percentualDoPacoteMes?: number | null
  percentualDoPacoteAno?: number | null
  /** Título do 3º card, exibido só quando `percentualDoPacoteAno` é informado (ex: "Impacto % no Pacote de Frota"). */
  tituloImpactoPacote?: string
  /** Mostra a Curva de Captura (sempre visível, sem toggle) em cima do gráfico de Acompanhamento Mensal — só o bloco do pacote-mãe (114/159) usa, não as aberturas por conta-mãe filha (Combustível, Salários etc. não têm meta de Orçamento própria nesse nível). Default false. */
  mostrarToggleCurvaCaptura?: boolean
}

/**
 * Bloco reutilizável de indicador de pacote — 2 cards (% Mensal e % YTD,
 * realizado x meta + gap à esquerda, gap em R$ à direita), gráfico de linhas
 * suavizadas (Realizado x Meta, `IndicadorChart`), comparativo Gastos/Receita
 * % acumulado (ano anterior × ano atual) e a tabela mensal Meta/Realizado/
 * Gap com os meses em coluna (Acumulado na última). Reutilizado tanto pelo
 * Pacote de Frota (114 + aberturas Combustível/Manutenção/Pneus) quanto pelo
 * Pacote de Gente (159 + abertura Salários) — por isso `prefixos`/`natureza`
 * vêm explícitos por prop em vez de um lookup interno em `PACOTES[codigo]`.
 * Natureza 'custo': menor % é melhor — todo o sinal de cor/gap já vem correto
 * de `calcularSemaforo`/`calcularImpactoFinanceiro`, que são agnósticos à
 * natureza; só o comparativo YoY (montado na mão) precisa inverter a leitura
 * de "melhorou".
 */
export function BlocoPacote({
  codigo, titulo, prefixos, natureza, fonteMeta = 'orcamento', tabelaFonte, rowsUnidadeCons, orcamentoAno, unidade, negocio, ano, mes,
  percentualDoPacoteMes, percentualDoPacoteAno, tituloImpactoPacote, mostrarToggleCurvaCaptura = false,
}: BlocoPacoteProps) {
  const fonteTabela = tabelaFonte ?? fonteMeta
  const { cursor } = getChartColors()
  const ctx = { unidade, negocio, ano, codigo }

  const rowsAno = useMemo(() => rowsUnidadeCons.filter(r => r.ano === ano), [rowsUnidadeCons, ano])

  const calcMes = useMemo(
    () => normalizarParaCalculo(rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === mes)),
    [rowsAno, mes],
  )
  const mensalAvr = useMemo(() => avrPorPrefixo(calcMes, prefixos), [calcMes, prefixos])
  const mensalMeta = useMemo(() => {
    if (fonteMeta === 'remunerado') {
      const receita = calcularReceita(calcMes)
      return receita === 0 ? null : (somaRemunerado(calcMes, prefixos) / receita) * 100
    }
    return buscarMetaOrcamento(orcamentoAno, { ...ctx, mes })
  }, [calcMes, fonteMeta, prefixos, orcamentoAno, unidade, negocio, ano, codigo, mes])
  const mensalSemaforo = calcularSemaforo(mensalAvr, mensalMeta, natureza)

  const acumuladoAtual = useMemo(() => acumulados(rowsUnidadeCons, ano, mes, prefixos), [rowsUnidadeCons, ano, mes, prefixos])
  const acumuladoAnterior = useMemo(() => acumulados(rowsUnidadeCons, ano - 1, mes, prefixos), [rowsUnidadeCons, ano, mes, prefixos])
  const ytdAvrAtual = acumuladoAtual && acumuladoAtual.receita !== 0 ? (acumuladoAtual.gastos / acumuladoAtual.receita) * 100 : null
  const ytdAvrAnterior = acumuladoAnterior && acumuladoAnterior.receita !== 0 ? (acumuladoAnterior.gastos / acumuladoAnterior.receita) * 100 : null
  const ytdMeta = fonteMeta === 'remunerado'
    ? (acumuladoAtual && acumuladoAtual.receita !== 0 ? (acumuladoAtual.remunerado / acumuladoAtual.receita) * 100 : null)
    : buscarMetaOrcamento(orcamentoAno, { ...ctx, mes: 0 })
  const ytdSemaforo = ytdAvrAtual !== null ? calcularSemaforo(ytdAvrAtual, ytdMeta, natureza) : null

  const serieAnual = useMemo(() => {
    const base = calcularSerieAnual(rowsAno, [], { ...ctx, prefixos })
    return base.map(ponto => {
      if (fonteMeta === 'remunerado') {
        const rowsMes = rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === ponto.mes)
        const calc = rowsMes.length > 0 ? normalizarParaCalculo(rowsMes) : null
        const receitaMes = calc ? calcularReceita(calc) : null
        const meta = calc && receitaMes ? (somaRemunerado(calc, prefixos) / receitaMes) * 100 : null
        return { ...ponto, meta }
      }
      return { ...ponto, meta: buscarMetaOrcamento(orcamentoAno, { ...ctx, mes: ponto.mes }) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsAno, orcamentoAno, unidade, negocio, ano, codigo, prefixos, fonteMeta])

  // Curva de Captura (ritmo necessário) — só calculada quando `mostrarToggleCurvaCaptura`
  // está ligado pra esse bloco (pacote-mãe), e só faz sentido com meta vinda do
  // Orçamento (as aberturas com fonteMeta='remunerado' não têm meta de
  // Orçamento cadastrada nesse nível, então nem mostram a curva).
  const serieCaptura = useMemo(() => {
    if (!mostrarToggleCurvaCaptura) return []
    const metaAnual = buscarMetaOrcamento(orcamentoAno, { ...ctx, mes: 0 })
    return calcularSerieCaptura(rowsAno, [], orcamentoAno, { ...ctx, prefixos, natureza }, metaAnual)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsAno, orcamentoAno, unidade, negocio, ano, codigo, prefixos, mostrarToggleCurvaCaptura])

  const melhorou = ytdAvrAtual !== null && ytdAvrAnterior !== null && ytdAvrAtual <= ytdAvrAnterior
  const diferencaPP = ytdAvrAtual !== null && ytdAvrAnterior !== null ? ytdAvrAtual - ytdAvrAnterior : null
  // 3ª barra — mesmo `ytdMeta` já usado nos cards acima (Orçado quando
  // `fonteMeta='orcamento'`, Remunerado quando `fonteMeta='remunerado'` — sem
  // Orçamento cadastrado nesse nível, ex: Salários/Gastos com Benefícios): o
  // rótulo acompanha a mesma fonte, pra nunca chamar de "Orçado" um valor que
  // na verdade é Remunerado.
  const melhorouVsMeta = ytdAvrAtual !== null && ytdMeta !== null && ytdAvrAtual <= ytdMeta
  const diferencaPPMeta = ytdAvrAtual !== null && ytdMeta !== null ? ytdAvrAtual - ytdMeta : null
  const rotuloBarraMeta = fonteMeta === 'remunerado' ? 'Remunerado' : 'Orçado'

  // Ano atual fica no MEIO (referência); ano anterior à esquerda e
  // Orçado/Remunerado à direita, cada um com seu delta (p.p.) embaixo da
  // barra, via `TickComparativoAcumulado` (ver chart-shared.tsx).
  const barrasComparativo: BarraComparativo[] = [
    {
      rotulo: `${ano - 1}`, valor: ytdAvrAnterior, cor: COR_META,
      delta: diferencaPP === null ? undefined : { linhas: [`${diferencaPP >= 0 ? '+' : ''}${diferencaPP.toFixed(1)} p.p.`], positivo: melhorou },
    },
    { rotulo: `${ano}`, valor: ytdAvrAtual, cor: ytdAvrAtual === null ? COR_META : melhorou ? COR_POSITIVO : COR_NEGATIVO },
    {
      rotulo: rotuloBarraMeta, valor: ytdMeta, cor: COR_META_DESTAQUE,
      delta: diferencaPPMeta === null ? undefined : { linhas: [`${diferencaPPMeta >= 0 ? '+' : ''}${diferencaPPMeta.toFixed(1)} p.p.`], positivo: melhorouVsMeta },
    },
  ]

  function TooltipComparativo({ active, payload }: { active?: boolean; payload?: { value: number | null }[] }) {
    if (!active || !payload?.length || payload[0].value == null) return null
    return (
      <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
        {titulo} / Receita: <span className="font-medium">{formatPercent(payload[0].value, 2)}</span>
      </div>
    )
  }

  // Meta em R$ NÃO é o `orcado` bruto da planilha (esse reflete a receita
  // ORÇADA, não a realizada) — é o % meta multiplicado pela receita
  // REALIZADA do próprio mês. Realizado em R$ vem do mesmo AVR% que o Farol
  // de Metas usa (`avrPorPrefixo`) multiplicado pela mesma receita, e o Gap
  // usa `calcularImpactoFinanceiro` (a MESMA função que o Farol de Metas
  // chama pro card de impacto financeiro) — garante bater com o Farol de
  // Metas. Gap acumulado soma o gap de CADA mês (já natureza-aware), não
  // `acumuladoRealizado - acumuladoMeta` — pra custo essa subtração vem
  // invertida (bom = meta > realizado).
  //
  // Calcula os DOIS meta% por mês (`fonteMeta` pros cards/gráfico,
  // `fonteTabela` pra tabela) na MESMA passada — são independentes desde que
  // um bloco possa usar Orçamento nos cards mas Remunerado na tabela (ex:
  // Salários, Gastos com Benefícios). Usar só uma fonte pros dois faria o
  // "Gap R$" do card divergir do "Meta: X%"/"Gap: Y%" mostrados ao lado dele,
  // que sempre vêm de `fonteMeta` (mensalMeta/ytdMeta acima).
  function metaPercentPorFonte(fonte: 'orcamento' | 'remunerado', calc: DreCalculoRow[] | null, receitaMes: number | null, mesAlvo: number): number | null {
    if (fonte === 'remunerado') {
      return calc && receitaMes ? (somaRemunerado(calc, prefixos) / receitaMes) * 100 : null
    }
    return buscarMetaOrcamento(orcamentoAno, { ...ctx, mes: mesAlvo })
  }

  const serie = useMemo(() => {
    let acumuladoRealizado = 0
    let acumuladoMetaTabela = 0
    let acumuladoGapTabela = 0
    let acumuladoGapCard = 0
    return MESES_12.map(m => {
      const rowsMes = rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === m)
      const calc = rowsMes.length > 0 ? normalizarParaCalculo(rowsMes) : null
      const receitaMes = calc ? calcularReceita(calc) : null
      const avr = calc ? avrPorPrefixo(calc, prefixos) : null
      const realizado = avr !== null && receitaMes !== null ? (avr / 100) * receitaMes : null
      if (realizado !== null) acumuladoRealizado += realizado

      const metaPercentTabela = metaPercentPorFonte(fonteTabela, calc, receitaMes, m)
      const meta = metaPercentTabela !== null && receitaMes !== null ? (metaPercentTabela / 100) * receitaMes : null
      if (meta !== null) acumuladoMetaTabela += meta
      const gap = avr !== null && metaPercentTabela !== null && receitaMes !== null
        ? calcularImpactoFinanceiro(avr, metaPercentTabela, receitaMes, natureza)
        : null
      if (gap !== null) acumuladoGapTabela += gap

      const gapCard = fonteTabela === fonteMeta ? gap : (() => {
        const metaPercentCard = metaPercentPorFonte(fonteMeta, calc, receitaMes, m)
        return avr !== null && metaPercentCard !== null && receitaMes !== null
          ? calcularImpactoFinanceiro(avr, metaPercentCard, receitaMes, natureza)
          : null
      })()
      if (gapCard !== null) acumuladoGapCard += gapCard

      return {
        mes: m, realizado, meta, gap,
        acumuladoRealizado: realizado !== null ? acumuladoRealizado : null,
        acumuladoMeta: meta !== null ? acumuladoMetaTabela : null,
        acumuladoGap: gap !== null ? acumuladoGapTabela : null,
        gapCard,
        acumuladoGapCard: gapCard !== null ? acumuladoGapCard : null,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsAno, orcamentoAno, unidade, negocio, ano, codigo, prefixos, natureza, fonteTabela, fonteMeta])

  const linhaMesSel = serie[mes - 1]
  const mensalGapRs = linhaMesSel.gapCard
  const acumuladoRealizadoMes = linhaMesSel.acumuladoRealizado
  const acumuladoMetaMes = linhaMesSel.acumuladoMeta
  const ytdGapRs = linhaMesSel.acumuladoGapCard
  const ytdGapRsTabela = linhaMesSel.acumuladoGap
  const rotuloMeta = fonteMeta === 'remunerado' ? 'Remunerado' : 'Meta'
  const rotuloMetaTabela = fonteTabela === 'remunerado' ? 'Remunerado' : 'Meta'

  return (
    <>
      {/* Cards do mês selecionado — % à esquerda, gap em R$ à direita. Uma 3ª
          coluna (Impacto % no pacote-mãe) entra só nas aberturas — o bloco do
          próprio pacote de topo não recebe `percentualDoPacoteMes`/`Ano`. */}
      <div className={cn('grid grid-cols-1 gap-5', percentualDoPacoteAno != null ? 'lg:grid-cols-3' : 'sm:grid-cols-2')}>
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              {titulo} % — Mensal — {MES_ABREV[mes]}/{ano}
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{formatPercent(mensalAvr, 2)}</p>
            <p className={cn('mt-1 text-sm font-semibold', corSemaforo(mensalSemaforo.corClasse))}>
              {rotuloMeta}: {mensalMeta === null ? '—' : formatPercent(mensalMeta, 2)}
              {' · '}
              Gap: {mensalSemaforo.delta === null ? '—' : formatPercent(mensalSemaforo.delta, 2)}
            </p>
          </div>
          <div className="shrink-0 border-l border-gray-200 pl-4 text-right dark:border-slate-700">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">Gap R$</p>
            <p className={cn('text-xl font-bold', corGapRs(mensalGapRs))}>
              {mensalGapRs === null ? '—' : formatCurrencyInteiro(mensalGapRs)}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              {titulo} % — Ano
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{formatPercent(ytdAvrAtual, 2)}</p>
            <p className={cn('mt-1 text-sm font-semibold', corSemaforo(ytdSemaforo?.corClasse ?? 'semCor'))}>
              {rotuloMeta}: {ytdMeta === null ? '—' : formatPercent(ytdMeta, 2)}
              {' · '}
              Gap: {ytdSemaforo?.delta == null ? '—' : formatPercent(ytdSemaforo.delta, 2)}
            </p>
          </div>
          <div className="shrink-0 border-l border-gray-200 pl-4 text-right dark:border-slate-700">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">Gap R$</p>
            <p className={cn('text-xl font-bold', corGapRs(ytdGapRs))}>
              {ytdGapRs === null ? '—' : formatCurrencyInteiro(ytdGapRs)}
            </p>
          </div>
        </div>
        {percentualDoPacoteAno != null && (
          <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              {tituloImpactoPacote}
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
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        {/* Gráfico principal — linhas suavizadas, AVR mensal x Meta */}
        <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5 lg:col-span-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            {titulo} % — Acompanhamento Mensal — {ano}
          </p>
          <IndicadorChart
            serie={serieAnual}
            gradientId={`sdg-gerentes-${codigo}`}
            natureza={natureza}
            nomeSerie="Realizado"
            serieCaptura={serieCaptura}
            mostrarCurvaCaptura={mostrarToggleCurvaCaptura}
          />
        </div>

        {/* Comparativo Gastos/Receita (%) — ano anterior × ano atual, até o mês selecionado */}
        <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Gastos/Receita Acumulado até {MES_ABREV[mes]}
          </p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barrasComparativo} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="rotulo" tickLine={false} axisLine={false} height={44} tick={<TickComparativoAcumulado barras={barrasComparativo} />} />
                <YAxis hide domain={domainComparativo(barrasComparativo.map(b => b.valor))} />
                <Tooltip content={<TooltipComparativo />} cursor={{ fill: cursor }} />
                <Bar dataKey="valor" name="Gastos/Receita" radius={[4, 4, 0, 0]} barSize={36}>
                  {barrasComparativo.map(b => (
                    <Cell key={b.rotulo} fill={b.valor === null ? COR_META : b.cor} />
                  ))}
                  <LabelList
                    dataKey="valor"
                    position="top"
                    formatter={(v: unknown) => typeof v === 'number' ? formatPercent(v, 2) : '—'}
                    style={{ fontSize: 13, fontWeight: 700 }}
                    className="fill-gray-600 dark:fill-slate-300"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Meses em coluna (não em linha) — deixa espaço pra ir empilhando mais
          métricas/análises sem a tabela crescer pra baixo indefinidamente.
          Acumulado sempre na última coluna. Meses depois do selecionado
          mostram "—" (sem dado realizado ainda), mesmo padrão de corte que o
          resto do deck já usa (nunca mostra orçado/meta de mês futuro como
          se fosse informação pronta). */}
      <TableCard titulo={`${titulo} por mês`} subtitulo={`${fonteTabela === 'remunerado' ? 'Remunerado' : 'Meta (% orçado × receita realizada)'} vs Realizado — gap · Acumulado soma Jan até o mês selecionado`}>
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
            <TableRow className="border-gray-200/30 dark:border-gray-700/30">
              <TableCell className="text-sm font-medium">{rotuloMetaTabela}</TableCell>
              {serie.map(p => (
                <TableCell key={p.mes} className="text-center text-sm tabular-nums">
                  {p.mes > mes || p.meta === null ? '—' : formatInteiroPtBr(p.meta)}
                </TableCell>
              ))}
              <TableCell className="text-center text-sm font-semibold tabular-nums">
                {acumuladoMetaMes === null ? '—' : formatInteiroPtBr(acumuladoMetaMes)}
              </TableCell>
            </TableRow>
            <TableRow className="border-gray-200/30 dark:border-gray-700/30">
              <TableCell className="text-sm font-medium">Realizado</TableCell>
              {serie.map(p => (
                <TableCell key={p.mes} className="text-center text-sm tabular-nums">
                  {p.mes > mes || p.realizado === null ? '—' : formatInteiroPtBr(p.realizado)}
                </TableCell>
              ))}
              <TableCell className="text-center text-sm font-semibold tabular-nums">
                {acumuladoRealizadoMes === null ? '—' : formatInteiroPtBr(acumuladoRealizadoMes)}
              </TableCell>
            </TableRow>
            <TableRow className="border-gray-200/30 bg-muted/40 dark:border-gray-700/30">
              <TableCell className="text-sm font-semibold">Gap</TableCell>
              {serie.map(p => (
                <TableCell key={p.mes} className={cn('text-center text-sm font-semibold tabular-nums', p.mes > mes ? 'text-muted-foreground' : corGapRs(p.gap))}>
                  {p.mes > mes || p.gap === null ? '—' : formatInteiroPtBr(p.gap)}
                </TableCell>
              ))}
              <TableCell className={cn('text-center text-sm font-bold tabular-nums', corGapRs(ytdGapRsTabela))}>
                {ytdGapRsTabela === null ? '—' : formatInteiroPtBr(ytdGapRsTabela)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableCard>
    </>
  )
}

export interface TabelaAberturaContaProps {
  titulo: string
  /** Lista simples de códigos — uma linha por `conta_codigo`, nome vindo de `nomesConta`. Ignorado quando `grupos` é informado. */
  codigos?: readonly number[]
  /** Alternativa a `codigos`: uma linha por grupo (rótulo próprio + 1 ou mais códigos somados) — usado quando o mesmo item de negócio tem código diferente em duas árvores do DRE que precisam ser consolidadas (ex: Vale Refeição = 057 operacional + 173 administrativo). */
  grupos?: readonly GrupoAberturaConta[]
  /** Texto curto pro subtítulo (ex: "119-131") — opcional, algumas listas não são uma faixa legível o suficiente pra valer a pena mostrar. */
  descricaoContas?: string
  /** Linhas normalizadas só do mês selecionado. */
  calcMes: DreCalculoRow[]
  /** Linhas normalizadas acumuladas Jan até o mês selecionado. */
  calcAno: DreCalculoRow[]
  /**
   * Realizado do pacote de topo inteiro — denominador do "% do pacote" na
   * tabela, pra sempre ler como "quanto essa conta pesa no total do pacote",
   * nunca só na conta-mãe imediata — um valor pro mês, outro pro acumulado.
   * Opcional: sem ele, a tabela cai pra somar as próprias contas listadas
   * como base ("% do total desse grupo").
   */
  realizadoMaeMes?: number
  realizadoMaeAno?: number
  /** Rótulo da coluna de %, ex: "% da Frota"/"% da Gente" — default genérico "% do Total". */
  rotuloPercentual?: string
  /** Contorna a linha inteira de amarelo pra dar destaque — compara contra `l.codigo` (o código, em modo `codigos`; o rótulo do grupo, em modo `grupos`). */
  linhasDestaque?: readonly string[]
  /** Quantas linhas mostrar antes de precisar rolar (cabeçalho fica fixo) — pra listas longas (ex: Despesa Administrativa, 26-36 contas) não esticarem o slide. Sem isso, mostra tudo sem limite de altura (comportamento de antes). */
  maxLinhasVisiveis?: number
  nomesConta: Map<string, string>
  mes: number
  ano: number
  unidade: string
  negocio: string
  /** Orçamento da unidade/ano selecionado (qualquer negócio — a busca por conta-filha já filtra) — usado pra achar o Orçado de cada conta-filha (ver `buscarOrcadoContaFilha`). */
  orcamentoAno: OrcamentoLinha[]
  /** Opcional — quando informado, cada linha vira clicável (cursor-pointer + destaque no hover), chamando com `l.codigo` (o código, em modo `codigos`; o rótulo do grupo, em modo `grupos`). Sem efeito nos chamadores que não passam isso (comportamento de antes). */
  onClickLinha?: (codigoOuRotulo: string) => void
}

/**
 * Tabela de abertura por conta filha — Realizado (com barrinha horizontal
 * proporcional à maior conta), % do pacote (sobre o realizado do pacote de
 * topo inteiro, ver `realizadoMaeMes`/`realizadoMaeAno`), Orçado/Remunerado
 * (toggle — ver `buscarOrcadoContaFilha`, conta sem orçado cadastrado
 * mostra 0, não "—") e Delta. Pareto (%-acumulado) não fazia sentido pra
 * uma análise de custo, mais pra volume/quantidade — troquei por essa
 * tabela ordenável (maior custo primeiro por padrão, seta ao lado de
 * "Realizado" pra inverter). Mensal por padrão, com um toggle pro YTD
 * (acumulado Jan até o mês selecionado).
 */
type ColunaAberturaConta = 'realizado' | 'percentualDoCusto' | 'orcado' | 'remunerado' | 'delta'

export function TabelaAberturaConta({
  titulo, codigos, grupos, descricaoContas, calcMes, calcAno, realizadoMaeMes, realizadoMaeAno, rotuloPercentual = '% do Total',
  linhasDestaque, maxLinhasVisiveis, nomesConta, mes, ano, unidade, negocio, orcamentoAno, onClickLinha,
}: TabelaAberturaContaProps) {
  const [periodo, setPeriodo] = useState<'mensal' | 'ytd'>('mensal')
  const [comparativo, setComparativo] = useState<'orcado' | 'remunerado'>('orcado')
  const [colunaOrdenada, setColunaOrdenada] = useState<ColunaAberturaConta>('realizado')
  const [ordemAsc, setOrdemAsc] = useState(false)
  const calc = periodo === 'mensal' ? calcMes : calcAno
  const realizadoMaeExplicito = periodo === 'mensal' ? realizadoMaeMes : realizadoMaeAno

  // Clicar na mesma coluna alterna asc/desc; clicar numa coluna diferente
  // troca o critério e volta pro padrão "maior primeiro" (mesmo default de
  // antes, quando só existia a coluna Realizado).
  function alternarOrdenacao(coluna: ColunaAberturaConta) {
    if (coluna === colunaOrdenada) setOrdemAsc(v => !v)
    else { setColunaOrdenada(coluna); setOrdemAsc(false) }
  }

  // Troca o toggle Orçado/Remunerado e, se a ordenação atual era por uma
  // dessas duas colunas, segue junto pra coluna nova — senão o usuário
  // ficaria "ordenando por uma coluna escondida" sem perceber.
  function alternarComparativo(novo: 'orcado' | 'remunerado') {
    setComparativo(novo)
    setColunaOrdenada(atual => (atual === 'orcado' || atual === 'remunerado') ? novo : atual)
  }

  const codigosNecessarios = useMemo(
    () => grupos ? grupos.flatMap(g => g.codigos) : (codigos ?? []),
    [grupos, codigos],
  )

  // Orçado de cada conta-filha — mensal busca só o mês selecionado, YTD soma
  // Jan até o mês selecionado (mesma régua do `calc` mensal/acumulado acima).
  const orcadoPorConta = useMemo(() => {
    const mapa = new Map<string, number>()
    const mesesParaSomar = periodo === 'mensal' ? [mes] : Array.from({ length: mes }, (_, i) => i + 1)
    for (const codigoNum of codigosNecessarios) {
      const codigoStr = String(codigoNum).padStart(3, '0')
      let soma = 0
      for (const m of mesesParaSomar) {
        soma += buscarOrcadoContaFilha(orcamentoAno, { unidade, negocio, ano, mes: m }, codigoStr) ?? 0
      }
      mapa.set(codigoStr, soma)
    }
    return mapa
  }, [orcamentoAno, unidade, negocio, ano, mes, periodo, codigosNecessarios])

  const brutas = useMemo(
    () => grupos ? agruparContasBrutasPorGrupo(calc, grupos, orcadoPorConta) : agruparContasBrutas(calc, codigos ?? [], orcadoPorConta),
    [calc, codigos, grupos, orcadoPorConta],
  )
  const totalDoGrupo = useMemo(() => brutas.reduce((acc, c) => acc + c.realizado, 0), [brutas])
  const realizadoMae = realizadoMaeExplicito ?? totalDoGrupo

  const linhas = useMemo(() => {
    const base = comPercentualEDelta(brutas, realizadoMae, comparativo)
    return [...base].sort((a, b) => ordemAsc ? a[colunaOrdenada] - b[colunaOrdenada] : b[colunaOrdenada] - a[colunaOrdenada])
  }, [brutas, realizadoMae, ordemAsc, colunaOrdenada, comparativo])
  const maiorRealizado = useMemo(() => Math.max(0, ...linhas.map(l => l.realizado)), [linhas])

  const rotuloComparativo = comparativo === 'orcado' ? 'Orçado' : 'Remunerado'

  return (
    <TableCard
      titulo={titulo}
      subtitulo={`Realizado × ${rotuloComparativo} por conta filha${descricaoContas ? ` (${descricaoContas})` : ''} — ${periodo === 'mensal' ? `M${mes}` : 'YTD — acumulado do ano'}`}
      acoes={
        <div className="flex items-center gap-2">
          <PillToggle
            variant="navy"
            opcoes={[{ value: 'orcado', label: 'Orçado' }, { value: 'remunerado', label: 'Remunerado' }] as const}
            value={comparativo}
            onChange={alternarComparativo}
          />
          <PillToggle
            variant="navy"
            opcoes={[{ value: 'mensal', label: `M${mes}` }, { value: 'ytd', label: 'YTD' }] as const}
            value={periodo}
            onChange={setPeriodo}
          />
        </div>
      }
    >
      <div
        className={maxLinhasVisiveis ? 'overflow-y-auto' : undefined}
        style={maxLinhasVisiveis ? { maxHeight: `${36 + maxLinhasVisiveis * 48}px` } : undefined}
      >
      <Table>
        <TableHeader className={maxLinhasVisiveis ? 'sticky top-0 z-10' : undefined}>
          <TableRow>
            <TableHead>Conta</TableHead>
            <TableHead className="text-center">
              <button type="button" onClick={() => alternarOrdenacao('percentualDoCusto')} className="inline-flex items-center gap-1 hover:opacity-80">
                {rotuloPercentual}
                <ArrowUpDown className={cn('h-3 w-3', colunaOrdenada === 'percentualDoCusto' ? 'opacity-100' : 'opacity-50')} />
              </button>
            </TableHead>
            <TableHead className="text-center">
              <button type="button" onClick={() => alternarOrdenacao('realizado')} className="inline-flex items-center gap-1 hover:opacity-80">
                Realizado
                <ArrowUpDown className={cn('h-3 w-3', colunaOrdenada === 'realizado' ? 'opacity-100' : 'opacity-50')} />
              </button>
            </TableHead>
            <TableHead className="text-center">
              <button type="button" onClick={() => alternarOrdenacao(comparativo)} className="inline-flex items-center gap-1 hover:opacity-80">
                {rotuloComparativo}
                <ArrowUpDown className={cn('h-3 w-3', colunaOrdenada === comparativo ? 'opacity-100' : 'opacity-50')} />
              </button>
            </TableHead>
            <TableHead className="text-center">
              <button type="button" onClick={() => alternarOrdenacao('delta')} className="inline-flex items-center gap-1 hover:opacity-80">
                Delta
                <ArrowUpDown className={cn('h-3 w-3', colunaOrdenada === 'delta' ? 'opacity-100' : 'opacity-50')} />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map(l => (
            <TableRow
              key={l.codigo}
              onClick={onClickLinha ? () => onClickLinha(l.codigo) : undefined}
              className={cn(
                'border-gray-200/30 dark:border-gray-700/30',
                onClickLinha && 'cursor-pointer hover:bg-muted/40',
                linhasDestaque?.includes(l.codigo) && 'relative z-10 ring-2 ring-inset ring-yellow-400 dark:ring-yellow-400',
              )}
            >
              <TableCell className="text-sm">{nomesConta.get(l.codigo) ?? l.codigo}</TableCell>
              <TableCell className="text-sm tabular-nums">
                <div className="flex flex-col gap-1">
                  <span className="text-center">{formatPercent(l.percentualDoCusto, 1)}</span>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${maiorRealizado === 0 ? 0 : (l.realizado / maiorRealizado) * 100}%` }}
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center text-sm tabular-nums">{formatInteiroPtBr(l.realizado)}</TableCell>
              <TableCell className="text-center text-sm tabular-nums">{formatInteiroPtBr(comparativo === 'orcado' ? l.orcado : l.remunerado)}</TableCell>
              <TableCell className={cn('text-center text-sm font-semibold tabular-nums', corGapRs(l.delta))}>
                {formatInteiroPtBr(l.delta)}
              </TableCell>
            </TableRow>
          ))}
          {linhas.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                Sem contas com movimento nesse período.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>
    </TableCard>
  )
}

export interface AcompanhamentoContaProps {
  /** Todas as linhas MENSAIS do ano selecionado, sem filtro de mês (precisa de Jan até Dez pro gráfico) — diferente de `calcMes`/`calcAno` das outras peças, que já vêm normalizadas e cortadas num período. */
  rowsAno: DreLongoRow[]
  codigos: readonly number[]
  nomesConta: Map<string, string>
  /** Código zero-padded de 3 dígitos (ex: "043"), igual à convenção de `conta_codigo` no banco — o seletor compara por essa string, não pelo número puro. */
  contaPadrao: string
  mes: number
}

/**
 * Acompanhamento mensal de UMA conta por vez, escolhida num seletor — mesma
 * tabela (meses em coluna, Acumulado na última) das outras peças do slide,
 * só que Remunerado × Realizado direto da conta (não tem Meta do Orçamento
 * numa folha — só as contas-mãe registradas em PACOTES/PACOTE_CONTA_ORCAMENTO
 * têm isso; pra conta filha, o REMUNERADO do próprio GInfo já é a referência).
 */
export function AcompanhamentoConta({ rowsAno, codigos, nomesConta, contaPadrao, mes }: AcompanhamentoContaProps) {
  const [conta, setConta] = useState(contaPadrao)

  const serie = useMemo(() => {
    let acumuladoRealizado = 0
    let acumuladoRemunerado = 0
    let acumuladoGap = 0
    return MESES_12.map(m => {
      const rowsMes = rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === m)
      if (rowsMes.length === 0) {
        return { mes: m, realizado: null, remunerado: null, gap: null, acumuladoRealizado: null, acumuladoRemunerado: null, acumuladoGap: null }
      }
      const calc = normalizarParaCalculo(rowsMes)
      const bruta = agruparContasBrutas(calc, [Number(conta)])[0] ?? { realizado: 0, remunerado: 0 }
      const gap = bruta.remunerado - bruta.realizado
      acumuladoRealizado += bruta.realizado
      acumuladoRemunerado += bruta.remunerado
      acumuladoGap += gap
      return {
        mes: m, realizado: bruta.realizado, remunerado: bruta.remunerado, gap,
        acumuladoRealizado, acumuladoRemunerado, acumuladoGap,
      }
    })
  }, [rowsAno, conta])

  const linhaMesSel = serie[mes - 1]

  return (
    <TableCard
      titulo="Acompanhamento Mensal por Conta"
      subtitulo={`Remunerado × Realizado — ${nomesConta.get(conta) ?? conta} · Acumulado soma Jan até o mês selecionado`}
      acoes={
        <Select value={conta} onValueChange={setConta}>
          <SelectTrigger className="h-8 w-56 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {codigos.map(c => {
              const codigo = String(c).padStart(3, '0')
              return <SelectItem key={c} value={codigo}>{nomesConta.get(codigo) ?? codigo}</SelectItem>
            })}
          </SelectContent>
        </Select>
      }
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
            {serie.map(p => (
              <TableCell key={p.mes} className="text-center text-sm tabular-nums">
                {p.mes > mes || p.realizado === null ? '—' : formatInteiroPtBr(p.realizado)}
              </TableCell>
            ))}
            <TableCell className="text-center text-sm font-semibold tabular-nums">
              {linhaMesSel.acumuladoRealizado === null ? '—' : formatInteiroPtBr(linhaMesSel.acumuladoRealizado)}
            </TableCell>
          </TableRow>
          <TableRow className="border-gray-200/30 bg-muted/40 dark:border-gray-700/30">
            <TableCell className="text-sm font-semibold">Gap</TableCell>
            {serie.map(p => (
              <TableCell key={p.mes} className={cn('text-center text-sm font-semibold tabular-nums', p.mes > mes ? 'text-muted-foreground' : corGapRs(p.gap))}>
                {p.mes > mes || p.gap === null ? '—' : formatInteiroPtBr(p.gap)}
              </TableCell>
            ))}
            <TableCell className={cn('text-center text-sm font-bold tabular-nums', corGapRs(linhaMesSel.acumuladoGap))}>
              {linhaMesSel.acumuladoGap === null ? '—' : formatInteiroPtBr(linhaMesSel.acumuladoGap)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableCard>
  )
}
