import { useMemo, useState, type ReactNode } from 'react'
import { ArrowUpDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PillToggle } from '@/components/ui/pill-toggle'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { cn, formatCurrencyInteiro, formatInteiroPtBr, formatPercent } from '@/lib/utils'
import { MES_ABREV } from '@/components/farol/chart-shared'
import { normalizarParaCalculo, somaReal, somaRealComSinal } from '@/lib/farol-calculations'
import { buscarOrcadoRs } from '@/lib/orcamento-farol'
import { somaDif } from '@/lib/painel-perdas-calculations'
import { useContas } from '@/hooks/useContas'
import { PACOTES } from '@/lib/constants'
import { corGapRs, type GrupoAberturaConta, MESES_12, Separador, somaRemunerado, TabelaAberturaConta } from '@/pages/sdg/abertura-conta-shared'
import {
  baseDe, calcularComparativoPorUnidade, desvioDe, desvioPercentDe, percentualDeReceita, somarLinhas,
  type ChavePacoteGente, type LinhaComparativoUnidade, type TipoBase,
} from '@/lib/pacote-gente-corporativo'
import type { DreLongoRow, OrcamentoLinha, Unidade } from '@/types'

/** Um item selecionável em `TabelaMensalContaPorUnidade` — `codigoAdm` só existe nos pacotes com par operacional/administrativo (Encargos); Vales não tem par nenhum (`comSegmento` fica false, `codigoAdm` sempre undefined). */
interface ItemContaCorporativo { codigo: string; codigoAdm?: string | null }

/**
 * Itens de Encargos pro seletor de `TabelaMensalContaPorUnidade` — cada item é
 * um PAR (conta operacional + sua equivalente administrativa, quando existe),
 * não duas contas separadas: a maioria tem exatamente a mesma nomenclatura
 * nos dois blocos (ex: "039 INSS E PROVISÕES" / "164 INSS E PROVISÕES"), então
 * listar os 22 códigos lado a lado só duplicaria rótulos iguais no seletor.
 * `codigoAdm` null nos 4 itens que só existem no operacional (046-048, 050).
 * O toggle Consolidado/Operacional/ADM da própria tabela decide qual dos dois
 * códigos do par entra na soma (mesma mecânica de `indiceSegmento`).
 */
const ITENS_ENCARGOS: ItemContaCorporativo[] = [
  { codigo: '038', codigoAdm: '163' },
  { codigo: '039', codigoAdm: '164' },
  { codigo: '040', codigoAdm: '165' },
  { codigo: '041', codigoAdm: '166' },
  { codigo: '042', codigoAdm: '167' },
  { codigo: '043', codigoAdm: '168' },
  { codigo: '044', codigoAdm: '169' },
  { codigo: '045', codigoAdm: '170' },
  { codigo: '046', codigoAdm: null },
  { codigo: '047', codigoAdm: null },
  { codigo: '048', codigoAdm: null },
  { codigo: '049', codigoAdm: '171' },
  { codigo: '050', codigoAdm: null },
]
const CODIGO_ENCARGOS_PADRAO = '043'

/** Itens de Gastos com Vales (051 mãe + 052-055 filhas) — sem par administrativo, não existe esse pacote no bloco ADM. */
const ITENS_GASTOS_COM_VALES: ItemContaCorporativo[] = [
  { codigo: '051' },
  { codigo: '052' },
  { codigo: '053' },
  { codigo: '054' },
  { codigo: '055' },
]
const CODIGO_GASTOS_COM_VALES_PADRAO = '051'

/**
 * Itens de Gastos com Benefícios (056 mãe operacional + 172 mãe adm, folhas
 * 057-068 operacional + 173-180/183 administrativo). 3 folhas administrativas
 * (Auxílio Educação 177, Assistência Médica e Social 179, Previdência
 * Privada 182) não têm par operacional nenhum — ficam de fora desta lista
 * (que sempre precisa de um `codigo` operacional como base do par), mas
 * continuam visíveis na tabela "Abertura por conta — Demais Contas" (AMBEV)
 * logo acima, que não tem essa limitação.
 */
const ITENS_BENEFICIOS: ItemContaCorporativo[] = [
  { codigo: '056', codigoAdm: '172' },
  { codigo: '057', codigoAdm: '173' },
  { codigo: '058', codigoAdm: '174' },
  { codigo: '059', codigoAdm: '175' },
  { codigo: '060', codigoAdm: '176' },
  { codigo: '061', codigoAdm: null },
  { codigo: '062', codigoAdm: '178' },
  { codigo: '063', codigoAdm: '183' },
  { codigo: '064', codigoAdm: '180' },
  { codigo: '065', codigoAdm: null },
  { codigo: '066', codigoAdm: null },
  { codigo: '067', codigoAdm: null },
  { codigo: '068', codigoAdm: null },
]
const CODIGO_BENEFICIOS_PADRAO = '056'

/** Itens de Gastos Contratação/Demissão (069 mãe operacional + 184 mãe adm, folhas 070-073/185-187) — "Cursos e Treinamentos" (073) é a única folha operacional sem par administrativo. */
const ITENS_CONTRATACAO_DEMISSAO: ItemContaCorporativo[] = [
  { codigo: '069', codigoAdm: '184' },
  { codigo: '070', codigoAdm: '185' },
  { codigo: '071', codigoAdm: '186' },
  { codigo: '072', codigoAdm: '187' },
  { codigo: '073', codigoAdm: null },
]
const CODIGO_CONTRATACAO_DEMISSAO_PADRAO = '069'

/**
 * Itens de Segurança (074 mãe operacional + 188 mãe adm, folhas 075-079/189-190)
 * — "Higienização Uniformes" (077), "Kit Higiênico" (078) e "Sinistros e
 * Pequenos Acidentes" (079) só existem no operacional, sem par adm. O card e a
 * tabela "Segurança por unidade" continuam só com 074 (`PACOTES['074']`, sem
 * o 188 — decisão explícita do usuário: não mexer no pacote Segurança por
 * ora), mas o seletor desta tabela oferece 188/189/190 individualmente pra
 * quem quiser inspecionar o lado administrativo mesmo assim.
 */
const ITENS_SEGURANCA: ItemContaCorporativo[] = [
  { codigo: '074', codigoAdm: '188' },
  { codigo: '075', codigoAdm: '189' },
  { codigo: '076', codigoAdm: '190' },
  { codigo: '077', codigoAdm: null },
  { codigo: '078', codigoAdm: null },
  { codigo: '079', codigoAdm: null },
]
const CODIGO_SEGURANCA_PADRAO = '074'

/** Um item de conta (par operacional/administrativo, nenhum dos dois obrigatório) pro seletor Consolidado/Operacional/ADM das 2 tabelas de abertura por conta da AMBEV — mesmas listas de `SlidePacoteDeGenteGerentes.tsx` (SDG Gerentes), duplicadas de propósito (ver convenção "duplicar, não reaproveitar" entre apresentação e Análise Detalhada). */
interface ItemContaDupla { rotulo: string; op: number | null; adm: number | null }

