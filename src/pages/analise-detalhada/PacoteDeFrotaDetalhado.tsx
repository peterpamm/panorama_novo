import { useMemo } from 'react'
import { normalizarParaCalculo, somaReal } from '@/lib/farol-calculations'
import { useContas } from '@/hooks/useContas'
import { PACOTES } from '@/lib/constants'
import type { DreLongoRow, OrcamentoLinha } from '@/types'
import { AcompanhamentoConta, BlocoPacote, Separador, TabelaAberturaConta } from '@/pages/sdg/abertura-conta-shared'

/** Folhas de Manutenção (118) na numeração nova do DRE — ver `sdg-corporativo-frota/frota-contas.ts` (mesma faixa, já conferida linha a linha contra a migration do cutover). */
const CONTAS_MANUTENCAO = Array.from({ length: 131 - 119 + 1 }, (_, i) => 119 + i)
/** Folhas de Pneus (132), mesma numeração/fonte de conferência. */
const CONTAS_PNEUS = Array.from({ length: 135 - 133 + 1 }, (_, i) => 133 + i)
/**
 * "Outros Gastos com Frota" — recorte do usuário, não é um único subtotal
 * oficial do DRE: junta folhas de 3 contas-mãe diferentes (136 Outros
 * Gastos com Frota: 137-139; 140 Custo Fixos: 141-143; 144 Outros Custos
 * Operacionais: 145, 146, 152 — as demais folhas de 144, tipo 147-151/
 * 153-155, ficam de fora de propósito).
 */
const CONTAS_OUTROS_GASTOS_FROTA = [137, 138, 139, 141, 142, 143, 145, 146, 152]

interface Props {
  /** Todas as linhas da unidade selecionada, sem filtro de ano (precisa do ano anterior pro comparativo acumulado) — já filtradas pro `negocio` selecionado no filtro da página. */
  rowsUnidadeCons: DreLongoRow[]
  orcamentoAno: OrcamentoLinha[]
  unidade: string
  negocio: string
  ano: number
  mes: number
}

/**
 * Análise Detalhada > Pacote de Frota — cópia independente do slide "Pacote
 * de Frota" do SDG Gerentes (`SlidePacoteDeFrotaGerentes.tsx`), DE PROPÓSITO
 * duplicada, não reaproveitada: mesmo motivo de `PacoteDeGenteDetalhado.tsx`
 * — o slide da apresentação precisa ficar resumido (e vai ficar, numa
 * próxima rodada, no mesmo escopo que o Pacote de Gente já ficou: indicador
 * geral + uma tabela de análise por conta), enquanto esta página recebe
 * análises extras ao longo do tempo que não fazem sentido na apresentação.
 * Ajustar o slide da apresentação NÃO deve mexer aqui, e vice-versa.
 *
 * Conteúdo igual ao slide por enquanto: o indicador geral do pacote (114,
 * via `BlocoPacote`) seguido da abertura por conta-mãe — Combustível (116,
 * sem tabela de abertura, é uma folha só), Manutenção (118) e Pneus (132) —
 * e por fim Outros Gastos com Frota (recorte sem conta-mãe oficial, só
 * tabela + acompanhamento por conta).
 */
