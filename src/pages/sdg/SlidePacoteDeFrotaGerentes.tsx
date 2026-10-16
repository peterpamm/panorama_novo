import { useMemo } from 'react'
import { normalizarParaCalculo, somaReal } from '@/lib/farol-calculations'
import { useContas } from '@/hooks/useContas'
import { PACOTES } from '@/lib/constants'
import type { DreLongoRow, OrcamentoLinha } from '@/types'
import { BlocoPacote, Separador, TabelaAberturaConta } from './abertura-conta-shared'

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

/**
 * Combustível (116) + folhas de Manutenção/Pneus/Outros Gastos com Frota
 * numa lista só, pra "Análise por Conta" — 116 entra pela própria conta-mãe
 * (não pelas folhas: sua única folha é 117 Óleo Diesel, que mostraria o
 * mesmo valor de novo, sem informação nova), já que Combustível é custo
 * grande demais pra sumir da apresentação objetiva. Sem par operacional/
 * administrativo aqui (diferente do Pacote de Gente) — Frota não tem esse
 * corte, `PACOTES['116']/['118']/['132']` são todos prefixo único — por isso
 * é `codigos` direto, não `grupos`.
 */
const CONTAS_ANALISE_POR_CONTA = [116, ...CONTAS_MANUTENCAO, ...CONTAS_PNEUS, ...CONTAS_OUTROS_GASTOS_FROTA]

interface Props {
  /** Todas as linhas da unidade selecionada, sem filtro de ano (precisa do ano anterior pro comparativo acumulado) — já filtradas pro `negocio` selecionado (CONS por padrão, ou Rota/Armazém). */
  rowsUnidadeCons: DreLongoRow[]
  /** Orçamento da unidade selecionada, ano atual, mesmo `negocio` selecionado. */
  orcamentoAno: OrcamentoLinha[]
  /** Código da unidade (chave de busca do orçamento) — `buscarMetaOrcamento` filtra por ele, não pelo nome. */
  unidade: string
  /** CONS (padrão) | ROTA | ARM — filtro de negócio escolhido no cabeçalho da apresentação. */
  negocio: string
  ano: number
  mes: number
}

/**
 * Slide "Pacote de Frota" do SDG Gerentes — mesmo escopo que "Pacote de
 * Gente" ficou (pedido do chefe do usuário: apresentação mais objetiva, a
 * análise funda fica em Análise Detalhada > Pacote de Frota, cópia
 * independente com Combustível/Manutenção/Pneus/Outros Gastos com Frota
 * detalhados — ver `PacoteDeFrotaDetalhado.tsx`). Só o indicador geral do
 * pacote (114, via `BlocoPacote`, cards+gráfico+tabela) fica como seção
 * própria; Combustível/Manutenção/Pneus/Outros Gastos com Frota viram UMA
 * tabela só ("Análise por Conta"), sem o seletor Consolidado/Operacional/ADM
 * que o Pacote de Gente tem — Frota não tem esse corte (nenhum dos pacotes
 * tem par administrativo).
 */
export function SlidePacoteDeFrotaGerentes({ rowsUnidadeCons, orcamentoAno, unidade, negocio, ano, mes }: Props) {
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
  const realizadoFrotaMaeMes = useMemo(() => somaReal(calcMesSelecionado, ['114']), [calcMesSelecionado])

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        <BlocoPacote
          codigo="114" titulo="Pacote de Frota" prefixos={PACOTES['114'].prefixos} natureza={PACOTES['114'].natureza}
          rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoAno} unidade={unidade} negocio={negocio} ano={ano} mes={mes}
          mostrarToggleCurvaCaptura
        />

        {/* Combustível + Manutenção + Pneus + Outros Gastos com Frota —
            antes 4 seções com cards/gráfico/tabela próprios, agora só esta
            tabela (mesmo tratamento do Pacote de Gente). */}
        <Separador titulo="ANÁLISE POR CONTA" />
        <TabelaAberturaConta
          titulo="Abertura por conta — Pacote de Frota"
          codigos={CONTAS_ANALISE_POR_CONTA}
          descricaoContas="Combustível, Manutenção, Pneus e Outros Gastos com Frota"
          calcMes={calcMesSelecionado}
          calcAno={calcAcumulado}
          realizadoMaeMes={realizadoFrotaMaeMes}
          realizadoMaeAno={realizadoFrotaMae}
          rotuloPercentual="% da Frota"
          maxLinhasVisiveis={12}
          nomesConta={nomesConta}
          mes={mes}
          ano={ano}
          unidade={unidade}
          negocio={negocio}
          orcamentoAno={orcamentoAno}
        />
      </div>
    </div>
  )
}