/** "Demais Contas" da AMBEV (consolidado) — mesma lista de `SlidePacoteDeGenteGerentes.tsx`: tudo que NÃO é Encargos (Salários, Vales, Benefícios, Contratação/Demissão, Segurança). */
const ITENS_DEMAIS_CONTAS_ABERTURA: ItemContaDupla[] = [
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

/** "Encargos" da AMBEV (consolidado) — mesma lista de `SlidePacoteDeGenteGerentes.tsx`: 039-050 operacional + 164-171 administrativo. */
const ITENS_ENCARGOS_ABERTURA: ItemContaDupla[] = [
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

/** Converte `ItemContaDupla[]` pro formato `GrupoAberturaConta[]` que `TabelaAberturaConta` espera, filtrando pro lado escolhido no seletor Consolidado/Operacional/ADM — mesma função de `SlidePacoteDeGenteGerentes.tsx`. */
function gruposAberturaPorSegmento(itens: ItemContaDupla[], segmento: SegmentoOperacionalAdm): GrupoAberturaConta[] {
  return itens.map(item => ({
    rotulo: item.rotulo,
    codigos: segmento === 'operacional' ? (item.op !== null ? [item.op] : [])
      : segmento === 'adm' ? (item.adm !== null ? [item.adm] : [])
      : [item.op, item.adm].filter((c): c is number => c !== null),
  }))
}

const OPCOES_BASE = [
  { value: 'orcado', label: 'Orçado' },
  { value: 'remunerado', label: 'Remunerado' },
] as const

/**
 * Coluna clicável das tabelas "unidade × mês" (`TabelaMensalDesvioPorUnidade`/
 * `TabelaMensalContaPorUnidade`) — um mês específico (1-12) ou o Acumulado.
 * Mesmo padrão `alternarOrdenacao`/`ArrowUpDown` de `TabelaComparativoUnidades`/
 * `TabelaAberturaConta`, só que aqui QUALQUER coluna (inclusive um mês do
 * meio do ano) pode ordenar as unidades, não só Desvio R$/%.
 */
type ColunaMensal = number | 'acumulado'

function valorColunaMensal(linha: { porMes: (number | null)[]; acumulado: number | null }, coluna: ColunaMensal): number | null {
  return coluna === 'acumulado' ? linha.acumulado : linha.porMes[coluna - 1]
}

/** Maior primeiro por padrão (clicar de novo na mesma coluna inverte) — nulls sempre no fim, não importa a direção. */
function ordenarPorColunaMensal<T extends { porMes: (number | null)[]; acumulado: number | null }>(
  linhas: T[], coluna: ColunaMensal, ordemAsc: boolean,
): T[] {
  return [...linhas].sort((a, b) => {
    const va = valorColunaMensal(a, coluna)
    const vb = valorColunaMensal(b, coluna)
    if (va === null && vb === null) return 0
    if (va === null) return 1
    if (vb === null) return -1
    return ordemAsc ? va - vb : vb - va
  })
}

function CabecalhoColunaMensal({ coluna, colunaOrdenada, onClick, children }: {
  coluna: ColunaMensal
  colunaOrdenada: ColunaMensal
  onClick: (coluna: ColunaMensal) => void
  children: ReactNode
}) {
  return (
    <button type="button" onClick={() => onClick(coluna)} className="inline-flex items-center gap-1 hover:opacity-80">
      {children}
      <ArrowUpDown className={cn('h-3 w-3', colunaOrdenada === coluna ? 'opacity-100' : 'opacity-50')} />
    </button>
  )
}

type SegmentoOperacionalAdm = 'consolidado' | 'operacional' | 'adm'
const OPCOES_SEGMENTO_OPERACIONAL_ADM = [
  { value: 'consolidado', label: 'Consolidado' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'adm', label: 'ADM' },
] as const

/** Unidade sintética pra reaproveitar `calcularComparativoPorUnidade`/`somaRemunerado`/`buscarOrcadoRs` direto pro código AMBEV — não vem de `unidades` (que exclui AMBEV de propósito, ver `AnaliseDetalhadaPacoteDeGentePage.tsx`). */
const UNIDADE_AMBEV: Unidade = { id: 'AMBEV', codigo: 'AMBEV', nome: 'AMBEV', nome_ginfo: null, data_entrada: null }

type ColunaComparativo = 'base' | 'realizado' | 'desvioRs' | 'desvioPercent'

/**
 * Tabela comparativa por unidade — uma linha por unidade (sem AMBEV), todas as
 * colunas clicáveis pra ordenar (mesmo padrão `alternarOrdenacao`/`ArrowUpDown`
 * de `TabelaAberturaConta`, `abertura-conta-shared.tsx`), com um toggle
 * Orçado/Remunerado que troca a base usada na coluna e no cálculo do desvio —
 * assim o gestor compara Orçado×Realizado OU Remunerado×Realizado, pro mesmo
 * pacote, sem precisar de duas tabelas.
 */
function TabelaComparativoUnidades({
  linhas, titulo, subtitulo, baseInicial = 'orcado', tipoBase: tipoBaseControlado, onTipoBaseChange,
}: {
  linhas: LinhaComparativoUnidade[]
  titulo: string
  subtitulo: string
  /** Pacotes sem Orçamento cadastrado (ex: Encargos) nascem com a tabela já em "Remunerado" — sem isso a coluna base viria toda "—" até o usuário trocar o toggle manualmente. Ignorado quando `tipoBase` (controlado) é informado. */
  baseInicial?: TipoBase
  /** Quando informado junto com `onTipoBaseChange`, o toggle Orçado/Remunerado passa a ser controlado pelo pai — usado quando outra peça da seção (ex: a tabela mensal de desvio por unidade) precisa saber/mudar a mesma base selecionada aqui. Sem isso, o toggle gerencia seu próprio estado (`baseInicial`). */
  tipoBase?: TipoBase
  onTipoBaseChange?: (v: TipoBase) => void
}) {
  const [tipoBaseInterno, setTipoBaseInterno] = useState<TipoBase>(baseInicial)
  const tipoBase = tipoBaseControlado ?? tipoBaseInterno
  const setTipoBase = onTipoBaseChange ?? setTipoBaseInterno
  const [colunaOrdenada, setColunaOrdenada] = useState<ColunaComparativo>('desvioRs')
  const [ordemAsc, setOrdemAsc] = useState(true)

  function alternarOrdenacao(coluna: ColunaComparativo) {
    if (coluna === colunaOrdenada) setOrdemAsc(v => !v)
    else { setColunaOrdenada(coluna); setOrdemAsc(coluna === 'desvioRs' || coluna === 'desvioPercent') }
  }

  const linhasOrdenadas = useMemo(() => {
    const comMetricas = linhas.map(l => ({
      linha: l,
      base: baseDe(l, tipoBase),
      desvioRs: desvioDe(l, tipoBase),
      desvioPercent: desvioPercentDe(l, tipoBase),
    }))
    // valor null (sem dado) sempre vai pro fim, não importa a direção da ordenação.
    return comMetricas.sort((a, b) => {
      const va = colunaOrdenada === 'realizado' ? a.linha.realizado : a[colunaOrdenada]
      const vb = colunaOrdenada === 'realizado' ? b.linha.realizado : b[colunaOrdenada]
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return ordemAsc ? va - vb : vb - va
    })
  }, [linhas, tipoBase, colunaOrdenada, ordemAsc])

  const rotuloBase = tipoBase === 'orcado' ? 'Orçado' : 'Remunerado'

  return (
    <TableCard
      titulo={titulo}
      subtitulo={subtitulo}
      acoes={<PillToggle opcoes={OPCOES_BASE} value={tipoBase} onChange={setTipoBase} />}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Unidade</TableHead>
            <TableHead className="text-center">
              <button type="button" onClick={() => alternarOrdenacao('base')} className="inline-flex items-center gap-1 hover:opacity-80">
                {rotuloBase}
                <ArrowUpDown className={cn('h-3 w-3', colunaOrdenada === 'base' ? 'opacity-100' : 'opacity-50')} />
              </button>
            </TableHead>
            <TableHead className="text-center">
              <button type="button" onClick={() => alternarOrdenacao('realizado')} className="inline-flex items-center gap-1 hover:opacity-80">
                Realizado
                <ArrowUpDown className={cn('h-3 w-3', colunaOrdenada === 'realizado' ? 'opacity-100' : 'opacity-50')} />
              </button>
            </TableHead>
            <TableHead className="text-center">
              <button type="button" onClick={() => alternarOrdenacao('desvioRs')} className="inline-flex items-center gap-1 hover:opacity-80">
                Desvio
                <ArrowUpDown className={cn('h-3 w-3', colunaOrdenada === 'desvioRs' ? 'opacity-100' : 'opacity-50')} />
              </button>
            </TableHead>
            <TableHead className="text-center">
              <button type="button" onClick={() => alternarOrdenacao('desvioPercent')} className="inline-flex items-center gap-1 hover:opacity-80">
                Desvio %
                <ArrowUpDown className={cn('h-3 w-3', colunaOrdenada === 'desvioPercent' ? 'opacity-100' : 'opacity-50')} />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhasOrdenadas.map(({ linha, base, desvioRs, desvioPercent }) => (
            <TableRow key={linha.unidade} className="border-gray-200/30 dark:border-gray-700/30">
              <TableCell className="text-sm font-medium">{linha.nomeUnidade}</TableCell>
              <TableCell className="text-center text-sm tabular-nums">
                {base === null ? '—' : formatInteiroPtBr(base)}
              </TableCell>
              <TableCell className="text-center text-sm tabular-nums">{formatInteiroPtBr(linha.realizado)}</TableCell>
              <TableCell className={cn('text-center text-sm font-semibold tabular-nums', corGapRs(desvioRs))}>
                {desvioRs === null ? '—' : formatInteiroPtBr(desvioRs)}
              </TableCell>
              <TableCell className={cn('text-center text-sm font-semibold tabular-nums', corGapRs(desvioRs))}>
                {formatPercent(desvioPercent, 1)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  )
}

/**
 * Desvio (base selecionada na `TabelaComparativoUnidades` acima − Realizado)
 * por unidade, mês a mês — mesma ideia da tabela de unidades, só que abrindo
 * o acumulado em 12 colunas. Cada mês é "isolado" (acumulado até `m` menos
 * acumulado até `m-1`, mesma técnica já usada nos cards agregados desta
 * seção) — null quando falta um dos dois lados da subtração. A coluna
 * Acumulado reaproveita `linhasAcumuladoAteMes` (já calculada no pai, mesma
 * instância usada na tabela de cima) pra não duplicar a chamada nem arriscar
 * divergir por arredondamento entre as duas tabelas.
 */
function TabelaMensalDesvioPorUnidade({
  chave, titulo, rowsFiltrado, orcamentosFiltrado, unidades, ano, mes, indiceSegmento, tipoBase, linhasAcumuladoAteMes,
}: {
  chave: ChavePacoteGente
  titulo: string
  rowsFiltrado: DreLongoRow[]
  orcamentosFiltrado: OrcamentoLinha[]
  unidades: Unidade[]
  ano: number
  mes: number
  indiceSegmento?: number
  tipoBase: TipoBase
  linhasAcumuladoAteMes: LinhaComparativoUnidade[]
}) {
  const linhasPorMes = useMemo(
    () => MESES_12.map(m => calcularComparativoPorUnidade(chave, rowsFiltrado, orcamentosFiltrado, unidades, ano, m, indiceSegmento)),
    [chave, rowsFiltrado, orcamentosFiltrado, unidades, ano, indiceSegmento],
  )

  function desvioIsolado(codigoUnidade: string, m: number): number | null {
    const linhaAtual = linhasPorMes[m - 1].find(l => l.unidade === codigoUnidade)
    const desvioAtual = linhaAtual ? desvioDe(linhaAtual, tipoBase) : null
    if (desvioAtual === null) return null
    if (m === 1) return desvioAtual
    const linhaAnterior = linhasPorMes[m - 2].find(l => l.unidade === codigoUnidade)
    const desvioAnterior = linhaAnterior ? desvioDe(linhaAnterior, tipoBase) : null
    return desvioAnterior === null ? null : desvioAtual - desvioAnterior
  }

  // Linha pronta por unidade (mês isolado × 12 + acumulado) — calculada uma
  // vez só, reaproveitada tanto pra render quanto pra ordenação por coluna.
  const linhasPorUnidade = useMemo(() => {
    return unidades.map(u => {
      const linhaAcumulado = linhasAcumuladoAteMes.find(l => l.unidade === u.codigo)
      const acumulado = linhaAcumulado ? desvioDe(linhaAcumulado, tipoBase) : null
      const porMes = MESES_12.map(m => m > mes ? null : desvioIsolado(u.codigo, m))
      return { unidade: u.codigo, nomeUnidade: u.nome, porMes, acumulado }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidades, linhasAcumuladoAteMes, linhasPorMes, tipoBase, mes])

  const [colunaOrdenada, setColunaOrdenada] = useState<ColunaMensal>('acumulado')
  const [ordemAsc, setOrdemAsc] = useState(false)

  function alternarOrdenacao(coluna: ColunaMensal) {
    if (coluna === colunaOrdenada) setOrdemAsc(v => !v)
    else { setColunaOrdenada(coluna); setOrdemAsc(false) }
  }

  const linhasOrdenadas = useMemo(
    () => ordenarPorColunaMensal(linhasPorUnidade, colunaOrdenada, ordemAsc),
    [linhasPorUnidade, colunaOrdenada, ordemAsc],
  )

  const rotuloBase = tipoBase === 'orcado' ? 'Orçado' : 'Remunerado'

  return (
    <TableCard
      titulo={`${titulo} — desvio por unidade, mês a mês`}
      subtitulo={`Desvio ${rotuloBase} × Realizado — mesma base selecionada na tabela acima · Acumulado soma Jan até ${MES_ABREV[mes]} · clique numa coluna pra ordenar`}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Unidade</TableHead>
            {MESES_12.map(m => (
              <TableHead key={m} className="text-center">
                <CabecalhoColunaMensal coluna={m} colunaOrdenada={colunaOrdenada} onClick={alternarOrdenacao}>{MES_ABREV[m]}</CabecalhoColunaMensal>
              </TableHead>
            ))}
            <TableHead className="text-center">
              <CabecalhoColunaMensal coluna="acumulado" colunaOrdenada={colunaOrdenada} onClick={alternarOrdenacao}>Acumulado</CabecalhoColunaMensal>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhasOrdenadas.map(l => (
            <TableRow key={l.unidade} className="border-gray-200/30 dark:border-gray-700/30">
              <TableCell className="text-sm font-medium">{l.nomeUnidade}</TableCell>
              {l.porMes.map((v, i) => (
                <TableCell key={i + 1} className={cn('text-center text-sm tabular-nums', i + 1 > mes ? 'text-muted-foreground' : corGapRs(v))}>
                  {i + 1 > mes || v === null ? '—' : formatInteiroPtBr(v)}
                </TableCell>
              ))}
              <TableCell className={cn('text-center text-sm font-semibold tabular-nums', corGapRs(l.acumulado))}>
                {l.acumulado === null ? '—' : formatInteiroPtBr(l.acumulado)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  )
}

/**
 * Acompanhamento mensal de UM item (de `itens`) por vez, escolhido num
 * seletor — mesma ideia de `AcompanhamentoConta` (`abertura-conta-shared.tsx`,
 * usada na aba Unidade), só que em vez de uma unidade só, cada LINHA é uma
 * unidade (coluna de meses + Acumulado), pra comparar como aquele item
 * específico se comporta em todas as unidades ao mesmo tempo. Mostra o Gap
 * (Remunerado − Realizado) por padrão — mesma métrica de `AcompanhamentoConta`
 * — ou, com `metrica="diferenca"` (Vales: Orçado/Remunerado não fazem sentido
 * aqui, só a Dispersão/estouro já registrado no campo `diferenca` bruto, igual
 * o Painel de Perdas), o campo `diferenca` direto via `somaDif`, sem passar
 * por `normalizarParaCalculo` (que é só pra Remunerado/Realizado). Em ambos os
 * casos, uma célula só por mês (não dá pra empilhar Remunerado/Realizado/Gap
 * como linhas separadas sem perder a visibilidade por unidade). Com
 * `comSegmento`, o toggle Consolidado/Operacional/ADM escolhe qual dos 2
 * códigos do item entra na soma (`codigo`/`codigoAdm`) — "ADM" fica vazio
 * (mostra "—") nos itens sem par administrativo; sem `comSegmento` (ex:
 * Vales, que não tem par nenhum), usa sempre só `codigo`, sem mostrar o
 * toggle.
 */
function TabelaMensalContaPorUnidade({
  titulo, itens, codigoPadrao, comSegmento = false, metrica = 'gap', rowsFiltrado, unidades, ano, mes, nomesConta,
}: {
  titulo: string
  itens: ItemContaCorporativo[]
  codigoPadrao: string
  comSegmento?: boolean
  metrica?: 'gap' | 'diferenca'
  rowsFiltrado: DreLongoRow[]
  unidades: Unidade[]
  ano: number
  mes: number
  nomesConta: Map<string, string>
}) {
  const [conta, setConta] = useState(codigoPadrao)
  const [segmento, setSegmento] = useState<SegmentoOperacionalAdm>('consolidado')

  const item = itens.find(i => i.codigo === conta) ?? itens[0]
  const codigos = !comSegmento ? [item.codigo]
    : segmento === 'operacional' ? [item.codigo]
    : segmento === 'adm' ? (item.codigoAdm ? [item.codigoAdm] : [])
    : (item.codigoAdm ? [item.codigo, item.codigoAdm] : [item.codigo])

  const linhasPorUnidade = useMemo(() => {
    return unidades.map(u => {
      const rowsUnidadeAno = rowsFiltrado.filter(r => r.unidade === u.codigo && r.ano === ano && r.tipo_periodo === 'MENSAL')
      let acumulado = 0
      let acumuladoComDado = false
      const porMes = MESES_12.map(m => {
        const rowsMes = rowsUnidadeAno.filter(r => r.mes === m)
        if (rowsMes.length === 0 || codigos.length === 0) return null
        const valor = metrica === 'diferenca'
          ? somaDif(rowsMes, codigos)
          : (() => { const calc = normalizarParaCalculo(rowsMes); return somaRemunerado(calc, codigos) - somaReal(calc, codigos) })()
        acumulado += valor
        acumuladoComDado = true
        return valor
      })
      return { unidade: u.codigo, nomeUnidade: u.nome, porMes, acumulado: acumuladoComDado ? acumulado : null }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsFiltrado, unidades, ano, codigos.join(','), metrica])

  const [colunaOrdenada, setColunaOrdenada] = useState<ColunaMensal>('acumulado')
  const [ordemAsc, setOrdemAsc] = useState(false)

  function alternarOrdenacao(coluna: ColunaMensal) {
    if (coluna === colunaOrdenada) setOrdemAsc(v => !v)
    else { setColunaOrdenada(coluna); setOrdemAsc(false) }
  }

  const linhasOrdenadas = useMemo(
    () => ordenarPorColunaMensal(linhasPorUnidade, colunaOrdenada, ordemAsc),
    [linhasPorUnidade, colunaOrdenada, ordemAsc],
  )

  const rotuloMetrica = metrica === 'diferenca' ? 'Diferença (estouro)' : 'Gap Remunerado × Realizado'

  // Avança pra próxima conta do seletor sem precisar abrir o dropdown — pra
  // quem quer passar por todas em sequência. Volta pra primeira depois da
  // última (wrap-around), nunca trava no fim da lista.
  function proximaConta() {
    const indiceAtual = itens.findIndex(i => i.codigo === conta)
    const proximo = itens[(indiceAtual + 1) % itens.length]
    setConta(proximo.codigo)
  }

  return (
    <TableCard
      titulo={`${titulo} — acompanhamento por conta`}
      subtitulo={`${rotuloMetrica} — ${nomesConta.get(item.codigo) ?? item.codigo} — por unidade, mês a mês · Acumulado soma Jan até ${MES_ABREV[mes]} · clique numa coluna pra ordenar`}
      acoes={
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={proximaConta} title="Próxima conta">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select value={conta} onValueChange={setConta}>
            <SelectTrigger className="h-8 w-64 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {itens.map(i => (
                <SelectItem key={i.codigo} value={i.codigo}>
                  {nomesConta.get(i.codigo) ?? i.codigo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {comSegmento && <PillToggle opcoes={OPCOES_SEGMENTO_OPERACIONAL_ADM} value={segmento} onChange={setSegmento} />}
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Unidade</TableHead>
            {MESES_12.map(m => (
              <TableHead key={m} className="text-center">
                <CabecalhoColunaMensal coluna={m} colunaOrdenada={colunaOrdenada} onClick={alternarOrdenacao}>{MES_ABREV[m]}</CabecalhoColunaMensal>
              </TableHead>
            ))}
            <TableHead className="text-center">
              <CabecalhoColunaMensal coluna="acumulado" colunaOrdenada={colunaOrdenada} onClick={alternarOrdenacao}>Acumulado</CabecalhoColunaMensal>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhasOrdenadas.map(l => (
            <TableRow key={l.unidade} className="border-gray-200/30 dark:border-gray-700/30">
              <TableCell className="text-sm font-medium">{l.nomeUnidade}</TableCell>
              {l.porMes.map((v, i) => (
                <TableCell key={i + 1} className={cn('text-center text-sm tabular-nums', i + 1 > mes ? 'text-muted-foreground' : corGapRs(v))}>
                  {i + 1 > mes || v === null ? '—' : formatInteiroPtBr(v)}
                </TableCell>
              ))}
              <TableCell className={cn('text-center text-sm font-semibold tabular-nums', corGapRs(l.acumulado))}>
                {l.acumulado === null ? '—' : formatInteiroPtBr(l.acumulado)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  )
}

/**
 * Tabela mensal (Orçamento/Remunerado/Realizado/Gap × Jan-Dez + Acumulado) do
 * Pacote de Gente — mesma estrutura exata da tabela de `BlocoGapOrcamentoMensal`
 * (`PacoteDeGenteDetalhado.tsx`), só que fixa na unidade AMBEV (cujo DRE já É
 * o consolidado de todas as unidades — não é soma calculada aqui, é a própria
 * linha do GInfo), pra dar o acompanhamento mês a mês que os 3 cards (sempre
 * "foto" do mês/acumulado selecionado) não mostram.
 */
function TabelaMensalPacoteGenteAmbev({
  rowsAmbevAno, orcamentosAmbevAno, negocio, ano, mes,
}: {
  rowsAmbevAno: DreLongoRow[]
  orcamentosAmbevAno: OrcamentoLinha[]
  negocio: string
  ano: number
  mes: number
}) {
  const prefixos = PACOTES['159'].prefixos

  const serie = useMemo(() => {
    let acumuladoOrcado = 0
    let acumuladoRemunerado = 0
    let acumuladoRealizado = 0
    let acumuladoRealizadoComSinal = 0
    return MESES_12.map(m => {
      const rowsMes = rowsAmbevAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === m)
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

      const orcado = buscarOrcadoRs(orcamentosAmbevAno, { unidade: 'AMBEV', negocio, ano, codigo: '159', mes: m })
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
  }, [rowsAmbevAno, orcamentosAmbevAno, negocio, ano, prefixos])

  const linhaMesSel = serie[mes - 1]

  return (
    <TableCard
      titulo="Pacote de Gente — AMBEV por mês"
      subtitulo={`Orçamento × Remunerado × Realizado da linha AMBEV (consolidado) — gap (Remunerado − Realizado) · Acumulado soma Jan até ${MES_ABREV[mes]}`}
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
            {/* Sinal original do GInfo (`realizadoComSinal`) — mesma correção de `BlocoGapOrcamentoMensal` (PacoteDeGenteDetalhado.tsx). */}
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
            <TableCell className={cn('text-center text-sm font-bold tabular-nums', corGapRs(linhaMesSel.acumuladoGap))}>
              {linhaMesSel.acumuladoGap === null ? '—' : formatInteiroPtBr(linhaMesSel.acumuladoGap)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableCard>
  )
}

/** Uma linha do ranking de unidades por conta (`PainelPiorUnidadePorConta`) — maior estouro (Remunerado − Realizado mais negativo) primeiro, AMBEV sempre fora (é o consolidado, não uma unidade operacional). */
interface LinhaRankingUnidade {
  unidade: string
  nomeUnidade: string
  estouroMes: number
  estouroAno: number
  /**
   * Peso do REALIZADO acumulado dessa unidade sobre o Realizado acumulado da
   * AMBEV inteira, pra mesma conta — "quanto essa unidade pesa no gasto
   * total", independente de ter estourado ou não (métrica separada do
   * estouro: uma unidade pode gastar muito e ainda estar dentro do
   * remunerado, ou gastar pouco e estourar feio — as duas coisas interessam,
   * mas são perguntas diferentes). Null quando a AMBEV não gastou nada nessa
   * conta no período (divisão por zero).
   */
  percentualDoRealizadoAmbev: number | null
}

/**
 * Ranking "quem mais estourou essa conta" (Remunerado − Realizado, mesma
 * convenção de sinal do Delta em `TabelaAberturaConta` — negativo = estouro)
 * — clique numa linha das 2 tabelas de `SecaoAberturaContaAmbev` abre esse
 * painel, ordenado do pior estouro pro melhor. Zero busca nova: só filtra/
 * soma em memória as linhas de `rowsFiltrado` (cache global, já carregado)
 * pelos `codigos` daquela conta/grupo, por unidade — mesmo princípio de
 * "nunca refazer fetch pra isso que já está na memória" das outras telas.
 */
function PainelPiorUnidadePorConta({ rotulo, codigos, rowsFiltrado, unidades, ano, mes, onOpenChange }: {
  rotulo: string | null
  codigos: number[]
  rowsFiltrado: DreLongoRow[]
  unidades: Unidade[]
  ano: number
  mes: number
  onOpenChange: (open: boolean) => void
}) {
  const linhas = useMemo<LinhaRankingUnidade[]>(() => {
    if (rotulo === null || codigos.length === 0) return []
    // Prefixos de 3 dígitos pros mesmos `somaReal`/`somaRemunerado` que o
    // resto do app usa — já cuidam de magnitude (abs) e da tradução de
    // numeração antiga×nova via `normalizarParaCalculo`
    // (`codigoDreNumeracaoAtual`), em vez de ler a linha crua (sinal/
    // numeração podiam vir errados pra anos antes do cutover).
    const prefixos = codigos.map(c => String(c).padStart(3, '0'))
    const porUnidade = new Map<string, DreLongoRow[]>()
    const rowsAmbev: DreLongoRow[] = []
    for (const r of rowsFiltrado) {
      if (r.ano !== ano || r.tipo_periodo !== 'MENSAL') continue
      if (r.unidade === 'AMBEV') { rowsAmbev.push(r); continue }
      const lista = porUnidade.get(r.unidade)
      if (lista) lista.push(r)
      else porUnidade.set(r.unidade, [r])
    }
    const calcAmbevAno = normalizarParaCalculo(rowsAmbev.filter(r => r.mes <= mes))
    const realizadoAmbevAno = somaReal(calcAmbevAno, prefixos)

    const nomesUnidade = new Map(unidades.map(u => [u.codigo, u.nome]))
    return Array.from(porUnidade.entries())
      .map(([unidade, rows]) => {
        const calcMesUnidade = normalizarParaCalculo(rows.filter(r => r.mes === mes))
        const calcAnoUnidade = normalizarParaCalculo(rows.filter(r => r.mes <= mes))
        const estouroAno = somaRemunerado(calcAnoUnidade, prefixos) - somaReal(calcAnoUnidade, prefixos)
        const realizadoAno = somaReal(calcAnoUnidade, prefixos)
        return {
          unidade,
          nomeUnidade: nomesUnidade.get(unidade) ?? unidade,
          estouroMes: somaRemunerado(calcMesUnidade, prefixos) - somaReal(calcMesUnidade, prefixos),
          estouroAno,
          percentualDoRealizadoAmbev: realizadoAmbevAno === 0 ? null : (realizadoAno / realizadoAmbevAno) * 100,
        }
      })
      .filter(l => l.estouroMes !== 0 || l.estouroAno !== 0)
      .sort((a, b) => a.estouroAno - b.estouroAno)
  }, [rotulo, codigos, rowsFiltrado, unidades, ano, mes])

  return (
    <Dialog open={rotulo !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rotulo} — estouro por unidade</DialogTitle>
        </DialogHeader>
        {linhas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma unidade com movimento nessa conta no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">{MES_ABREV[mes]}</TableHead>
                <TableHead className="text-right">% do Realizado — AMBEV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(l => (
                <TableRow key={l.unidade}>
                  <TableCell className="text-sm">{l.nomeUnidade}</TableCell>
                  <TableCell className={cn('text-right text-sm tabular-nums', corGapRs(l.estouroMes))}>{formatInteiroPtBr(l.estouroMes)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">
                    {l.percentualDoRealizadoAmbev === null ? '—' : formatPercent(l.percentualDoRealizadoAmbev, 1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * "Análise por Conta" da AMBEV (consolidado) — as mesmas 2 tabelas lado a
 * lado de `SlidePacoteDeGenteGerentes.tsx` (SDG Gerentes): "Demais Contas"
 * (Salários/Vales/Benefícios/Contratação-Demissão/Segurança, todas as
 * folhas) e "Encargos", com o seletor Consolidado/Operacional/ADM
 * compartilhado entre as duas. Diferença daquele slide: aqui os dados já
 * vêm da linha AMBEV (consolidado oficial do GInfo, não uma soma calculada
 * aqui), em vez de uma unidade só. Clicar numa linha abre
 * `PainelPiorUnidadePorConta` — ranking de unidades pra aquela conta/grupo,
 * calculado em memória a partir de `rowsFiltrado` (todas as unidades, já no
 * cache global), sem nenhuma busca nova.
 */
function SecaoAberturaContaAmbev({ rowsFiltrado, orcamentosFiltrado, unidades, negocio, ano, mes, nomesConta }: {
  rowsFiltrado: DreLongoRow[]
  orcamentosFiltrado: OrcamentoLinha[]
  unidades: Unidade[]
  negocio: string
  ano: number
  mes: number
  nomesConta: Map<string, string>
}) {
  const [segmento, setSegmento] = useState<SegmentoOperacionalAdm>('consolidado')
  const gruposDemaisContas = useMemo(() => gruposAberturaPorSegmento(ITENS_DEMAIS_CONTAS_ABERTURA, segmento), [segmento])
  const gruposEncargos = useMemo(() => gruposAberturaPorSegmento(ITENS_ENCARGOS_ABERTURA, segmento), [segmento])
  const codigosPorRotulo = useMemo(() => {
    const mapa = new Map<string, number[]>()
    for (const g of [...gruposDemaisContas, ...gruposEncargos]) mapa.set(g.rotulo, [...g.codigos])
    return mapa
  }, [gruposDemaisContas, gruposEncargos])

  const [rotuloSelecionado, setRotuloSelecionado] = useState<string | null>(null)

  const rowsAmbevAno = useMemo(() => rowsFiltrado.filter(r => r.unidade === 'AMBEV' && r.ano === ano), [rowsFiltrado, ano])
  const calcAcumulado = useMemo(
    () => normalizarParaCalculo(rowsAmbevAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes <= mes)),
    [rowsAmbevAno, mes],
  )
  const calcMesSelecionado = useMemo(
    () => normalizarParaCalculo(rowsAmbevAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === mes)),
    [rowsAmbevAno, mes],
  )
  const realizadoGenteMae = useMemo(() => somaReal(calcAcumulado, PACOTES['159'].prefixos), [calcAcumulado])
  const realizadoGenteMaeMes = useMemo(() => somaReal(calcMesSelecionado, PACOTES['159'].prefixos), [calcMesSelecionado])

  return (
    <>
      <Separador titulo="ANÁLISE POR CONTA — AMBEV" />
      <p className="text-xs text-muted-foreground">Clique numa linha das tabelas abaixo pra ver quais unidades mais impactaram aquela conta.</p>
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
          ano={ano}
          unidade="AMBEV"
          negocio={negocio}
          orcamentoAno={orcamentosFiltrado}
          onClickLinha={setRotuloSelecionado}
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
          ano={ano}
          unidade="AMBEV"
          negocio={negocio}
          orcamentoAno={orcamentosFiltrado}
          onClickLinha={setRotuloSelecionado}
        />
      </div>

      <PainelPiorUnidadePorConta
        rotulo={rotuloSelecionado}
        codigos={rotuloSelecionado ? codigosPorRotulo.get(rotuloSelecionado) ?? [] : []}
        rowsFiltrado={rowsFiltrado}
        unidades={unidades}
        ano={ano}
        mes={mes}
        onOpenChange={v => { if (!v) setRotuloSelecionado(null) }}
      />
    </>
  )
}

/**
 * Linhas "isoladas" do mês selecionado — resultado SÓ daquele mês, não o
 * acumulado Jan→mês que `calcularComparativoPorUnidade` sempre devolve.
 * Mesma técnica de subtração acumulado(mês) − acumulado(mês−1) já usada nos
 * cards agregados e em `TabelaMensalDesvioPorUnidade`, só que aqui aplicada
 * campo a campo pra reconstruir a `LinhaComparativoUnidade` inteira (não só
 * o desvio) e alimentar `TabelaComparativoUnidades` sem precisar mudar o
 * componente. As tabelas "X por unidade" mostram o mês selecionado, não o
 * acumulado do ano — os cards e `TabelaMensalDesvioPorUnidade` continuam
 * recebendo as linhas acumuladas originais, sem mudança.
 * Em Jan (`ehPrimeiroMes`), o acumulado JÁ é o mês isolado — `linhasAnterior`
 * chega igual a `linhasAtual` nesse caso (mesmo padrão do resto do arquivo),
 * então nem tenta subtrair, senão zerava tudo.
 */
function linhasIsoladas(
  linhasAtual: LinhaComparativoUnidade[], linhasAnterior: LinhaComparativoUnidade[], ehPrimeiroMes: boolean,
): LinhaComparativoUnidade[] {
  if (ehPrimeiroMes) return linhasAtual
  function campo(a: number | null, b: number | null): number | null {
    return a === null || b === null ? null : a - b
  }
  return linhasAtual.map(atual => {
    const anterior = linhasAnterior.find(l => l.unidade === atual.unidade)
    if (!anterior) return atual
    return {
      unidade: atual.unidade,
      nomeUnidade: atual.nomeUnidade,
      orcado: campo(atual.orcado, anterior.orcado),
      remunerado: atual.remunerado - anterior.remunerado,
      realizado: atual.realizado - anterior.realizado,
      dispersao: campo(atual.dispersao, anterior.dispersao),
      receitaRealizada: atual.receitaRealizada - anterior.receitaRealizada,
    }
  })
}

/**
 * Os 3 cards do Pacote de Gente geral (Orçado/Realizado/Desvio) — Orçado e
 * Realizado (R$ + %) lêem a linha da própria unidade AMBEV (consolidado
 * nativo do GInfo, não somado aqui), enquanto o Desvio vem da soma das
 * unidades (`somarLinhas` + `desvioDe`), servindo de conferência visual entre
 * o número "oficial" da AMBEV e a soma bottom-up — mesmo racional de
 * `PacoteDeGenteCorporativo`. Reaproveitado pela seção SEGURANÇA, que usa
 * esse MESMO modelo de card em vez do `CardsGapAgregado` dos demais
 * sub-pacotes (pedido explícito do usuário).
 */
function CardsOrcadoRealizadoDesvio({
  sufixoTitulo, orcadoRs, percentualOrcado, realizadoRs, percentualRealizado, desvioRs, desvioPercent,
}: {
  sufixoTitulo: string
  orcadoRs: number | null
  percentualOrcado: number | null
  realizadoRs: number
  percentualRealizado: number | null
  desvioRs: number | null
  desvioPercent: number | null
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
      <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">Orçado (BGT) — {sufixoTitulo}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          {orcadoRs === null ? '—' : formatCurrencyInteiro(orcadoRs)}
        </p>
        <p className="text-sm font-semibold text-gray-400 dark:text-slate-400">{formatPercent(percentualOrcado, 1)}</p>
      </div>
      <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">Realizado (ACT) — {sufixoTitulo}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{formatCurrencyInteiro(realizadoRs)}</p>
        <p className="text-sm font-semibold text-gray-400 dark:text-slate-400">{formatPercent(percentualRealizado, 1)}</p>
      </div>
      <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">Desvio (Orçado × Realizado) — soma das unidades</p>
        <div className="mt-2 flex items-end gap-3">
          <p className={cn('text-2xl font-bold', corGapRs(desvioRs))}>
            {desvioRs === null ? '—' : formatCurrencyInteiro(desvioRs)}
          </p>
          <p className={cn('pb-0.5 text-sm font-semibold', corGapRs(desvioRs))}>{formatPercent(desvioPercent, 1)}</p>
        </div>
      </div>
    </div>
  )
}

/** Os mesmos 3 cards que `BlocoGapOrcamentoMensal` (`PacoteDeGenteDetalhado.tsx`) mostra pra uma unidade só — aqui cada valor já vem AGREGADO (somado) de todas as unidades, calculado em `PacoteDeGenteCorporativo`. */
function CardsGapAgregado({
  titulo, gapMes, gapAno, percentualDoPacoteMes, percentualDoPacoteAno, mes, ano,
}: {
  titulo: string
  gapMes: number | null
  gapAno: number | null
  percentualDoPacoteMes: number | null
  percentualDoPacoteAno: number | null
  mes: number
  ano: number
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
          {titulo} — Mês — {MES_ABREV[mes]}/{ano}
        </p>
        <p className={cn('mt-2 text-3xl font-bold', corGapRs(gapMes))}>
          {gapMes === null ? '—' : formatCurrencyInteiro(gapMes)}
        </p>
      </div>
      <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
          {titulo} — Acumulado Ano
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
  )
}

/**
 * Seção de um sub-pacote (Salários, Encargos, ...) do Corporativo — Separador
 * + (opcional) pílula Consolidado/Operacional/ADM + os mesmos 3 cards de
 * `BlocoGapOrcamentoMensal` (agora somados de todas as unidades) + a tabela
 * comparativa ordenável com toggle Orçado/Remunerado. Os cards são sempre
 * "Gap Remunerado × Realizado" (nunca Orçado × Realizado) — mesma convenção
 * de `BlocoGapOrcamentoMensal` na aba Unidade, que também nunca usa o Orçado
 * como base dos cards, só da linha extra da tabela.
 */
function SecaoSubPacote({
  chave, titulo, tituloSeparador, comSegmento = false, baseTabelaInicial = 'orcado', comTabelaMensalPorUnidade = false,
  rowsFiltrado, orcamentosFiltrado, unidades, ano, mes, linhasPacoteGenteAcumulado, linhasPacoteGenteAcumuladoAnterior,
}: {
  chave: ChavePacoteGente
  titulo: string
  tituloSeparador: string
  /** true pros pacotes que somam operacional+administrativo (Salários, Benefícios, Segurança, Gastos Contratação/Demissão, Encargos) — só Vales não tem essa divisão. */
  comSegmento?: boolean
  baseTabelaInicial?: TipoBase
  /** Acrescenta `TabelaMensalDesvioPorUnidade` abaixo da tabela comparativa — nesse caso o toggle Orçado/Remunerado da tabela de cima passa a ser controlado por esta seção (compartilhado com a tabela mensal), em vez de self-managed. */
  comTabelaMensalPorUnidade?: boolean
  rowsFiltrado: DreLongoRow[]
  orcamentosFiltrado: OrcamentoLinha[]
  unidades: Unidade[]
  ano: number
  mes: number
  /** Pacote de Gente (159) acumulado Jan até `mes` — denominador do Impacto % no Pacote (coluna "Ano"). */
  linhasPacoteGenteAcumulado: LinhaComparativoUnidade[]
  /** Idem, acumulado Jan até `mes - 1` — subtraído do acumulado até `mes` pra isolar o realizado do mês (coluna "Mês"). */
  linhasPacoteGenteAcumuladoAnterior: LinhaComparativoUnidade[]
}) {
  const [segmento, setSegmento] = useState<SegmentoOperacionalAdm>('consolidado')
  const indiceSegmento = !comSegmento ? undefined : segmento === 'operacional' ? 0 : segmento === 'adm' ? 1 : undefined
  const [tipoBase, setTipoBase] = useState<TipoBase>(baseTabelaInicial)

  const linhasAno = useMemo(
    () => calcularComparativoPorUnidade(chave, rowsFiltrado, orcamentosFiltrado, unidades, ano, mes, indiceSegmento),
    [chave, rowsFiltrado, orcamentosFiltrado, unidades, ano, mes, indiceSegmento],
  )
  const linhasMesAnterior = useMemo(
    () => mes === 1 ? linhasAno : calcularComparativoPorUnidade(chave, rowsFiltrado, orcamentosFiltrado, unidades, ano, mes - 1, indiceSegmento),
    [chave, rowsFiltrado, orcamentosFiltrado, unidades, ano, mes, indiceSegmento, linhasAno],
  )

  // Gap do mês isolado = acumulado até `mes` menos acumulado até `mes-1` —
  // mesma lógica usada no mês a mês de `BlocoGapOrcamentoMensal`, só que aqui
  // cada "ponto" já é a soma de todas as unidades (via `somarLinhas`).
  const totalAno = useMemo(() => somarLinhas(linhasAno), [linhasAno])
  const totalMesAnterior = useMemo(() => somarLinhas(linhasMesAnterior), [linhasMesAnterior])

  const remuneradoMes = totalAno.remunerado - (mes === 1 ? 0 : totalMesAnterior.remunerado)
  const realizadoMes = totalAno.realizado - (mes === 1 ? 0 : totalMesAnterior.realizado)
  const gapMes = remuneradoMes - realizadoMes
  const gapAno = desvioDe(totalAno, 'remunerado')

  const totalGenteAcumulado = useMemo(() => somarLinhas(linhasPacoteGenteAcumulado), [linhasPacoteGenteAcumulado])
  const totalGenteAcumuladoAnterior = useMemo(() => somarLinhas(linhasPacoteGenteAcumuladoAnterior), [linhasPacoteGenteAcumuladoAnterior])
  const realizadoGenteMes = totalGenteAcumulado.realizado - (mes === 1 ? 0 : totalGenteAcumuladoAnterior.realizado)

  const percentualDoPacoteMes = realizadoGenteMes === 0 ? null : (realizadoMes / realizadoGenteMes) * 100
  const percentualDoPacoteAno = totalGenteAcumulado.realizado === 0 ? null : (totalAno.realizado / totalGenteAcumulado.realizado) * 100

  // A tabela "X por unidade" mostra o MÊS selecionado isolado, não o
  // acumulado do ano — `linhasAno`/`linhasMesAnterior` continuam acumuladas,
  // usadas pelos cards e por `TabelaMensalDesvioPorUnidade` (coluna Acumulado).
  const linhasDoMes = useMemo(() => linhasIsoladas(linhasAno, linhasMesAnterior, mes === 1), [linhasAno, linhasMesAnterior, mes])

  return (
    <>
      <Separador titulo={tituloSeparador} />
      {comSegmento && (
        <div className="flex justify-end">
          <PillToggle opcoes={OPCOES_SEGMENTO_OPERACIONAL_ADM} value={segmento} onChange={setSegmento} />
        </div>
      )}
      <CardsGapAgregado
        titulo="Gap Remunerado × Realizado"
        gapMes={gapMes} gapAno={gapAno}
        percentualDoPacoteMes={percentualDoPacoteMes} percentualDoPacoteAno={percentualDoPacoteAno}
        mes={mes} ano={ano}
      />
      <TabelaComparativoUnidades
        linhas={linhasDoMes}
        titulo={`${titulo} por unidade`}
        subtitulo={`Orçado/Remunerado × Realizado — resultado de ${MES_ABREV[mes]}/${ano} · clique numa coluna pra ordenar`}
        baseInicial={baseTabelaInicial}
        tipoBase={comTabelaMensalPorUnidade ? tipoBase : undefined}
        onTipoBaseChange={comTabelaMensalPorUnidade ? setTipoBase : undefined}
      />
      {comTabelaMensalPorUnidade && (
        <TabelaMensalDesvioPorUnidade
          chave={chave} titulo={titulo}
          rowsFiltrado={rowsFiltrado} orcamentosFiltrado={orcamentosFiltrado} unidades={unidades}
          ano={ano} mes={mes} indiceSegmento={indiceSegmento} tipoBase={tipoBase}
          linhasAcumuladoAteMes={linhasAno}
        />
      )}
    </>
  )
}

/**
 * Seção "Gastos com Vales" do Corporativo — diferente de `SecaoSubPacote`:
 * Orçado × Realizado e Remunerado × Realizado não fazem sentido pra Vales
 * (não é um pacote com meta/base, é a Dispersão do Painel de Perdas — mesmo
 * motivo que já fazia `calcularParaUnidade` tratar `chave === 'vales'` como
 * caso especial). Os cards usam a Dispersão acumulada (`dispersao`, campo
 * `diferenca` bruto somado) como "Estouro" — Mês e Acumulado Ano, mesma
 * subtração acumulado-menos-acumulado-anterior das outras seções — e o
 * Impacto % no Pacote de Gente continua baseado no Realizado, sem mudança.
 * Sem tabela por unidade (não faz sentido comparar Orçado/Remunerado que não
 * existem) — a comparação por unidade de Vales vive só na tabela de
 * acompanhamento por conta (`TabelaMensalContaPorUnidade`, `metrica="diferenca"`),
 * montada separadamente em `PacoteDeGenteCorporativo`.
 */
function SecaoVales({
  rowsFiltrado, unidades, ano, mes, linhasPacoteGenteAcumulado, linhasPacoteGenteAcumuladoAnterior,
}: {
  rowsFiltrado: DreLongoRow[]
  unidades: Unidade[]
  ano: number
  mes: number
  linhasPacoteGenteAcumulado: LinhaComparativoUnidade[]
  linhasPacoteGenteAcumuladoAnterior: LinhaComparativoUnidade[]
}) {
  const linhasAno = useMemo(
    () => calcularComparativoPorUnidade('vales', rowsFiltrado, [], unidades, ano, mes),
    [rowsFiltrado, unidades, ano, mes],
  )
  const linhasMesAnterior = useMemo(
    () => mes === 1 ? linhasAno : calcularComparativoPorUnidade('vales', rowsFiltrado, [], unidades, ano, mes - 1),
    [rowsFiltrado, unidades, ano, mes, linhasAno],
  )

  const totalAno = useMemo(() => somarLinhas(linhasAno), [linhasAno])
  const totalMesAnterior = useMemo(() => somarLinhas(linhasMesAnterior), [linhasMesAnterior])

  const dispersaoAno = totalAno.dispersao ?? 0
  const dispersaoMesAnterior = mes === 1 ? 0 : (totalMesAnterior.dispersao ?? 0)
  const estouroMes = dispersaoAno - dispersaoMesAnterior
  const estouroAno = dispersaoAno

  const realizadoMes = totalAno.realizado - (mes === 1 ? 0 : totalMesAnterior.realizado)

  const totalGenteAcumulado = useMemo(() => somarLinhas(linhasPacoteGenteAcumulado), [linhasPacoteGenteAcumulado])
  const totalGenteAcumuladoAnterior = useMemo(() => somarLinhas(linhasPacoteGenteAcumuladoAnterior), [linhasPacoteGenteAcumuladoAnterior])
  const realizadoGenteMes = totalGenteAcumulado.realizado - (mes === 1 ? 0 : totalGenteAcumuladoAnterior.realizado)

  const percentualDoPacoteMes = realizadoGenteMes === 0 ? null : (realizadoMes / realizadoGenteMes) * 100
  const percentualDoPacoteAno = totalGenteAcumulado.realizado === 0 ? null : (totalAno.realizado / totalGenteAcumulado.realizado) * 100

  return (
    <>
      <Separador titulo="GASTOS COM VALES" />
      <CardsGapAgregado
        titulo="Estouro"
        gapMes={estouroMes} gapAno={estouroAno}
        percentualDoPacoteMes={percentualDoPacoteMes} percentualDoPacoteAno={percentualDoPacoteAno}
        mes={mes} ano={ano}
      />
    </>
  )
}

/**
 * Seção "Segurança" do Corporativo — pedido explícito do usuário pra usar um
 * formato DIFERENTE de `SecaoSubPacote`: os cards são os mesmos do Pacote de
 * Gente geral (`CardsOrcadoRealizadoDesvio` — Orçado/Realizado lendo a linha
 * AMBEV, Desvio somado das unidades), não o par Gap+Impacto% das outras
 * seções. As duas tabelas seguem o modelo de Encargos: comparativo por
 * unidade (mês selecionado, toggle Orçado/Remunerado) + acompanhamento por
 * conta (`TabelaMensalContaPorUnidade`, com o par 074/188 e as folhas
 * 075-079/189-190 no seletor). Só 074 entra no total (cards/tabela) — ver
 * `ITENS_SEGURANCA`.
 */
function SecaoSeguranca({
  rowsFiltrado, orcamentosFiltrado, unidades, ano, mes,
}: {
  rowsFiltrado: DreLongoRow[]
  orcamentosFiltrado: OrcamentoLinha[]
  unidades: Unidade[]
  ano: number
  mes: number
}) {
  const linhasAno = useMemo(
    () => calcularComparativoPorUnidade('074', rowsFiltrado, orcamentosFiltrado, unidades, ano, mes),
    [rowsFiltrado, orcamentosFiltrado, unidades, ano, mes],
  )
  const linhasMesAnterior = useMemo(
    () => mes === 1 ? linhasAno : calcularComparativoPorUnidade('074', rowsFiltrado, orcamentosFiltrado, unidades, ano, mes - 1),
    [rowsFiltrado, orcamentosFiltrado, unidades, ano, mes, linhasAno],
  )
  const totalAno = useMemo(() => somarLinhas(linhasAno), [linhasAno])
  const desvioRs = desvioDe(totalAno, 'orcado')
  const desvioPercent = desvioPercentDe(totalAno, 'orcado')

  const linhaAmbev = useMemo(
    () => calcularComparativoPorUnidade('074', rowsFiltrado, orcamentosFiltrado, [UNIDADE_AMBEV], ano, mes)[0],
    [rowsFiltrado, orcamentosFiltrado, ano, mes],
  )
  const percentualOrcadoAmbev = percentualDeReceita(linhaAmbev.orcado, linhaAmbev.receitaRealizada)
  const percentualRealizadoAmbev = percentualDeReceita(linhaAmbev.realizado, linhaAmbev.receitaRealizada)

  // Tabela "Segurança por unidade" mostra o mês selecionado isolado, igual
  // Pacote de Gente/Salários/Encargos/Gastos Contratação-Demissão.
  const linhasDoMes = useMemo(() => linhasIsoladas(linhasAno, linhasMesAnterior, mes === 1), [linhasAno, linhasMesAnterior, mes])

  return (
    <>
      <Separador titulo="SEGURANÇA" />
      <CardsOrcadoRealizadoDesvio
        sufixoTitulo="AMBEV"
        orcadoRs={linhaAmbev.orcado} percentualOrcado={percentualOrcadoAmbev}
        realizadoRs={linhaAmbev.realizado} percentualRealizado={percentualRealizadoAmbev}
        desvioRs={desvioRs} desvioPercent={desvioPercent}
      />
      <TabelaComparativoUnidades
        linhas={linhasDoMes}
        titulo="Segurança por unidade"
        subtitulo={`Orçado/Remunerado × Realizado — resultado de ${MES_ABREV[mes]}/${ano} · clique numa coluna pra ordenar`}
        baseInicial="orcado"
      />
    </>
  )
}

interface Props {
  /** Todas as linhas de TODAS as unidades (`useDreLongoTodasUnidades` — cache global, sem fetch próprio), filtradas aqui dentro pelo `negocio` selecionado no filtro. */
  rowsTodasUnidades: DreLongoRow[]
  /** Idem, Orçamento de todas as unidades (`useOrcamentoTodasUnidades`). */
  orcamentosTodasUnidades: OrcamentoLinha[]
  /** Unidades operacionais (sem AMBEV) — mesma lista que a aba Unidade já usa no filtro. */
  unidades: Unidade[]
  /** Negócio selecionado no filtro (CONS/ROTA/ARM) — compartilhado com a aba Unidade, agora vale pras duas abas. */
  negocio: string
  ano: number
  mes: number
}

/**
 * Aba "Corporativo" de Análise Detalhada > Pacote de Gente — compara TODAS as
 * unidades ao mesmo tempo, no negócio selecionado no filtro. Os 3 cards do
 * topo são sempre o Pacote de Gente total (159): Orçado e Realizado (R$ e %)
 * lêem a linha da própria unidade AMBEV — que no GInfo já É o consolidado de
 * todas as unidades, não uma soma calculada aqui — enquanto o Desvio continua
 * vindo da soma das unidades (`somarLinhas`), servindo de conferência visual
 * entre o número "oficial" da AMBEV e a soma bottom-up das unidades. Igual ao
 * resto do app, é "acumulado": soma Jan até o mês selecionado no filtro.
 *
 * Abaixo dos cards, uma tabela de acompanhamento mês a mês (Orçamento ×
 * Remunerado × Realizado, Jan-Dez) também da linha AMBEV, a tabela
 * comparativa por unidade (ordenável, com toggle Orçado/Remunerado), e a
 * seção "Análise por Conta — AMBEV" (`SecaoAberturaContaAmbev`) — as mesmas
 * 2 tabelas lado a lado ("Demais Contas"/"Encargos", com todas as folhas e
 * o seletor Consolidado/Operacional/ADM) que `SlidePacoteDeGenteGerentes.tsx`
 * mostra pra uma unidade só, aqui com os dados já consolidados da AMBEV.
 *
 * Depois, uma seção por sub-pacote, no mesmo formato da aba Unidade (cards +
 * tabela), só que a tabela mostra TODAS as unidades (uma linha por unidade)
 * em vez de meses. Encargos, Gastos com Vales, Gastos com Benefícios e
 * Gastos Contratação/Demissão também ganham uma tabela extra de
 * acompanhamento mensal por conta específica (`TabelaMensalContaPorUnidade`),
 * já que ali o interessante é abrir a conta-mãe nas folhas, não só comparar
 * o pacote inteiro entre unidades (Gastos com Benefícios fica sem as 3
 * folhas administrativas sem par operacional — 177/179/182 — nesse
 * seletor específico; ver `ITENS_BENEFICIOS`). Por ora Salários/Encargos/
 * Gastos com Vales/Gastos com Benefícios/Gastos Contratação-Demissão estão
 * implementadas — Segurança entra depois, mesmo padrão.
 */
export function PacoteDeGenteCorporativo({ rowsTodasUnidades, orcamentosTodasUnidades, unidades, negocio, ano, mes }: Props) {
  const { contas } = useContas()
  const nomesConta = useMemo(() => new Map(contas.map(c => [c.codigo, c.descricao])), [contas])

  const rowsFiltrado = useMemo(() => rowsTodasUnidades.filter(r => r.negocio === negocio), [rowsTodasUnidades, negocio])
  const orcamentosFiltrado = useMemo(() => orcamentosTodasUnidades.filter(o => o.negocio === negocio), [orcamentosTodasUnidades, negocio])

  const linhasPacoteGente = useMemo(
    () => calcularComparativoPorUnidade('159', rowsFiltrado, orcamentosFiltrado, unidades, ano, mes),
    [rowsFiltrado, orcamentosFiltrado, unidades, ano, mes],
  )
  // Mesmas linhas, acumulado só até o mês anterior — usado pra derivar o
  // "realizado do mês isolado" nas seções de sub-pacote (Impacto % no Pacote
  // de Gente, card "Mês"), sem duplicar a lógica de busca.
  const linhasPacoteGenteMesAnterior = useMemo(
    () => mes === 1 ? linhasPacoteGente : calcularComparativoPorUnidade('159', rowsFiltrado, orcamentosFiltrado, unidades, ano, mes - 1),
    [rowsFiltrado, orcamentosFiltrado, unidades, ano, mes, linhasPacoteGente],
  )
  const totalPacoteGente = useMemo(() => somarLinhas(linhasPacoteGente), [linhasPacoteGente])
  const desvioRs = desvioDe(totalPacoteGente, 'orcado')
  const desvioPercent = desvioPercentDe(totalPacoteGente, 'orcado')

  // Tabela "Pacote de Gente por unidade" mostra o mês selecionado isolado —
  // `linhasPacoteGente`/`linhasPacoteGenteMesAnterior` continuam acumuladas,
  // usadas pelos cards e como base de % das seções de sub-pacote abaixo.
  const linhasPacoteGenteDoMes = useMemo(
    () => linhasIsoladas(linhasPacoteGente, linhasPacoteGenteMesAnterior, mes === 1),
    [linhasPacoteGente, linhasPacoteGenteMesAnterior, mes],
  )

  const linhaAmbev = useMemo(
    () => calcularComparativoPorUnidade('159', rowsFiltrado, orcamentosFiltrado, [UNIDADE_AMBEV], ano, mes)[0],
    [rowsFiltrado, orcamentosFiltrado, ano, mes],
  )
  // Orçado agora é % orçado × receita REALIZADA (ver `orcadoAcumulado` na
  // lib) — então o "% orçado" do card divide pela MESMA receita realizada
  // (não pela receita orçada do cenário original, que deixou de ter papel
  // nenhum nesse cálculo).
  const percentualOrcadoAmbev = percentualDeReceita(linhaAmbev.orcado, linhaAmbev.receitaRealizada)
  const percentualRealizadoAmbev = percentualDeReceita(linhaAmbev.realizado, linhaAmbev.receitaRealizada)

  const rowsAmbevAno = useMemo(() => rowsFiltrado.filter(r => r.unidade === 'AMBEV' && r.ano === ano), [rowsFiltrado, ano])
  const orcamentosAmbevAno = useMemo(() => orcamentosFiltrado.filter(o => o.unidade === 'AMBEV' && o.ano === ano), [orcamentosFiltrado, ano])

  return (
    <div className="flex flex-col gap-5">
      <CardsOrcadoRealizadoDesvio
        sufixoTitulo="AMBEV"
        orcadoRs={linhaAmbev.orcado} percentualOrcado={percentualOrcadoAmbev}
        realizadoRs={linhaAmbev.realizado} percentualRealizado={percentualRealizadoAmbev}
        desvioRs={desvioRs} desvioPercent={desvioPercent}
      />

      <TabelaMensalPacoteGenteAmbev
        rowsAmbevAno={rowsAmbevAno} orcamentosAmbevAno={orcamentosAmbevAno} negocio={negocio} ano={ano} mes={mes}
      />

      <TabelaComparativoUnidades
        linhas={linhasPacoteGenteDoMes}
        titulo="Pacote de Gente por unidade"
        subtitulo={`Orçado/Remunerado × Realizado — resultado de ${MES_ABREV[mes]}/${ano} · clique numa coluna pra ordenar`}
      />

      <SecaoAberturaContaAmbev
        rowsFiltrado={rowsFiltrado} orcamentosFiltrado={orcamentosFiltrado} unidades={unidades} negocio={negocio} ano={ano} mes={mes}
        nomesConta={nomesConta}
      />

      <SecaoSubPacote
        chave="036" titulo="Salários" tituloSeparador="SALÁRIOS" comSegmento baseTabelaInicial="orcado" comTabelaMensalPorUnidade
        rowsFiltrado={rowsFiltrado} orcamentosFiltrado={orcamentosFiltrado} unidades={unidades} ano={ano} mes={mes}
        linhasPacoteGenteAcumulado={linhasPacoteGente} linhasPacoteGenteAcumuladoAnterior={linhasPacoteGenteMesAnterior}
      />

      <SecaoSubPacote
        chave="038" titulo="Encargos" tituloSeparador="ENCARGOS" comSegmento baseTabelaInicial="remunerado"
        rowsFiltrado={rowsFiltrado} orcamentosFiltrado={orcamentosFiltrado} unidades={unidades} ano={ano} mes={mes}
        linhasPacoteGenteAcumulado={linhasPacoteGente} linhasPacoteGenteAcumuladoAnterior={linhasPacoteGenteMesAnterior}
      />
      <TabelaMensalContaPorUnidade
        titulo="Encargos" itens={ITENS_ENCARGOS} codigoPadrao={CODIGO_ENCARGOS_PADRAO} comSegmento
        rowsFiltrado={rowsFiltrado} unidades={unidades} ano={ano} mes={mes} nomesConta={nomesConta}
      />

      <SecaoVales
        rowsFiltrado={rowsFiltrado} unidades={unidades} ano={ano} mes={mes}
        linhasPacoteGenteAcumulado={linhasPacoteGente} linhasPacoteGenteAcumuladoAnterior={linhasPacoteGenteMesAnterior}
      />
      <TabelaMensalContaPorUnidade
        titulo="Gastos com Vales" itens={ITENS_GASTOS_COM_VALES} codigoPadrao={CODIGO_GASTOS_COM_VALES_PADRAO} metrica="diferenca"
        rowsFiltrado={rowsFiltrado} unidades={unidades} ano={ano} mes={mes} nomesConta={nomesConta}
      />

      <SecaoSubPacote
        chave="056" titulo="Gastos com Benefícios" tituloSeparador="GASTOS COM BENEFÍCIOS" comSegmento baseTabelaInicial="orcado"
        rowsFiltrado={rowsFiltrado} orcamentosFiltrado={orcamentosFiltrado} unidades={unidades} ano={ano} mes={mes}
        linhasPacoteGenteAcumulado={linhasPacoteGente} linhasPacoteGenteAcumuladoAnterior={linhasPacoteGenteMesAnterior}
      />
      <TabelaMensalContaPorUnidade
        titulo="Gastos com Benefícios" itens={ITENS_BENEFICIOS} codigoPadrao={CODIGO_BENEFICIOS_PADRAO} comSegmento
        rowsFiltrado={rowsFiltrado} unidades={unidades} ano={ano} mes={mes} nomesConta={nomesConta}
      />

      <SecaoSubPacote
        chave="069" titulo="Gastos Contratação/Demissão" tituloSeparador="GASTOS CONTRATAÇÃO/DEMISSÃO" comSegmento baseTabelaInicial="remunerado"
        rowsFiltrado={rowsFiltrado} orcamentosFiltrado={orcamentosFiltrado} unidades={unidades} ano={ano} mes={mes}
        linhasPacoteGenteAcumulado={linhasPacoteGente} linhasPacoteGenteAcumuladoAnterior={linhasPacoteGenteMesAnterior}
      />
      <TabelaMensalContaPorUnidade
        titulo="Gastos Contratação/Demissão" itens={ITENS_CONTRATACAO_DEMISSAO} codigoPadrao={CODIGO_CONTRATACAO_DEMISSAO_PADRAO} comSegmento
        rowsFiltrado={rowsFiltrado} unidades={unidades} ano={ano} mes={mes} nomesConta={nomesConta}
      />

      <SecaoSeguranca
        rowsFiltrado={rowsFiltrado} orcamentosFiltrado={orcamentosFiltrado} unidades={unidades} ano={ano} mes={mes}
      />
      <TabelaMensalContaPorUnidade
        titulo="Segurança" itens={ITENS_SEGURANCA} codigoPadrao={CODIGO_SEGURANCA_PADRAO} comSegmento
        rowsFiltrado={rowsFiltrado} unidades={unidades} ano={ano} mes={mes} nomesConta={nomesConta}
      />
    </div>
  )
}
