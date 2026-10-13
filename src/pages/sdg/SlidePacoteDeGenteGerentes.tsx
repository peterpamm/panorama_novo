import { useMemo, useState } from 'react'
import { useContas } from '@/hooks/useContas'
import { normalizarParaCalculo, somaReal } from '@/lib/farol-calculations'
import { PACOTES } from '@/lib/constants'
import { PillToggle } from '@/components/ui/pill-toggle'
import type { DreLongoRow, OrcamentoLinha } from '@/types'
import { BlocoPacote, type GrupoAberturaConta, Separador, TabelaAberturaConta } from './abertura-conta-shared'

/** Um item de conta (par operacional/administrativo, nenhum dos dois obrigatório) pro seletor Consolidado/Operacional/ADM das tabelas de abertura por conta. */
interface ItemContaDupla { rotulo: string; op: number | null; adm: number | null }

/**
 * "Demais Contas" — Salários (036/161), Vales (052-055, sem par ADM — não
 * existe esse pacote no bloco administrativo), Gastos com Benefícios
 * (057-068 operacional + 173-183 administrativo), Gastos Contratação/
 * Demissão (070-073 operacional + 185-187 administrativo) e Segurança
 * (075-079 operacional + 189-190 administrativo) — tudo que NÃO é Encargos,
 * cada item pareado operacional×administrativo quando os dois existem (ver
 * `ItemContaDupla`). "Cursos e Treinamentos" aparece duas vezes com rótulos
 * diferentes — são contas DIFERENTES que só coincidem no nome (073, de
 * Contratação/Demissão, e 181, de Benefícios administrativo).
 */
const ITENS_DEMAIS_CONTAS: ItemContaDupla[] = [
  { rotulo: 'Salários', op: 36, adm: 161 },
  { rotulo: 'Pensão Alimentícia', op: 37, adm: null },
  { rotulo: 'Pró-Labore', op: null, adm: 162 },
  { rotulo: 'Vales Financeiros', op: 52, adm: null },
  { rotulo: 'Vales Físicos', op: 53, adm: null },
  { rotulo: 'Processo Cível', op: 54, adm: null },
  { rotulo: 'Vales Sinistro', op: 55, adm: null },
  { rotulo: 'Vale Refeição', op: 57, adm: 173 },
  { rotulo: 'Vale Transporte', op: 58, adm: 174 },
  { rotulo: 'Plano de Saúde', op: 59, adm: 175 },
  { rotulo: 'Cesta Básica', op: 60, adm: 176 },
  { rotulo: 'Café da Manhã', op: 61, adm: null },
  { rotulo: 'Seguro de Vida', op: 62, adm: 178 },
  { rotulo: 'PLR – Participação nos Resultados', op: 63, adm: 183 },
  { rotulo: 'Plano Odontológico', op: 64, adm: 180 },
  { rotulo: 'Taxas ADM VT/VA', op: 65, adm: null },
  { rotulo: 'Cesta Básica - Cartão', op: 66, adm: null },
  { rotulo: 'Incentivos', op: 67, adm: null },
  { rotulo: 'Outras Despesas Gerais', op: 68, adm: null },
  { rotulo: 'Auxílio Educação', op: null, adm: 177 },
  { rotulo: 'Assistência Médica e Social', op: null, adm: 179 },
  { rotulo: 'Cursos e Treinamentos — Benefícios', op: null, adm: 181 },
  { rotulo: 'Previdência Privada', op: null, adm: 182 },
  { rotulo: 'PCMSO/PPRA', op: 70, adm: 185 },
  { rotulo: 'Exames Médicos', op: 71, adm: 186 },
  { rotulo: 'Despesas Recrutamento e Seleção', op: 72, adm: 187 },
  { rotulo: 'Cursos e Treinamentos — Contratação/Demissão', op: 73, adm: null },
  { rotulo: 'EPI\'s', op: 75, adm: 189 },
  { rotulo: 'Uniformes', op: 76, adm: 190 },
  { rotulo: 'Higienização Uniformes', op: 77, adm: null },
  { rotulo: 'Kit Higiênico', op: 78, adm: null },
  { rotulo: 'Sinistros e Pequenos Acidentes', op: 79, adm: null },
]

