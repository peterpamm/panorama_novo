import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useContas } from '@/hooks/useContas'
import {
  avrPorPrefixo, calcularReceita, normalizarParaCalculo, somaReal,
} from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { calcularParetoContas, calcularParetoUnidades } from '@/lib/pareto-calculations'
import { verificarSomaFilhas, verificarSomaUnidades, verificarPercentualRecalculado } from '@/lib/consistencia-dre'
import { exportarSlideFrotaExcel } from '@/lib/sdg-frota-excel'
import { PACOTES } from '@/lib/constants'
import { ParetoChart } from '@/components/sdg-frota/ParetoChart'
import { ComparativoUnidadesChart } from '@/components/sdg-frota/ComparativoUnidadesChart'
import { ConsistenciaBanner, formatadorPercentualConsistencia, type ChecagemConsistencia } from '@/components/sdg-frota/ConsistenciaBanner'
import { IndicadoresTopo } from '@/components/sdg-frota/IndicadoresTopo'
import { DetalheTabela, type LinhaDetalheFrota } from '@/components/sdg-frota/DetalheTabela'
import { TableCard } from '@/components/ui/table-card'
import { formatCurrencyParenteses, formatPercent } from '@/lib/utils'
import type { TelaFrotaConfig } from './frota-contas'
import type { DreLongoRow, OrcamentoLinha, Unidade } from '@/types'

interface TelaFrotaBaseProps {
  config: TelaFrotaConfig
  /** Só a Tela 1 (Visão Geral) passa isso — abertura em grupos, com peso de cada um. */
  grupos?: readonly { codigo: string; nome: string }[]
  rowsAno: DreLongoRow[]
  orcamentoAno: OrcamentoLinha[]
  unidades: Unidade[]
  negocio: string
  ano: number
  mes: number
  periodo: 'mensal' | 'ytd'
  unidadesSelecionadas: Set<string>
  /** Tela de Pneus pede Pareto por subconta E por unidade — as outras só pela subconta. */
  paretoPorUnidade?: boolean
  /**
   * Toggle Consolidado/Por Unidade da página (default true = mostra tudo).
   * Em Consolidado, esconde o comparativo AVO×AVR e a tabela de detalhe por
   * unidade — sobra só a visão AMBEV (indicadores, grupos, Pareto), que já é
   * sempre AMBEV inteiro independente desse toggle.
   */
  mostrarPorUnidade?: boolean
}

function rowsDoPeriodo(rows: DreLongoRow[], periodo: 'mensal' | 'ytd', mes: number): DreLongoRow[] {
  if (periodo === 'mensal') return rows.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === mes)
  const acumulado = rows.filter(r => r.tipo_periodo === 'ACUMULADO_ANO')
  if (acumulado.length === 0) return []
  const mesMax = Math.max(...acumulado.map(r => r.mes))
  return acumulado.filter(r => r.mes === mesMax)
}

/**
 * Template compartilhado das 4 telas do SDG Corporativo de Frota: banner de
 * consistência → indicadores no topo → (abertura em grupos, só Tela 1) →
 * Pareto de ofensores → comparativo AVO×AVR por unidade → tabela de detalhe
 * → exportar Excel. Cada tela (`SlideVisaoGeralFrota.tsx` etc.) só passa a
 * config de qual conta-mãe/faixa de folhas olhar (`frota-contas.ts`).
 *
 * "Consolidado" é sempre o AMBEV inteiro, mesmo com unidades filtradas — o
 * filtro (`unidadesSelecionadas`) só afeta o comparativo por unidade e a
 * tabela de detalhe (combinado com o usuário). Pareto e as checagens de
 * consistência também sempre olham a empresa inteira, pelo mesmo motivo.
 */