export function PacoteDeFrotaDetalhado({ rowsUnidadeCons, orcamentoAno, unidade, negocio, ano, mes }: Props) {
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
  const realizadoFrotaMae = useMemo(() => somaReal(calcAcumulado, ['114']), [calcAcumulado])
  const realizadoCombustivelMae = useMemo(() => somaReal(calcAcumulado, ['116']), [calcAcumulado])
  const realizadoManutencaoMae = useMemo(() => somaReal(calcAcumulado, ['118']), [calcAcumulado])
  const realizadoPneusMae = useMemo(() => somaReal(calcAcumulado, ['132']), [calcAcumulado])
  const percentualCombustivelDoPacoteAno = realizadoFrotaMae === 0 ? null : (realizadoCombustivelMae / realizadoFrotaMae) * 100
  const percentualManutencaoDoPacoteAno = realizadoFrotaMae === 0 ? null : (realizadoManutencaoMae / realizadoFrotaMae) * 100
  const percentualPneusDoPacoteAno = realizadoFrotaMae === 0 ? null : (realizadoPneusMae / realizadoFrotaMae) * 100

  const realizadoFrotaMaeMes = useMemo(() => somaReal(calcMesSelecionado, ['114']), [calcMesSelecionado])
  const realizadoCombustivelMaeMes = useMemo(() => somaReal(calcMesSelecionado, ['116']), [calcMesSelecionado])
  const realizadoManutencaoMaeMes = useMemo(() => somaReal(calcMesSelecionado, ['118']), [calcMesSelecionado])
  const realizadoPneusMaeMes = useMemo(() => somaReal(calcMesSelecionado, ['132']), [calcMesSelecionado])
  const percentualCombustivelDoPacoteMes = realizadoFrotaMaeMes === 0 ? null : (realizadoCombustivelMaeMes / realizadoFrotaMaeMes) * 100
  const percentualManutencaoDoPacoteMes = realizadoFrotaMaeMes === 0 ? null : (realizadoManutencaoMaeMes / realizadoFrotaMaeMes) * 100
  const percentualPneusDoPacoteMes = realizadoFrotaMaeMes === 0 ? null : (realizadoPneusMaeMes / realizadoFrotaMaeMes) * 100

  return (
    <div className="flex flex-col gap-5">
      <BlocoPacote
        codigo="114" titulo="Pacote de Frota" prefixos={PACOTES['114'].prefixos} natureza={PACOTES['114'].natureza}
        rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoAno} unidade={unidade} negocio={negocio} ano={ano} mes={mes}
        mostrarToggleCurvaCaptura
      />

      {/* Combustível é uma conta só (116, cuja única folha é 117 — Óleo
          Diesel) — sem tabela de abertura por conta filha, não faz sentido
          "abrir" uma conta pra mostrar ela mesma de novo. */}
      <Separador titulo="COMBUSTÍVEL" />
      <BlocoPacote
        codigo="116" titulo="Combustível" prefixos={PACOTES['116'].prefixos} natureza={PACOTES['116'].natureza}
        rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoAno}
        unidade={unidade} negocio={negocio} ano={ano} mes={mes}
        percentualDoPacoteMes={percentualCombustivelDoPacoteMes} percentualDoPacoteAno={percentualCombustivelDoPacoteAno}
        tituloImpactoPacote="Impacto % no Pacote de Frota"
      />

      <Separador titulo="MANUTENÇÃO" />
      <BlocoPacote
        codigo="118" titulo="Manutenção" prefixos={PACOTES['118'].prefixos} natureza={PACOTES['118'].natureza}
        rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoAno}
        unidade={unidade} negocio={negocio} ano={ano} mes={mes}
        percentualDoPacoteMes={percentualManutencaoDoPacoteMes} percentualDoPacoteAno={percentualManutencaoDoPacoteAno}
        tituloImpactoPacote="Impacto % no Pacote de Frota"
      />
      <TabelaAberturaConta
        titulo="Abertura por conta — Manutenção"
        codigos={CONTAS_MANUTENCAO}
        descricaoContas="119-131"
        calcMes={calcMesSelecionado}
        calcAno={calcAcumulado}
        realizadoMaeMes={realizadoFrotaMaeMes}
        realizadoMaeAno={realizadoFrotaMae}
        rotuloPercentual="% da Frota"
        nomesConta={nomesConta}
        mes={mes}
        ano={ano}
        unidade={unidade}
        negocio={negocio}
        orcamentoAno={orcamentoAno}
      />

      <Separador titulo="PNEUS" />
      <BlocoPacote
        codigo="132" titulo="Pneus" prefixos={PACOTES['132'].prefixos} natureza={PACOTES['132'].natureza}
        rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoAno}
        unidade={unidade} negocio={negocio} ano={ano} mes={mes}
        percentualDoPacoteMes={percentualPneusDoPacoteMes} percentualDoPacoteAno={percentualPneusDoPacoteAno}
        tituloImpactoPacote="Impacto % no Pacote de Frota"
      />
      <TabelaAberturaConta
        titulo="Abertura por conta — Pneus"
        codigos={CONTAS_PNEUS}
        descricaoContas="133-135"
        calcMes={calcMesSelecionado}
        calcAno={calcAcumulado}
        realizadoMaeMes={realizadoFrotaMaeMes}
        realizadoMaeAno={realizadoFrotaMae}
        rotuloPercentual="% da Frota"
        nomesConta={nomesConta}
        mes={mes}
        ano={ano}
        unidade={unidade}
        negocio={negocio}
        orcamentoAno={orcamentoAno}
      />

      {/* Sem BlocoPacote aqui — "Outros Gastos com Frota" é um recorte do
          usuário, não uma conta-mãe oficial do DRE (cruza 136/140/144),
          então só faz sentido a tabela de abertura por conta. */}
      <Separador titulo="OUTROS GASTOS COM FROTA" />
      <TabelaAberturaConta
        titulo="Abertura por conta — Outros Gastos com Frota"
        codigos={CONTAS_OUTROS_GASTOS_FROTA}
        calcMes={calcMesSelecionado}
        calcAno={calcAcumulado}
        realizadoMaeMes={realizadoFrotaMaeMes}
        realizadoMaeAno={realizadoFrotaMae}
        rotuloPercentual="% da Frota"
        nomesConta={nomesConta}
        mes={mes}
        ano={ano}
        unidade={unidade}
        negocio={negocio}
        orcamentoAno={orcamentoAno}
      />
      <AcompanhamentoConta
        rowsAno={rowsAno}
        codigos={CONTAS_OUTROS_GASTOS_FROTA}
        nomesConta={nomesConta}
        contaPadrao="152"
        mes={mes}
      />
    </div>
  )
}