/** "Encargos" — 039-050 operacional + 164-171 administrativo, cada item pareado quando os dois existem. */
const ITENS_ENCARGOS: ItemContaDupla[] = [
  { rotulo: 'INSS e Provisões', op: 39, adm: 164 },
  { rotulo: 'FGTS e Provisões', op: 40, adm: 165 },
  { rotulo: 'Férias e Provisões', op: 41, adm: 166 },
  { rotulo: 'Décimo Terceiro Salário e Provisões', op: 42, adm: 167 },
  { rotulo: 'Processos Trabalhistas', op: 43, adm: 168 },
  { rotulo: 'Aviso Prévio', op: 44, adm: 169 },
  { rotulo: 'Contribuição Sindical', op: 45, adm: 170 },
  { rotulo: 'Rescisões Diversas', op: 46, adm: null },
  { rotulo: 'Outras Desp. c/ Pessoal', op: 47, adm: null },
  { rotulo: 'Custos Proc. Trabalhistas', op: 48, adm: null },
  { rotulo: 'FGTS s/ Rescisões', op: 49, adm: 171 },
  { rotulo: 'Ressalva de Rescisões', op: 50, adm: null },
]

type SegmentoOperacionalAdm = 'consolidado' | 'operacional' | 'adm'
const OPCOES_SEGMENTO_OPERACIONAL_ADM = [
  { value: 'consolidado', label: 'Consolidado' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'adm', label: 'ADM' },
] as const

/**
 * Converte `ItemContaDupla[]` pro formato `GrupoAberturaConta[]` que
 * `TabelaAberturaConta` espera, filtrando pro lado escolhido no seletor
 * Consolidado/Operacional/ADM. Um item sem código do lado pedido (ex:
 * "Pró-Labore" no modo Operacional) vira `codigos: []` — a própria tabela já
 * descarta linhas zeradas (`agruparContasBrutasPorGrupo`), então a linha some
 * sozinha em vez de aparecer com tudo "—".
 */
function gruposPorSegmento(itens: ItemContaDupla[], segmento: SegmentoOperacionalAdm): GrupoAberturaConta[] {
  return itens.map(item => ({
    rotulo: item.rotulo,
    codigos: segmento === 'operacional' ? (item.op !== null ? [item.op] : [])
      : segmento === 'adm' ? (item.adm !== null ? [item.adm] : [])
      : [item.op, item.adm].filter((c): c is number => c !== null),
  }))
}

interface Props {
  /** Todas as linhas da unidade selecionada, sem filtro de ano (precisa do ano anterior pro comparativo acumulado do Pacote de Gente/Segurança) — já filtradas pro `negocio` selecionado no cabeçalho. */
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
 * Slide "Pacote de Gente" do SDG Gerentes — pedido do chefe do usuário pra
 * ficar mais OBJETIVO (as análises mais a fundo já têm um lar melhor em
 * Análise Detalhada > Pacote de Gente, inclusive a aba Corporativo). Mantém
 * só 2 seções com cards/gráfico/tabela própria: o indicador geral do pacote
 * (159, via `BlocoPacote`) e "Segurança" (074, também `BlocoPacote` — sem
 * abertura por conta própria, as folhas de Segurança entram na "Análise por
 * Conta" abaixo junto com o resto, pra não duplicar). Tudo mais (Salários,
 * Vales, Gastos com Benefícios, Gastos Contratação/Demissão, Segurança,
 * Encargos) virou a seção "Análise por Conta": DUAS tabelas lado a lado
 * (mesmo layout de `SlideDespesaAdministrativaGerentes.tsx`) — uma só com
 * Encargos, outra com todo o resto — com o seletor Consolidado/Operacional/
 * ADM compartilhado entre as duas (`segmento`). Vales perdeu o bloco próprio
 * (cards/gráfico de Dispersão) — as folhas 052-055 aparecem na tabela de
 * "Demais Contas" como Realizado×Remunerado normal; se o impacto for grande
 * ele já aparece ali, sem precisar do bloco dedicado.
 */
export function SlidePacoteDeGenteGerentes({ rowsUnidadeCons, orcamentoAno, unidade, negocio, ano, mes }: Props) {
  const { contas } = useContas()
  const nomesConta = useMemo(() => new Map(contas.map(c => [c.codigo, c.descricao])), [contas])

  const [segmento, setSegmento] = useState<SegmentoOperacionalAdm>('consolidado')
  const gruposDemaisContas = useMemo(() => gruposPorSegmento(ITENS_DEMAIS_CONTAS, segmento), [segmento])
  const gruposEncargos = useMemo(() => gruposPorSegmento(ITENS_ENCARGOS, segmento), [segmento])

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
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        <BlocoPacote
          codigo="159" titulo="Pacote de Gente" prefixos={PACOTES['159'].prefixos} natureza={PACOTES['159'].natureza}
          rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoAno} unidade={unidade} negocio={negocio} ano={ano} mes={mes}
          mostrarToggleCurvaCaptura
        />