export function TelaFrotaBase({ config, grupos, rowsAno, orcamentoAno, unidades, negocio, ano, mes, periodo, unidadesSelecionadas, paretoPorUnidade, mostrarPorUnidade = true }: TelaFrotaBaseProps) {
  const { contas } = useContas()
  const nomesConta = useMemo(() => new Map(contas.map(c => [c.codigo, c.descricao])), [contas])
  const nomesUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])
  const mesOrcamento = periodo === 'ytd' ? 0 : mes

  const rowsAmbevPeriodo = useMemo(
    () => rowsDoPeriodo(rowsAno.filter(r => r.unidade === 'AMBEV' && r.negocio === negocio), periodo, mes),
    [rowsAno, negocio, periodo, mes],
  )
  const calcAmbev = useMemo(() => normalizarParaCalculo(rowsAmbevPeriodo), [rowsAmbevPeriodo])
  const orcamentoAmbev = useMemo(() => orcamentoAno.filter(o => o.unidade === 'AMBEV'), [orcamentoAno])

  const info = PACOTES[config.codigo]
  const realizadoMae = somaReal(calcAmbev, [config.codigo])
  const avrMae = avrPorPrefixo(calcAmbev, [config.codigo])
  const avoMae = buscarMetaOrcamento(orcamentoAmbev, { unidade: 'AMBEV', negocio, ano, codigo: config.codigo, mes: mesOrcamento })
  const receita = calcularReceita(calcAmbev)

  const gruposComputados = useMemo(() => (grupos ?? []).map(g => ({
    ...g,
    realizado: somaReal(calcAmbev, [g.codigo]),
    avr: avrPorPrefixo(calcAmbev, [g.codigo]),
    avo: buscarMetaOrcamento(orcamentoAmbev, { unidade: 'AMBEV', negocio, ano, codigo: g.codigo, mes: mesOrcamento }),
  })), [grupos, calcAmbev, orcamentoAmbev, negocio, ano, mesOrcamento])

  const pareto = useMemo(
    () => calcularParetoContas(calcAmbev, config.faixaFolhas[0], config.faixaFolhas[1], { excluir: config.excluirDoRanking }),
    [calcAmbev, config.faixaFolhas, config.excluirDoRanking],
  )

  // ── Checagens de consistência (regra 1: filhas vs mãe; regra 2: unidades vs consolidado; regra 3: % recalculado vs arquivo) ──
  const rowsUnidadesIndividuais = useMemo(
    () => unidades.filter(u => u.codigo !== 'AMBEV').map(u => ({
      unidade: u.codigo,
      calc: normalizarParaCalculo(rowsDoPeriodo(rowsAno.filter(r => r.unidade === u.codigo && r.negocio === negocio), periodo, mes)),
    })),
    [unidades, rowsAno, negocio, periodo, mes],
  )
  const paretoUnidades = useMemo(() => {
    if (!paretoPorUnidade) return []
    const mapa = new Map(rowsUnidadesIndividuais.map(u => [u.unidade, somaReal(u.calc, [config.codigo])]))
    return calcularParetoUnidades(mapa)
  }, [paretoPorUnidade, rowsUnidadesIndividuais, config.codigo])

  const checagens: ChecagemConsistencia[] = useMemo(() => {
    const lista: ChecagemConsistencia[] = []
    const valoresFilhas = grupos ? gruposComputados.map(g => g.realizado) : pareto.map(l => l.realizado)
    if (valoresFilhas.length > 0) {
      lista.push({ nome: `Soma das contas filhas vs. ${info?.nome ?? config.codigo}`, resultado: verificarSomaFilhas(realizadoMae, valoresFilhas) })
    }
    const valoresPorUnidade = rowsUnidadesIndividuais.map(u => somaReal(u.calc, [config.codigo]))
    lista.push({ nome: `Soma das unidades vs. Consolidado (${info?.nome ?? config.codigo})`, resultado: verificarSomaUnidades(realizadoMae, valoresPorUnidade) })
    const linhaMae = calcAmbev.find(r => r.conta_codigo === config.codigo)
    if (linhaMae) {
      lista.push({
        nome: `AVR (%) recalculado vs. arquivo (${info?.nome ?? config.codigo})`,
        resultado: verificarPercentualRecalculado(linhaMae.avr, avrMae),
        formatador: formatadorPercentualConsistencia,
      })
    }
    return lista
  }, [grupos, gruposComputados, pareto, realizadoMae, rowsUnidadesIndividuais, config.codigo, info?.nome, calcAmbev, avrMae])

  // ── Detalhe por unidade × conta filha (só as unidades selecionadas no filtro + AMBEV) ──
  const unidadesColunas = useMemo(
    () => Array.from(unidadesSelecionadas).sort((a, b) => (nomesUnidade.get(a) ?? a).localeCompare(nomesUnidade.get(b) ?? b)),
    [unidadesSelecionadas, nomesUnidade],
  )
  const linhasDetalhe: LinhaDetalheFrota[] = useMemo(() => pareto.map(l => ({
    codigo: l.codigo,
    nome: nomesConta.get(l.codigo) ?? l.codigo,
    porUnidade: new Map(
      unidadesColunas.map(u => {
        const dados = rowsUnidadesIndividuais.find(r => r.unidade === u)
        return [u, dados ? somaReal(dados.calc, [l.codigo]) : 0]
      }),
    ),
    consolidado: l.realizado,
  })), [pareto, nomesConta, unidadesColunas, rowsUnidadesIndividuais])

  function handleExportar() {
    exportarSlideFrotaExcel(`sdg_frota_${config.slug}_${ano}_${periodo === 'ytd' ? 'ytd' : `m${mes}`}`, [
      {
        nome: 'Indicadores',
        linhas: [{
          Conta: info?.nome ?? config.titulo,
          'Meta (AVO) %': avoMae ?? '',
          'Realizado (AVR) %': avrMae,
          'Realizado R$': realizadoMae,
          'Divergência p.p.': avoMae === null ? '' : avrMae - avoMae,
        }],
      },
      {
        nome: 'Pareto',
        linhas: pareto.map(l => ({
          Conta: l.codigo, Nome: nomesConta.get(l.codigo) ?? '', 'Realizado R$': l.realizado,
          '% do Total': l.percentualDoTotal, '% Acumulado': l.percentualAcumulado,
        })),
      },
      {
        nome: 'Detalhe por Unidade',
        linhas: linhasDetalhe.map(l => ({
          Conta: l.codigo, Nome: l.nome,
          ...Object.fromEntries(unidadesColunas.map(u => [nomesUnidade.get(u) ?? u, l.porUnidade.get(u) ?? 0])),
          AMBEV: l.consolidado,
        })),
      },
    ])
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <ConsistenciaBanner checagens={checagens} />

      <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            {config.titulo} — AMBEV — {negocio} — {ano}
          </p>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportar}>
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
        <IndicadoresTopo realizado={realizadoMae} receita={receita} avrPct={avrMae} avoPct={avoMae} natureza={info?.natureza ?? 'custo'} />
      </div>

      {grupos && gruposComputados.length > 0 && (
        <TableCard titulo="Abertura por grupo" subtitulo="Peso de cada grupo dentro do total de Frota">
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
            {gruposComputados.map(g => {
              const peso = realizadoMae === 0 ? 0 : (g.realizado / realizadoMae) * 100
              return (
                <div key={g.codigo} className="rounded-xl bg-gray-50 p-4 dark:bg-slate-900/40">
                  <p className="text-sm font-semibold">{g.nome}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{formatCurrencyParenteses(g.realizado)}</p>
                  <p className="text-xs text-muted-foreground">{formatPercent(peso, 1)} do total · AVR {formatPercent(g.avr, 1)} · AVO {g.avo === null ? '—' : formatPercent(g.avo, 1)}</p>
                </div>
              )
            })}
          </div>
        </TableCard>
      )}

      <TableCard titulo="Pareto de ofensores — por conta" subtitulo="Contas que mais concentram o custo — linha amarela é o % acumulado">
        <div className="p-4">
          <ParetoChart linhas={pareto} nomesPorCodigo={nomesConta} />
        </div>
      </TableCard>

      {paretoPorUnidade && (
        <TableCard titulo="Pareto de ofensores — por unidade" subtitulo="Mesma curva, agora somando cada unidade inteira">
          <div className="p-4">
            <ParetoChart linhas={paretoUnidades} nomesPorCodigo={nomesUnidade} />
          </div>
        </TableCard>
      )}

      {mostrarPorUnidade && (
        <>
          <TableCard titulo="Comparativo AVO × AVR por unidade" subtitulo="Ordenado da maior pra menor divergência — quem mais puxa o resultado aparece primeiro">
            <div className="p-4">
              {info && (
                <ComparativoUnidadesChart
                  rowsNegocioAno={rowsAno.filter(r => r.negocio === negocio && r.ano === ano)}
                  orcamentoRows={orcamentoAno}
                  pacote={info}
                  codigo={config.codigo}
                  params={{ negocio, ano, periodo, mes }}
                  nomesUnidade={nomesUnidade}
                />
              )}
            </div>
          </TableCard>

          <DetalheTabela titulo="Detalhe por unidade e conta filha" linhas={linhasDetalhe} unidadesColunas={unidadesColunas} nomesUnidade={nomesUnidade} />
        </>
      )}
    </div>
  )
}