        {/* Segurança (074, mesma conta já registrada como "Pacote Segurança"
            desde a Frota) — TEM meta % cadastrada no Orçamento, então usa o
            `fonteMeta` padrão ('orcamento') tanto nos cards/gráfico quanto na
            tabela mensal (Meta orçada × Realizado), sem override de
            `tabelaFonte`. Sem abertura por conta própria aqui — as folhas
            075-079/189-190 entram na "Análise por Conta" abaixo. */}
        <Separador titulo="SEGURANÇA" />
        <BlocoPacote
          codigo="074" titulo="Gastos com Uniformes e EPI's" prefixos={PACOTES['074'].prefixos} natureza={PACOTES['074'].natureza}
          rowsUnidadeCons={rowsUnidadeCons} orcamentoAno={orcamentoAno}
          unidade={unidade} negocio={negocio} ano={ano} mes={mes}
          percentualDoPacoteMes={percentualSegurancaDoPacoteMes} percentualDoPacoteAno={percentualSegurancaDoPacoteAno}
          tituloImpactoPacote="Impacto % no Pacote de Gente"
        />

        {/* Análise por Conta — Salários, Vales, Gastos com Benefícios, Gastos
            Contratação/Demissão e Segurança numa tabela ("Demais Contas"),
            Encargos na outra, lado a lado. O seletor Consolidado/Operacional/
            ADM vale pras duas ao mesmo tempo. */}
        <Separador titulo="ANÁLISE POR CONTA" />
        <div className="flex justify-end">
          <PillToggle opcoes={OPCOES_SEGMENTO_OPERACIONAL_ADM} value={segmento} onChange={setSegmento} />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <TabelaAberturaConta
            titulo="Abertura por conta — Demais Contas"
            grupos={gruposDemaisContas}
            descricaoContas="Salários, Vales, Benefícios, Contratação/Demissão e Segurança"
            calcMes={calcMesSelecionado}
            calcAno={calcAcumulado}
            realizadoMaeMes={realizadoGenteMaeMes}
            realizadoMaeAno={realizadoGenteMae}
            rotuloPercentual="Peso % no Pacote"
            linhasDestaque={['Incentivos']}
            maxLinhasVisiveis={12}
            nomesConta={nomesConta}
            mes={mes}
          />
          <TabelaAberturaConta
            titulo="Abertura por conta — Encargos"
            grupos={gruposEncargos}
            descricaoContas="039-050 operacional + 164-171 administrativo"
            calcMes={calcMesSelecionado}
            calcAno={calcAcumulado}
            realizadoMaeMes={realizadoGenteMaeMes}
            realizadoMaeAno={realizadoGenteMae}
            rotuloPercentual="Peso % no Pacote"
            linhasDestaque={['Processos Trabalhistas']}
            maxLinhasVisiveis={12}
            nomesConta={nomesConta}
            mes={mes}
          />
        </div>
      </div>
    </div>
  )
}
