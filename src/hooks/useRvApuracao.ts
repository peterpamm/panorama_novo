import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import type { RvIndicadorDre } from '@/lib/constants'
import { RV_DISTRIBUICAO_DRE } from '@/lib/constants'
import type { TabelaPesosDre } from '@/components/metas/PesosDreCard'
import { avrPorPrefixo, calcularSemaforo, mesesAtivosNoAno, normalizarParaCalculo } from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { menorMelhor, negocioCompativel, negocioDreDaPessoa, unidadeSplitNegocio } from '@/lib/rv-gente'
import { negocioPorPrefixo, normalizarNomeUnidade, resolverUnidade } from '@/lib/unidade-resolver'
import { formatarMinutosComoDuracao } from '@/lib/duracao'
import { formatarResultado } from '@/lib/reuniao-resultados'
import { OPERACOES_ARMAZEM_T1 } from '@/lib/armazem-tiers'
import { OPERACOES_FROTA_MANUTENCAO, resolverUnidadesFrotaT1 } from '@/lib/rv-frota-t1'
import { buscarAjusteFinanceiro, mapaAjustesFinanceiro } from '@/lib/financeiro-dre-ajustes'
import { useToast } from '@/components/ui/use-toast'
import type { DtoT1Meta, DtoT2Meta, ExcessoVelocidadeMeta, FaiMeta, FinanceiroDreAjuste, FinanceiroDreAjusteIndicador, GsdMeta, LogonMeta, MetaArmazemEfc, MetaArmazemPresenteismoAl, MetaArmazemQuebras, MetaArmazemRefugo, MetaArmazemT1DisponibilidadeGente, MetaArmazemT1PresenteismoAl, MetaArmazemT1Quebras, MetaArmazemT1Tma, MetaArmazemTma, MetaDevolucao, MetaGente, MetaPerdaIndicador, MetaPresenteismoDu, PainelPerdasAux, PesoDistribuicaoFuncao, ResultadoAdChecklistFrota, ResultadoAdMilimetragemFrota, ResultadoArmazemBi, ResultadoArmazemQuebras, ResultadoArmazemT1Bi, ResultadoDescontoCivf, ResultadoDescontoStressTest, ResultadoDispEmpilhadeiraFrota, ResultadoDistribuicaoBi, ResultadoDtoT1, ResultadoDtoT2, ResultadoExcessoVelocidade, ResultadoFai, ResultadoGente, ResultadoGsd, ResultadoIndispManutencaoFrota, ResultadoLogon, ResultadoTri, ReuniaoIndicador, ReuniaoResultadoMensal, RvFrotaAdChecklistMeta, RvFrotaAdMilimetragemMeta, RvFrotaDispEmpilhadeiraMeta, RvFrotaIndispManutencaoMeta, RvLideranca, TriMeta } from '@/types'

export const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtPeso(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export function fmtValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtContagem(v: number): string {
  return Math.round(v).toLocaleString('pt-BR')
}

export type StatusItem = 'bateu' | 'perdeu' | 'pendente'

export interface ItemApuracao {
  chave: string
  rotulo: string
  peso: number
  status: StatusItem
  detalhe: string
  /** Meta já formatada (ex: "90,00%", "R$ 1.500,00", "01:40") — null quando não tem meta cadastrada/importada. Usado na aba "Por Indicador" do Painel Geral (tabela simples pra imprimir/printar). */
  metaFmt: string | null
  /** Resultado já formatado, mesma ideia do metaFmt — null quando não tem resultado importado/cadastrado pro mês. */
  resultadoFmt: string | null
  /** Presente só nos itens Multas/Vales do Financeiro — contexto pra UI renderizar o popup de ajuste manual (ver `AjusteManualDreDialog`). undefined = item não é ajustável. */
  ajusteFinanceiro?: { indicador: FinanceiroDreAjusteIndicador; unidade: string; mes: number; ajusteAtual: FinanceiroDreAjuste | undefined; valorAutomatico: number | null }
}

export interface LinhaApuracao {
  pessoa: RvLideranca
  unidadeOk: boolean
  itens: ItemApuracao[]
  pctPossivel: number
  pctConquistado: number
  aReceber: number
}

export interface RvApuracaoProps {
  /** Nome do setor exibido no card (ex: "RH", "FINANCEIRO"). */
  setorLabel: string
  /** Filtro de setor sobre o cadastro de lideranças (ex: ehSetorRh). */
  ehDoSetor: (setor: string) => boolean
  /** Indicadores com origem no DRE do setor (RV_GENTE_DRE, RV_FINANCEIRO_DRE...) — setores sem indicador do DRE (ex: Distribuição) deixam de fora. */
  indicadoresDre?: RvIndicadorDre[]
  /** Tabela dos pesos dos indicadores do DRE — só precisa quando indicadoresDre não é vazio. */
  tabelaPesos?: TabelaPesosDre
  /** Inclui os indicadores do BI (metas_gente × resultados_gente) — só a RV de Gente usa. */
  incluirIndicadoresBi?: boolean
  /** Inclui o indicador DTO T2 (resultados_dto_t2 × rv_dto_t2_meta, meta e peso únicos) — só a RV de Segurança usa. */
  incluirDtoT2?: boolean
  /** Inclui o indicador DTO T1 (resultados_dto_t1 × rv_dto_t1_meta, meta e peso por unidade) — só a RV de Segurança usa. */
  incluirDtoT1?: boolean
  /** Inclui o indicador GSD (resultados_gsd × rv_gsd_meta, meta e peso únicos) — só a RV de Segurança usa. */
  incluirGsd?: boolean
  /** Inclui o indicador LogOn (resultados_logon × rv_logon_meta, meta e peso únicos) — só a RV de Segurança usa. */
  incluirLogon?: boolean
  /** Inclui o indicador Excesso de Velocidade (resultados_excesso_velocidade × rv_excesso_velocidade_meta, meta e peso por unidade) — só a RV de Segurança usa. */
  incluirExcessoVelocidade?: boolean
  /** Inclui o indicador FAI (resultados_fai × rv_fai_meta, meta e peso por unidade — só ESTÂNCIA e CDR BAHIA) — só a RV de Segurança usa. */
  incluirFai?: boolean
  /** Inclui o indicador TRI (resultados_tri × rv_tri_meta, meta e peso únicos, vale pra todas as unidades) — só a RV de Segurança usa. */
  incluirTri?: boolean
  /**
   * Inclui o indicador Indisponibilidade (painel_perdas_aux, mesmo dado pras
   * duas) × meta+peso em R$ — a tabela escolhida decide de quem é o peso.
   * Distribuição usa 'rv_indisponibilidade_meta' (peso por função, vem de
   * rv_distribuicao_peso_funcao — o peso da própria tabela fica sem uso);
   * Empurrada usa 'rv_empurrada_indisponibilidade_meta' (peso único, direto
   * da tabela).
   */
  indisponibilidadeTabela?: 'rv_indisponibilidade_meta' | 'rv_empurrada_indisponibilidade_meta'
  /**
   * Inclui o indicador Vales (DRE contas 052/053 × % configurável da Meta de
   * Perdas de Vales — metas_perdas_indicadores, anual/12) — Distribuição e
   * Financeiro usam, cada um com sua própria tabela de peso/%. Independente
   * do negócio. Na Distribuição, o peso é por função e só existe pra
   * SUPERVISOR DU — não conta pra COORD. DU.
   */
  valesPerdasTabela?: 'rv_vales_distribuicao_meta' | 'rv_vales_financeiro_meta'
  /**
   * Ajustes manuais TEMPORÁRIOS de Multas/Vales do Financeiro (bug do DRE
   * que não soma a receita de multas/vales que a unidade recebeu da Ambev —
   * ver `FinanceiroDreAjuste`, types/index.ts) — só o setor Financeiro usa
   * (indicador DRE id 'MULTAS' e `valesPerdasTabela ===
   * 'rv_vales_financeiro_meta'`); nos demais setores esse prop não faz nada.
   * Quem busca a lista é a página (RvFinanceiroPage/PainelGeralRvPage via
   * `useFinanceiroDreAjustes`), não o hook.
   */
  ajustesFinanceiro?: FinanceiroDreAjuste[]
  /** Inclui o indicador GTY (nome/nome_t1 'GTY' da Reunião Resultados, setor Distribuição, fonte='importado') × rv_empurrada_gty_meta (peso único) — só a RV de Empurrada usa. Resultado/meta já vêm importados na Reunião Resultados, sem reimportar aqui. */
  incluirGty?: boolean
  /** Inclui o indicador TMV (nome/nome_t1 'TMV' da Reunião Resultados) × rv_empurrada_tmv_meta (peso único) — só a RV de Empurrada usa. */
  incluirTmv?: boolean
  /** Inclui o indicador Tempo de Rendição (nome/nome_t1 'TEMPO RENDIÇÃO' da Reunião Resultados) × rv_empurrada_rendicao_meta (peso único) — só a RV de Empurrada usa. */
  incluirTempoRendicao?: boolean
  /**
   * Inclui o indicador Avaria de Transporte — só a RV de Empurrada usa. Mesmo
   * resultado do indicador Vales (DRE contas 052/053, independente do
   * negócio), mas com meta direta em R$ (rv_empurrada_avaria_transporte_meta)
   * em vez de % da Meta de Perdas anual — diferente do mecanismo de
   * `valesPerdasTabela` usado por Distribuição/Financeiro.
   */
  incluirAvariaTransporte?: boolean
  /**
   * Inclui o indicador Pacote de Gente da Distribuição (158, contas 158+033,
   * negócio ROTA sempre — mesma regra que antes vinha de indicadoresDre) —
   * só a RV de Distribuição usa. Peso vem de rv_distribuicao_peso_funcao
   * (por função da liderança — só conta pra COORD. DU, sem peso cadastrado
   * pra SUPERVISOR DU), a meta continua a do Farol.
   */
  incluirPacoteGenteDu?: boolean
  /** Inclui o indicador LogOn DU (resultados_distribuicao_bi × rv_logon_du_meta) — só a RV de Distribuição usa. Quanto maior melhor. Peso por função — sem linha pra SUPERVISOR DU, então não conta pra essa função. */
  incluirLogonDu?: boolean
  /** Inclui o indicador Devolução (resultados_distribuicao_bi × rv_devolucao_meta por unidade) — só a RV de Distribuição usa. Quanto menor melhor. Peso por função. */
  incluirDevolucao?: boolean
  /** Inclui o indicador Presenteísmo DU (metas_presenteismo_du por unidade/mês, importada todo mês; resultado de resultados_distribuicao_bi) — só a RV de Distribuição usa. Quanto menor melhor. Peso por função. */
  incluirPresenteismoDu?: boolean
  /** Inclui o indicador Desconto CIVF (resultados_desconto_civf × rv_desconto_civf_meta, meta e peso únicos em R$) — só a RV de Frota usa. Quanto menor melhor (desconto é uma penalidade). */
  incluirDescontoCivf?: boolean
  /** Inclui o indicador Desconto Stress Test (resultados_desconto_stress_test × rv_desconto_stress_test_meta, meta e peso únicos em R$) — só a RV de Frota usa. Quanto menor melhor (desconto é uma penalidade). */
  incluirDescontoStressTest?: boolean
  /**
   * Inclui os 5 indicadores novos da RV de Frota, específicos das 3
   * lideranças T1 (Estância, Ponta Grossa e CDR Bahia — ver
   * `OPERACOES_FROTA_T1`, rv-frota-t1.ts): Custos Gerais (DRE 113, AVR),
   * Aderência ao Checklist, Aderência à Milimetragem, Indisponibilidade
   * Manutenção (as 3 em %, resultado importado) e Disponibilidade
   * Empilhadeira (R$, resultado importado). Meta e peso por unidade — quem
   * não tem linha de meta cadastrada pra aquele indicador simplesmente não
   * participa, sem checagem de unidade explícita no código (mesmo padrão do
   * FAI/DTO T1). Só a RV de Frota usa.
   */
  incluirFrotaT1?: boolean
  /** Inclui o indicador EFC do Armazém T2 (resultados_armazem_bi × rv_armazem_efc_meta por unidade + rv_armazem_efc_peso único) — só a RV de Armazém usa. Quanto maior melhor. */
  incluirArmazemEfc?: boolean
  /** Inclui o indicador TMA do Armazém T2 (resultados_armazem_bi × rv_armazem_tma_meta por unidade, em minutos + rv_armazem_tma_peso único) — só a RV de Armazém usa. Quanto menor melhor. */
  incluirArmazemTmaT2?: boolean
  /** Inclui o indicador Presenteísmo AL do Armazém T2 (resultados_armazem_bi × metas_armazem_presenteismo_al por unidade/mês + rv_armazem_presenteismo_al_peso único) — só a RV de Armazém usa. Quanto menor melhor. */
  incluirArmazemPresenteismoAlT2?: boolean
  /** Inclui o indicador Refugo do Armazém T2 (resultados_armazem_bi × rv_armazem_refugo_meta, meta e peso únicos) — só a RV de Armazém usa. Quanto menor melhor. */
  incluirArmazemRefugo?: boolean
  /** Inclui o indicador TMA do Armazém T1 (resultados_armazem_t1_bi × metas_armazem_t1_tma por unidade/mês, em minutos + rv_armazem_t1_tma_peso único) — cadastro separado do TMA do T2, só a RV de Armazém usa. Quanto menor melhor. */
  incluirArmazemTmaT1?: boolean
  /** Inclui o indicador Disponibilidade de Gente do Armazém T1 (resultados_armazem_t1_bi × metas_armazem_t1_disponibilidade_gente por unidade/mês + rv_armazem_t1_disponibilidade_gente_peso único) — só a RV de Armazém usa. Quanto maior melhor. */
  incluirArmazemDisponibilidadeGenteT1?: boolean
  /** Inclui o indicador Presenteísmo AL do Armazém T1 (resultados_armazem_t1_bi × metas_armazem_t1_presenteismo_al por unidade/mês + rv_armazem_t1_presenteismo_al_peso único) — cadastro separado do Presenteísmo AL do T2, só a RV de Armazém usa. Quanto menor melhor. */
  incluirArmazemPresenteismoAlT1?: boolean
  /**
   * Inclui o indicador Quebras do Armazém (resultados_armazem_quebras, cadastro
   * manual — não vem de planilha) — só a RV de Armazém usa. Resultado é
   * compartilhado entre T2 e T1, mas a meta/peso vem de rv_armazem_quebras_meta
   * (unidades do T2) ou rv_armazem_t1_quebras_meta (Estância/CDR Bahia).
   * Quanto menor melhor (R$).
   */
  incluirArmazemQuebras?: boolean
  /** Restringe a apuração só às lideranças cuja operação resolve pra essa unidade — usado pelo Painel Geral (visão por unidade). */
  filtrarUnidade?: string
  /** Restringe a apuração só às lideranças cuja OPERAÇÃO comece com CDL (ROTA) ou CDR (ARM) — unidades com 2 gerentes (ex: Camaçari) usam isso pra um não ver quanto o outro recebe. Casa pelo prefixo da operação (`negocioPorPrefixo`), não pelo campo `negocio` da liderança — esse pode ser 'CONS' por causa de como o resultado da RV dela é calculado, sem relação com de qual gerente ela é. */
  filtrarNegocio?: string
  /** Ano forçado de fora (ex: seletor compartilhado do Painel Geral) — quando ausente, usa o auto-detectado internamente (comportamento padrão). */
  anoForcado?: string
  /** Mês forçado de fora — mesma ideia do anoForcado. */
  mesForcado?: string
}

export interface UseRvApuracaoResultado {
  liderancas: RvLideranca[]
  linhas: LinhaApuracao[]
  anosDisponiveis: number[]
  verAno: string
  setVerAno: (v: string) => void
  verMes: string
  setVerMes: (v: string) => void
  filtroOperacao: string
  setFiltroOperacao: (v: string) => void
  operacoesDisponiveis: string[]
  carregandoTudo: boolean
  totalBase: number
  totalReceber: number
}

/**
 * Apuração da RV de um setor: pra cada liderança do setor, cruza os
 * indicadores do mês — os do BI (metas_gente × resultados_gente da sua
 * operação/negócio, quando o setor usa) e os do DRE (indicadoresDre × pesos
 * de tabelaPesos) — soma os pesos dos indicadores batidos e aplica sobre o
 * valor de RV da pessoa. Indicador sem resultado/meta fica pendente e não soma.
 * Extraído do componente RvApuracao pra ser reaproveitado pelo Painel Geral
 * (visão por unidade, agregando vários setores de uma vez).
 */
export function useRvApuracao({
  ehDoSetor, indicadoresDre = [], tabelaPesos, incluirIndicadoresBi = false, incluirDtoT2 = false, incluirDtoT1 = false, incluirGsd = false, incluirLogon = false, incluirExcessoVelocidade = false, incluirFai = false, incluirTri = false, indisponibilidadeTabela, valesPerdasTabela, ajustesFinanceiro = [], incluirGty = false, incluirTmv = false, incluirTempoRendicao = false, incluirAvariaTransporte = false, incluirPacoteGenteDu = false, incluirLogonDu = false, incluirDevolucao = false, incluirPresenteismoDu = false, incluirDescontoCivf = false, incluirDescontoStressTest = false, incluirFrotaT1 = false, incluirArmazemEfc = false, incluirArmazemTmaT2 = false, incluirArmazemPresenteismoAlT2 = false, incluirArmazemRefugo = false, incluirArmazemTmaT1 = false, incluirArmazemDisponibilidadeGenteT1 = false, incluirArmazemPresenteismoAlT1 = false, incluirArmazemQuebras = false, filtrarUnidade, filtrarNegocio, anoForcado, mesForcado,
}: RvApuracaoProps): UseRvApuracaoResultado {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const { rows: rowsDre, loading: loadingDre } = useDreLongoTodasUnidades()
  const { orcamentos, loading: loadingOrcamento } = useOrcamentoTodasUnidades()
  const mapaAjustesFin = useMemo(() => mapaAjustesFinanceiro(ajustesFinanceiro), [ajustesFinanceiro])
  const estanciaCodigo = useMemo(() => resolverUnidade('ESTÂNCIA', unidades)?.codigo, [unidades])
  const armazemT1Codigos = useMemo(
    () => new Set(OPERACOES_ARMAZEM_T1.map(nome => resolverUnidade(nome, unidades)?.codigo).filter((c): c is string => !!c)),
    [unidades],
  )
  const frotaManutencaoCodigos = useMemo(
    () => new Set(resolverUnidadesFrotaT1(OPERACOES_FROTA_MANUTENCAO, unidades).map(u => u.codigo)),
    [unidades],
  )
  // CDR Bahia é só o lado ARM de Camaçari — o CDL Camaçari-Internalização
  // (ROTA) é T2, mesmo tendo o mesmo `unidade.codigo` do CDR Bahia. Por isso
  // "é T1 de Frota" não dá pra checar só pelo código da unidade, tem que
  // conferir o negócio da própria liderança também (ver `ehFrotaT1` abaixo).
  const cdrBahiaCodigo = useMemo(() => resolverUnidade('CDR BAHIA', unidades)?.codigo, [unidades])
  function ehFrotaT1(unidadeCodigo: string, negocioPessoa: string): boolean {
    if (cdrBahiaCodigo && unidadeCodigo === cdrBahiaCodigo) return negocioPessoa === 'ARM'
    return frotaManutencaoCodigos.has(unidadeCodigo)
  }
  const incluirArmazemBi = incluirArmazemEfc || incluirArmazemTmaT2 || incluirArmazemPresenteismoAlT2 || incluirArmazemRefugo
  const incluirArmazemT1Bi = incluirArmazemTmaT1 || incluirArmazemDisponibilidadeGenteT1 || incluirArmazemPresenteismoAlT1

  const [liderancas, setLiderancas] = useState<RvLideranca[]>([])
  const [metas, setMetas] = useState<MetaGente[]>([])
  const [resultados, setResultados] = useState<ResultadoGente[]>([])
  const [pesosDre, setPesosDre] = useState<Map<string, number>>(new Map())
  const [resultadosDtoT2, setResultadosDtoT2] = useState<ResultadoDtoT2[]>([])
  const [dtoT2Meta, setDtoT2Meta] = useState<DtoT2Meta | null>(null)
  const [resultadosDescontoCivf, setResultadosDescontoCivf] = useState<ResultadoDescontoCivf[]>([])
  const [descontoCivfMeta, setDescontoCivfMeta] = useState<{ meta_valor: number; peso: number } | null>(null)
  const [resultadosDescontoStressTest, setResultadosDescontoStressTest] = useState<ResultadoDescontoStressTest[]>([])
  const [descontoStressTestMeta, setDescontoStressTestMeta] = useState<{ meta_valor: number; peso: number } | null>(null)
  // Indicadores novos da RV de Frota (T1 — Estância/Ponta Grossa/CDR Bahia).
  // Custos Gerais (DRE 113) não tem estado próprio aqui — peso vem de
  // `pesosDre` (mesma tabela de Manutenção/Pneus/Diesel) e meta de
  // `orcamentos`, igual os demais indicadores de DRE.
  // Meta e peso são únicos por indicador (migration 108), não por unidade.
  const [adChecklistMeta, setAdChecklistMeta] = useState<RvFrotaAdChecklistMeta | null>(null)
  const [resultadosAdChecklist, setResultadosAdChecklist] = useState<ResultadoAdChecklistFrota[]>([])
  const [adMilimetragemMeta, setAdMilimetragemMeta] = useState<RvFrotaAdMilimetragemMeta | null>(null)
  const [resultadosAdMilimetragem, setResultadosAdMilimetragem] = useState<ResultadoAdMilimetragemFrota[]>([])
  const [indispManutencaoMeta, setIndispManutencaoMeta] = useState<RvFrotaIndispManutencaoMeta | null>(null)
  const [resultadosIndispManutencao, setResultadosIndispManutencao] = useState<ResultadoIndispManutencaoFrota[]>([])
  const [dispEmpilhadeiraMeta, setDispEmpilhadeiraMeta] = useState<RvFrotaDispEmpilhadeiraMeta | null>(null)
  const [resultadosDispEmpilhadeira, setResultadosDispEmpilhadeira] = useState<ResultadoDispEmpilhadeiraFrota[]>([])
  const [resultadosDtoT1, setResultadosDtoT1] = useState<ResultadoDtoT1[]>([])
  const [dtoT1Metas, setDtoT1Metas] = useState<Map<string, DtoT1Meta>>(new Map())
  const [resultadosGsd, setResultadosGsd] = useState<ResultadoGsd[]>([])
  const [gsdMeta, setGsdMeta] = useState<GsdMeta | null>(null)
  const [resultadosLogon, setResultadosLogon] = useState<ResultadoLogon[]>([])
  const [logonMeta, setLogonMeta] = useState<LogonMeta | null>(null)
  const [resultadosExcessoVelocidade, setResultadosExcessoVelocidade] = useState<ResultadoExcessoVelocidade[]>([])
  const [excessoVelocidadeMetas, setExcessoVelocidadeMetas] = useState<Map<string, ExcessoVelocidadeMeta>>(new Map())
  const [resultadosFai, setResultadosFai] = useState<ResultadoFai[]>([])
  const [faiMetas, setFaiMetas] = useState<Map<string, FaiMeta>>(new Map())
  const [resultadosTri, setResultadosTri] = useState<ResultadoTri[]>([])
  const [triMeta, setTriMeta] = useState<TriMeta | null>(null)
  const [resultadosIndisponibilidade, setResultadosIndisponibilidade] = useState<PainelPerdasAux[]>([])
  const [indisponibilidadeMeta, setIndisponibilidadeMeta] = useState<{ meta_valor: number; peso?: number } | null>(null)
  const [metasPerdasVales, setMetasPerdasVales] = useState<MetaPerdaIndicador[]>([])
  const [valesMeta, setValesMeta] = useState<{ peso?: number; pct_meta: number } | null>(null)
  const [indicadoresImportadosDistribuicao, setIndicadoresImportadosDistribuicao] = useState<ReuniaoIndicador[]>([])
  const [resultadosImportadosDistribuicao, setResultadosImportadosDistribuicao] = useState<ReuniaoResultadoMensal[]>([])
  const [gtyPeso, setGtyPeso] = useState<number | null>(null)
  const [tmvPeso, setTmvPeso] = useState<number | null>(null)
  const [rendicaoPeso, setRendicaoPeso] = useState<number | null>(null)
  const [avariaTransporteMeta, setAvariaTransporteMeta] = useState<{ meta_valor: number; peso: number } | null>(null)
  const [resultadosDistribuicaoBi, setResultadosDistribuicaoBi] = useState<ResultadoDistribuicaoBi[]>([])
  const [logonDuMeta, setLogonDuMeta] = useState<{ meta_pct: number } | null>(null)
  const [devolucaoMetas, setDevolucaoMetas] = useState<Map<string, number>>(new Map())
  const [presenteismoDuMetas, setPresenteismoDuMetas] = useState<MetaPresenteismoDu[]>([])
  const [pesosPorFuncaoDistribuicao, setPesosPorFuncaoDistribuicao] = useState<Map<string, number>>(new Map())
  const [resultadosArmazemBi, setResultadosArmazemBi] = useState<ResultadoArmazemBi[]>([])
  const [armazemEfcMetas, setArmazemEfcMetas] = useState<Map<string, number>>(new Map())
  const [armazemEfcPeso, setArmazemEfcPeso] = useState<number | null>(null)
  const [armazemTmaT2Metas, setArmazemTmaT2Metas] = useState<Map<string, number>>(new Map())
  const [armazemTmaT2Peso, setArmazemTmaT2Peso] = useState<number | null>(null)
  const [armazemPresenteismoAlT2Metas, setArmazemPresenteismoAlT2Metas] = useState<MetaArmazemPresenteismoAl[]>([])
  const [armazemPresenteismoAlT2Peso, setArmazemPresenteismoAlT2Peso] = useState<number | null>(null)
  const [armazemRefugoMeta, setArmazemRefugoMeta] = useState<MetaArmazemRefugo | null>(null)
  const [resultadosArmazemT1Bi, setResultadosArmazemT1Bi] = useState<ResultadoArmazemT1Bi[]>([])
  const [armazemTmaT1Metas, setArmazemTmaT1Metas] = useState<MetaArmazemT1Tma[]>([])
  const [armazemTmaT1Peso, setArmazemTmaT1Peso] = useState<number | null>(null)
  const [armazemDisponibilidadeGenteT1Metas, setArmazemDisponibilidadeGenteT1Metas] = useState<MetaArmazemT1DisponibilidadeGente[]>([])
  const [armazemDisponibilidadeGenteT1Peso, setArmazemDisponibilidadeGenteT1Peso] = useState<number | null>(null)
  const [armazemPresenteismoAlT1Metas, setArmazemPresenteismoAlT1Metas] = useState<MetaArmazemT1PresenteismoAl[]>([])
  const [armazemPresenteismoAlT1Peso, setArmazemPresenteismoAlT1Peso] = useState<number | null>(null)
  const [armazemQuebrasMeta, setArmazemQuebrasMeta] = useState<MetaArmazemQuebras | null>(null)
  const [armazemT1QuebrasMeta, setArmazemT1QuebrasMeta] = useState<MetaArmazemT1Quebras | null>(null)
  const [resultadosArmazemQuebras, setResultadosArmazemQuebras] = useState<ResultadoArmazemQuebras[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const incluirPesosFuncaoDistribuicao = indisponibilidadeTabela === 'rv_indisponibilidade_meta' || incluirPacoteGenteDu || valesPerdasTabela === 'rv_vales_distribuicao_meta' || incluirLogonDu || incluirDevolucao || incluirPresenteismoDu

      // GTY/TMV/Tempo de Rendição são nomes T1 de indicadores já cadastrados
      // na Reunião Resultados (setor Distribuição) — precisa achar a linha de
      // configuração (id, ano, natureza) antes de poder filtrar
      // reuniao_resultados_mensais por indicador_id (mesmo padrão sequencial
      // de useReuniaoDados.ts: indicadores primeiro, resultados depois).
      const nomesImportados = [
        ...(incluirGty ? ['GTY'] : []),
        ...(incluirTmv ? ['TMV'] : []),
        ...(incluirTempoRendicao ? ['TEMPO RENDIÇÃO'] : []),
      ]
      let indicadoresImportados: ReuniaoIndicador[] = []
      if (nomesImportados.length > 0) {
        const { data, error } = await supabase
          .from('reuniao_resultados_indicadores')
          .select('*')
          .eq('setor', 'distribuicao')
          .eq('ativo', true)
          .or(nomesImportados.map(n => `nome.eq.${n},nome_t1.eq.${n}`).join(','))
        if (error) toast({ title: 'Erro ao carregar indicadores da Reunião Resultados', description: error.message, variant: 'destructive' })
        indicadoresImportados = (data as ReuniaoIndicador[]) ?? []
      }
      const idsImportados = indicadoresImportados.map(i => i.id)

      const [l, p, m, r, rl, ml, rl1, ml1, rg, mg, rlo, mlo, rv, mv, rf, mf, rt, mt, ri, mi, rvd, mvd, rDistBi, mLogonDu, rDevMeta, rPresMeta, rPesosFuncao, rCivf, mCivf, rStressTest, mStressTest, mFrotaAdChecklist, rFrotaAdChecklist, mFrotaAdMilimetragem, rFrotaAdMilimetragem, mFrotaIndispManutencao, rFrotaIndispManutencao, mFrotaDispEmpilhadeira, rFrotaDispEmpilhadeira, rArmBi, mArmEfc, pArmEfc, mArmTmaT2, pArmTmaT2, mArmPresT2, pArmPresT2, mArmRefugo, rArmT1Bi, mArmTmaT1, pArmTmaT1, mArmDispT1, pArmDispT1, mArmPresT1, pArmPresT1, mArmQuebras, mArmT1Quebras, rArmQuebras, rImportados, mGty, mTmv, mRendicao, mAvaria] = await Promise.all([
        supabase.from('rv_liderancas').select('*'),
        tabelaPesos ? supabase.from(tabelaPesos).select('*') : Promise.resolve({ data: [], error: null }),
        incluirIndicadoresBi ? supabase.from('metas_gente').select('*') : Promise.resolve({ data: [], error: null }),
        incluirIndicadoresBi ? supabase.from('resultados_gente').select('*') : Promise.resolve({ data: [], error: null }),
        incluirDtoT2 ? supabase.from('resultados_dto_t2').select('*') : Promise.resolve({ data: [], error: null }),
        incluirDtoT2 ? supabase.from('rv_dto_t2_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirDtoT1 ? supabase.from('resultados_dto_t1').select('*') : Promise.resolve({ data: [], error: null }),
        incluirDtoT1 ? supabase.from('rv_dto_t1_meta').select('*') : Promise.resolve({ data: [], error: null }),
        incluirGsd ? supabase.from('resultados_gsd').select('*') : Promise.resolve({ data: [], error: null }),
        incluirGsd ? supabase.from('rv_gsd_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirLogon ? supabase.from('resultados_logon').select('*') : Promise.resolve({ data: [], error: null }),
        incluirLogon ? supabase.from('rv_logon_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirExcessoVelocidade ? supabase.from('resultados_excesso_velocidade').select('*') : Promise.resolve({ data: [], error: null }),
        incluirExcessoVelocidade ? supabase.from('rv_excesso_velocidade_meta').select('*') : Promise.resolve({ data: [], error: null }),
        incluirFai ? supabase.from('resultados_fai').select('*') : Promise.resolve({ data: [], error: null }),
        incluirFai ? supabase.from('rv_fai_meta').select('*') : Promise.resolve({ data: [], error: null }),
        incluirTri ? supabase.from('resultados_tri').select('*') : Promise.resolve({ data: [], error: null }),
        incluirTri ? supabase.from('rv_tri_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        indisponibilidadeTabela ? supabase.from('painel_perdas_aux').select('*').eq('indicador', 'indisponibilidade') : Promise.resolve({ data: [], error: null }),
        indisponibilidadeTabela ? supabase.from(indisponibilidadeTabela).select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        valesPerdasTabela ? supabase.from('metas_perdas_indicadores').select('*').eq('indicador', 'vales') : Promise.resolve({ data: [], error: null }),
        valesPerdasTabela ? supabase.from(valesPerdasTabela).select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        (incluirLogonDu || incluirDevolucao || incluirPresenteismoDu) ? supabase.from('resultados_distribuicao_bi').select('*') : Promise.resolve({ data: [], error: null }),
        incluirLogonDu ? supabase.from('rv_logon_du_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirDevolucao ? supabase.from('rv_devolucao_meta').select('*') : Promise.resolve({ data: [], error: null }),
        incluirPresenteismoDu ? supabase.from('metas_presenteismo_du').select('*') : Promise.resolve({ data: [], error: null }),
        incluirPesosFuncaoDistribuicao ? supabase.from('rv_distribuicao_peso_funcao').select('*') : Promise.resolve({ data: [], error: null }),
        incluirDescontoCivf ? supabase.from('resultados_desconto_civf').select('*') : Promise.resolve({ data: [], error: null }),
        incluirDescontoCivf ? supabase.from('rv_desconto_civf_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirDescontoStressTest ? supabase.from('resultados_desconto_stress_test').select('*') : Promise.resolve({ data: [], error: null }),
        incluirDescontoStressTest ? supabase.from('rv_desconto_stress_test_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirFrotaT1 ? supabase.from('rv_frota_ad_checklist_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirFrotaT1 ? supabase.from('resultados_ad_checklist_frota').select('*') : Promise.resolve({ data: [], error: null }),
        incluirFrotaT1 ? supabase.from('rv_frota_ad_milimetragem_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirFrotaT1 ? supabase.from('resultados_ad_milimetragem_frota').select('*') : Promise.resolve({ data: [], error: null }),
        incluirFrotaT1 ? supabase.from('rv_frota_indisp_manutencao_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirFrotaT1 ? supabase.from('resultados_indisp_manutencao_frota').select('*') : Promise.resolve({ data: [], error: null }),
        incluirFrotaT1 ? supabase.from('rv_frota_disp_empilhadeira_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirFrotaT1 ? supabase.from('resultados_disp_empilhadeira_frota').select('*') : Promise.resolve({ data: [], error: null }),
        incluirArmazemBi ? supabase.from('resultados_armazem_bi').select('*') : Promise.resolve({ data: [], error: null }),
        incluirArmazemEfc ? supabase.from('rv_armazem_efc_meta').select('*') : Promise.resolve({ data: [], error: null }),
        incluirArmazemEfc ? supabase.from('rv_armazem_efc_peso').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirArmazemTmaT2 ? supabase.from('rv_armazem_tma_meta').select('*') : Promise.resolve({ data: [], error: null }),
        incluirArmazemTmaT2 ? supabase.from('rv_armazem_tma_peso').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirArmazemPresenteismoAlT2 ? supabase.from('metas_armazem_presenteismo_al').select('*') : Promise.resolve({ data: [], error: null }),
        incluirArmazemPresenteismoAlT2 ? supabase.from('rv_armazem_presenteismo_al_peso').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirArmazemRefugo ? supabase.from('rv_armazem_refugo_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirArmazemT1Bi ? supabase.from('resultados_armazem_t1_bi').select('*') : Promise.resolve({ data: [], error: null }),
        incluirArmazemTmaT1 ? supabase.from('metas_armazem_t1_tma').select('*') : Promise.resolve({ data: [], error: null }),
        incluirArmazemTmaT1 ? supabase.from('rv_armazem_t1_tma_peso').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirArmazemDisponibilidadeGenteT1 ? supabase.from('metas_armazem_t1_disponibilidade_gente').select('*') : Promise.resolve({ data: [], error: null }),
        incluirArmazemDisponibilidadeGenteT1 ? supabase.from('rv_armazem_t1_disponibilidade_gente_peso').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirArmazemPresenteismoAlT1 ? supabase.from('metas_armazem_t1_presenteismo_al').select('*') : Promise.resolve({ data: [], error: null }),
        incluirArmazemPresenteismoAlT1 ? supabase.from('rv_armazem_t1_presenteismo_al_peso').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirArmazemQuebras ? supabase.from('rv_armazem_quebras_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirArmazemQuebras ? supabase.from('rv_armazem_t1_quebras_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirArmazemQuebras ? supabase.from('resultados_armazem_quebras').select('*') : Promise.resolve({ data: [], error: null }),
        idsImportados.length > 0 ? supabase.from('reuniao_resultados_mensais').select('*').in('indicador_id', idsImportados) : Promise.resolve({ data: [], error: null }),
        incluirGty ? supabase.from('rv_empurrada_gty_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirTmv ? supabase.from('rv_empurrada_tmv_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirTempoRendicao ? supabase.from('rv_empurrada_rendicao_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
        incluirAvariaTransporte ? supabase.from('rv_empurrada_avaria_transporte_meta').select('*').maybeSingle() : Promise.resolve({ data: null, error: null }),
      ])
      const erro = l.error ?? p.error ?? m.error ?? r.error ?? rl.error ?? ml.error ?? rl1.error ?? ml1.error ?? rg.error ?? mg.error ?? rlo.error ?? mlo.error ?? rv.error ?? mv.error ?? rf.error ?? mf.error ?? rt.error ?? mt.error ?? ri.error ?? mi.error ?? rvd.error ?? mvd.error ?? rDistBi.error ?? mLogonDu.error ?? rDevMeta.error ?? rPresMeta.error ?? rPesosFuncao.error ?? rCivf.error ?? mCivf.error ?? rStressTest.error ?? mStressTest.error
        ?? rArmBi.error ?? mArmEfc.error ?? pArmEfc.error ?? mArmTmaT2.error ?? pArmTmaT2.error ?? mArmPresT2.error ?? pArmPresT2.error ?? mArmRefugo.error
        ?? rArmT1Bi.error ?? mArmTmaT1.error ?? pArmTmaT1.error ?? mArmDispT1.error ?? pArmDispT1.error ?? mArmPresT1.error ?? pArmPresT1.error
        ?? mArmQuebras.error ?? mArmT1Quebras.error ?? rArmQuebras.error ?? rImportados.error ?? mGty.error ?? mTmv.error ?? mRendicao.error ?? mAvaria.error
      if (erro) toast({ title: 'Erro ao carregar dados da apuração', description: erro.message, variant: 'destructive' })
      setLiderancas((l.data as RvLideranca[]) ?? [])
      setMetas((m.data as MetaGente[]) ?? [])
      setResultados((r.data as ResultadoGente[]) ?? [])
      setPesosDre(new Map(((p.data as { codigo: string; peso: number }[]) ?? []).map(x => [x.codigo, Number(x.peso)])))
      setResultadosDtoT2((rl.data as ResultadoDtoT2[]) ?? [])
      setDtoT2Meta(ml.data as DtoT2Meta | null)
      setResultadosDtoT1((rl1.data as ResultadoDtoT1[]) ?? [])
      setDtoT1Metas(new Map(((ml1.data as DtoT1Meta[]) ?? []).map(x => [x.unidade, x])))
      setResultadosGsd((rg.data as ResultadoGsd[]) ?? [])
      setGsdMeta(mg.data as GsdMeta | null)
      setResultadosLogon((rlo.data as ResultadoLogon[]) ?? [])
      setLogonMeta(mlo.data as LogonMeta | null)
      setResultadosExcessoVelocidade((rv.data as ResultadoExcessoVelocidade[]) ?? [])
      setExcessoVelocidadeMetas(new Map(((mv.data as ExcessoVelocidadeMeta[]) ?? []).map(x => [x.unidade, x])))
      setResultadosFai((rf.data as ResultadoFai[]) ?? [])
      setFaiMetas(new Map(((mf.data as FaiMeta[]) ?? []).map(x => [x.unidade, x])))
      setResultadosTri((rt.data as ResultadoTri[]) ?? [])
      setTriMeta(mt.data as TriMeta | null)
      setResultadosIndisponibilidade((ri.data as PainelPerdasAux[]) ?? [])
      setIndisponibilidadeMeta(mi.data as { meta_valor: number } | null)
      setMetasPerdasVales((rvd.data as MetaPerdaIndicador[]) ?? [])
      setValesMeta(mvd.data as { peso?: number; pct_meta: number } | null)
      setResultadosDistribuicaoBi((rDistBi.data as ResultadoDistribuicaoBi[]) ?? [])
      setLogonDuMeta(mLogonDu.data as { meta_pct: number } | null)
      setDevolucaoMetas(new Map(((rDevMeta.data as MetaDevolucao[]) ?? []).map(x => [x.unidade, Number(x.meta_pct)])))
      setPresenteismoDuMetas((rPresMeta.data as MetaPresenteismoDu[]) ?? [])
      setPesosPorFuncaoDistribuicao(new Map(((rPesosFuncao.data as PesoDistribuicaoFuncao[]) ?? []).map(x => [`${x.funcao}|${x.indicador}`, Number(x.peso)])))
      setResultadosDescontoCivf((rCivf.data as ResultadoDescontoCivf[]) ?? [])
      setDescontoCivfMeta(mCivf.data as { meta_valor: number; peso: number } | null)
      setResultadosDescontoStressTest((rStressTest.data as ResultadoDescontoStressTest[]) ?? [])
      setDescontoStressTestMeta(mStressTest.data as { meta_valor: number; peso: number } | null)
      setAdChecklistMeta(mFrotaAdChecklist.data as RvFrotaAdChecklistMeta | null)
      setResultadosAdChecklist((rFrotaAdChecklist.data as ResultadoAdChecklistFrota[]) ?? [])
      setAdMilimetragemMeta(mFrotaAdMilimetragem.data as RvFrotaAdMilimetragemMeta | null)
      setResultadosAdMilimetragem((rFrotaAdMilimetragem.data as ResultadoAdMilimetragemFrota[]) ?? [])
      setIndispManutencaoMeta(mFrotaIndispManutencao.data as RvFrotaIndispManutencaoMeta | null)
      setResultadosIndispManutencao((rFrotaIndispManutencao.data as ResultadoIndispManutencaoFrota[]) ?? [])
      setDispEmpilhadeiraMeta(mFrotaDispEmpilhadeira.data as RvFrotaDispEmpilhadeiraMeta | null)
      setResultadosDispEmpilhadeira((rFrotaDispEmpilhadeira.data as ResultadoDispEmpilhadeiraFrota[]) ?? [])
      setResultadosArmazemBi((rArmBi.data as ResultadoArmazemBi[]) ?? [])
      setArmazemEfcMetas(new Map(((mArmEfc.data as MetaArmazemEfc[]) ?? []).map(x => [x.unidade, Number(x.meta_pct)])))
      setArmazemEfcPeso(pArmEfc.data ? Number((pArmEfc.data as { peso: number }).peso) : null)
      setArmazemTmaT2Metas(new Map(((mArmTmaT2.data as MetaArmazemTma[]) ?? []).map(x => [x.unidade, Number(x.meta_minutos)])))
      setArmazemTmaT2Peso(pArmTmaT2.data ? Number((pArmTmaT2.data as { peso: number }).peso) : null)
      setArmazemPresenteismoAlT2Metas((mArmPresT2.data as MetaArmazemPresenteismoAl[]) ?? [])
      setArmazemPresenteismoAlT2Peso(pArmPresT2.data ? Number((pArmPresT2.data as { peso: number }).peso) : null)
      setArmazemRefugoMeta(mArmRefugo.data as MetaArmazemRefugo | null)
      setResultadosArmazemT1Bi((rArmT1Bi.data as ResultadoArmazemT1Bi[]) ?? [])
      setArmazemTmaT1Metas((mArmTmaT1.data as MetaArmazemT1Tma[]) ?? [])
      setArmazemTmaT1Peso(pArmTmaT1.data ? Number((pArmTmaT1.data as { peso: number }).peso) : null)
      setArmazemDisponibilidadeGenteT1Metas((mArmDispT1.data as MetaArmazemT1DisponibilidadeGente[]) ?? [])
      setArmazemDisponibilidadeGenteT1Peso(pArmDispT1.data ? Number((pArmDispT1.data as { peso: number }).peso) : null)
      setArmazemPresenteismoAlT1Metas((mArmPresT1.data as MetaArmazemT1PresenteismoAl[]) ?? [])
      setArmazemPresenteismoAlT1Peso(pArmPresT1.data ? Number((pArmPresT1.data as { peso: number }).peso) : null)
      setArmazemQuebrasMeta(mArmQuebras.data as MetaArmazemQuebras | null)
      setArmazemT1QuebrasMeta(mArmT1Quebras.data as MetaArmazemT1Quebras | null)
      setResultadosArmazemQuebras((rArmQuebras.data as ResultadoArmazemQuebras[]) ?? [])
      setIndicadoresImportadosDistribuicao(indicadoresImportados)
      setResultadosImportadosDistribuicao((rImportados.data as ReuniaoResultadoMensal[]) ?? [])
      setGtyPeso(mGty.data ? Number((mGty.data as { peso: number }).peso) : null)
      setTmvPeso(mTmv.data ? Number((mTmv.data as { peso: number }).peso) : null)
      setRendicaoPeso(mRendicao.data ? Number((mRendicao.data as { peso: number }).peso) : null)
      setAvariaTransporteMeta(mAvaria.data as { meta_valor: number; peso: number } | null)
      setCarregando(false)
    }
    carregar()
  }, [tabelaPesos, incluirIndicadoresBi, incluirDtoT2, incluirDtoT1, incluirGsd, incluirLogon, incluirExcessoVelocidade, incluirFai, incluirTri, indisponibilidadeTabela, valesPerdasTabela, incluirGty, incluirTmv, incluirTempoRendicao, incluirAvariaTransporte, incluirPacoteGenteDu, incluirLogonDu, incluirDevolucao, incluirPresenteismoDu, incluirDescontoCivf, incluirDescontoStressTest, incluirFrotaT1, incluirArmazemBi, incluirArmazemEfc, incluirArmazemTmaT2, incluirArmazemPresenteismoAlT2, incluirArmazemRefugo, incluirArmazemT1Bi, incluirArmazemTmaT1, incluirArmazemDisponibilidadeGenteT1, incluirArmazemPresenteismoAlT1, incluirArmazemQuebras]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const anosDisponiveis = useMemo(
    () => Array.from(new Set([
      ...metas.map(m => m.ano),
      ...resultados.map(r => r.ano),
      ...rowsDre.filter(r => r.tipo_periodo === 'MENSAL').map(r => r.ano),
      ...resultadosDtoT2.map(r => r.ano),
      ...resultadosDtoT1.map(r => r.ano),
      ...resultadosGsd.map(r => r.ano),
      ...resultadosLogon.map(r => r.ano),
      ...resultadosExcessoVelocidade.map(r => r.ano),
      ...resultadosFai.map(r => r.ano),
      ...resultadosTri.map(r => r.ano),
      ...resultadosIndisponibilidade.map(r => r.ano),
      ...resultadosDistribuicaoBi.map(r => r.ano),
      ...presenteismoDuMetas.map(m => m.ano),
      ...resultadosDescontoCivf.map(r => r.ano),
      ...resultadosDescontoStressTest.map(r => r.ano),
      ...resultadosArmazemBi.map(r => r.ano),
      ...armazemPresenteismoAlT2Metas.map(m => m.ano),
      ...resultadosArmazemT1Bi.map(r => r.ano),
      ...armazemTmaT1Metas.map(m => m.ano),
      ...armazemDisponibilidadeGenteT1Metas.map(m => m.ano),
      ...armazemPresenteismoAlT1Metas.map(m => m.ano),
      ...resultadosArmazemQuebras.map(r => r.ano),
      ...resultadosImportadosDistribuicao
        .map(r => indicadoresImportadosDistribuicao.find(i => i.id === r.indicador_id)?.ano)
        .filter((a): a is number => a !== undefined),
    ])).sort((a, b) => b - a),
    [metas, resultados, rowsDre, resultadosDtoT2, resultadosDtoT1, resultadosGsd, resultadosLogon, resultadosExcessoVelocidade, resultadosFai, resultadosTri, resultadosIndisponibilidade, resultadosDistribuicaoBi, presenteismoDuMetas, resultadosDescontoCivf, resultadosDescontoStressTest, resultadosArmazemBi, armazemPresenteismoAlT2Metas, resultadosArmazemT1Bi, armazemTmaT1Metas, armazemDisponibilidadeGenteT1Metas, armazemPresenteismoAlT1Metas, resultadosArmazemQuebras, resultadosImportadosDistribuicao, indicadoresImportadosDistribuicao],
  )
  const [verAnoInterno, setVerAnoInterno] = useState('')
  const [verMesInterno, setVerMesInterno] = useState('')
  const verAno = anoForcado ?? verAnoInterno
  const verMes = mesForcado ?? verMesInterno
  const [filtroOperacao, setFiltroOperacao] = useState('todos')

  const liderancasSetor = useMemo(() => {
    let filtrado = liderancas.filter(l => ehDoSetor(l.setor))
    if (filtrarUnidade) filtrado = filtrado.filter(l => resolverUnidade(l.operacao, unidades)?.codigo === filtrarUnidade)
    // Unidades com 2 gerentes (ex: Camaçari: CDL/rota e CDR/armazém) — cada
    // um só pode ver a própria liderança, nunca a do outro. Usa o prefixo da
    // OPERAÇÃO (CDL→ROTA, CDR→ARM, ver `negocioPorPrefixo`), não o campo
    // `negocio` da liderança — esse campo às vezes é 'CONS' de propósito
    // (quando o resultado da RV da pessoa vem do DRE consolidado), o que não
    // tem relação com de qual gerente ela é.
    if (filtrarNegocio) filtrado = filtrado.filter(l => negocioPorPrefixo(l.operacao) === normalizarNomeUnidade(filtrarNegocio))
    return filtrado
  }, [liderancas, ehDoSetor, filtrarUnidade, filtrarNegocio, unidades])

  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(verAnoInterno))) {
      setVerAnoInterno(String(anosDisponiveis[0]))
    }
  }, [anosDisponiveis, verAnoInterno])

  // Mês padrão: o último com resultado do BI importado no ano (setores sem BI usam o último mês do DRE).
  useEffect(() => {
    if (verMes !== '' || verAno === '') return
    const ano = Number(verAno)
    const mesesComDado = incluirIndicadoresBi
      ? resultados.filter(r => r.ano === ano).map(r => r.mes)
      : incluirDtoT2
        ? resultadosDtoT2.filter(r => r.ano === ano).map(r => r.mes)
        : incluirDtoT1
          ? resultadosDtoT1.filter(r => r.ano === ano).map(r => r.mes)
          : incluirGsd
            ? resultadosGsd.filter(r => r.ano === ano).map(r => r.mes)
            : incluirLogon
              ? resultadosLogon.filter(r => r.ano === ano).map(r => r.mes)
              : incluirExcessoVelocidade
                ? resultadosExcessoVelocidade.filter(r => r.ano === ano).map(r => r.mes)
                : incluirFai
                  ? resultadosFai.filter(r => r.ano === ano).map(r => r.mes)
                  : incluirTri
                    ? resultadosTri.filter(r => r.ano === ano).map(r => r.mes)
                    : indisponibilidadeTabela
                      ? resultadosIndisponibilidade.filter(r => r.ano === ano).map(r => r.mes)
                      : incluirPresenteismoDu
                        ? presenteismoDuMetas.filter(m => m.ano === ano).map(m => m.mes)
                        : (incluirLogonDu || incluirDevolucao)
                          ? resultadosDistribuicaoBi.filter(r => r.ano === ano).map(r => r.mes)
                          : incluirDescontoCivf
                            ? resultadosDescontoCivf.filter(r => r.ano === ano).map(r => r.mes)
                            : incluirDescontoStressTest
                              ? resultadosDescontoStressTest.filter(r => r.ano === ano).map(r => r.mes)
                              : incluirArmazemBi
                                ? resultadosArmazemBi.filter(r => r.ano === ano).map(r => r.mes)
                                : incluirArmazemT1Bi
                                  ? resultadosArmazemT1Bi.filter(r => r.ano === ano).map(r => r.mes)
                                  : incluirArmazemQuebras
                                    ? resultadosArmazemQuebras.filter(r => r.ano === ano).map(r => r.mes)
                                    : (incluirGty || incluirTmv || incluirTempoRendicao)
                                      ? resultadosImportadosDistribuicao
                                        .filter(r => indicadoresImportadosDistribuicao.find(i => i.id === r.indicador_id)?.ano === ano)
                                        .map(r => r.mes)
                                      : rowsDre.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === ano).map(r => r.mes)
    setVerMesInterno(String(mesesComDado.length > 0 ? Math.max(...mesesComDado) : new Date().getMonth() + 1))
  }, [verAno, verMes, resultados, rowsDre, incluirIndicadoresBi, incluirDtoT2, resultadosDtoT2, incluirDtoT1, resultadosDtoT1, incluirGsd, resultadosGsd, incluirLogon, resultadosLogon, incluirExcessoVelocidade, resultadosExcessoVelocidade, incluirFai, resultadosFai, incluirTri, resultadosTri, indisponibilidadeTabela, resultadosIndisponibilidade, incluirPresenteismoDu, presenteismoDuMetas, incluirLogonDu, incluirDevolucao, resultadosDistribuicaoBi, incluirDescontoCivf, resultadosDescontoCivf, incluirDescontoStressTest, resultadosDescontoStressTest, incluirArmazemBi, resultadosArmazemBi, incluirArmazemT1Bi, resultadosArmazemT1Bi, incluirArmazemQuebras, resultadosArmazemQuebras, incluirGty, incluirTmv, incluirTempoRendicao, resultadosImportadosDistribuicao, indicadoresImportadosDistribuicao, valesPerdasTabela])

  const operacoesDisponiveis = useMemo(
    () => Array.from(new Set(liderancasSetor.map(l => l.operacao))).sort(),
    [liderancasSetor],
  )

  // ── Apuração por pessoa ─────────────────────────────────────────────────────
  const linhas = useMemo<LinhaApuracao[]>(() => {
    const ano = Number(verAno)
    const mes = Number(verMes)
    if (!ano || !mes) return []

    const pessoas = liderancasSetor.filter(p => filtroOperacao === 'todos' || p.operacao === filtroOperacao)

    const resultadosIdx = new Map(
      resultados.filter(r => r.ano === ano && r.mes === mes).map(r => [`${r.indicador}|${r.operacao_bi}`, r.valor]),
    )

    // Metas do BI agrupadas por indicador×operação (peso/negócio valem pro ano; valor é o do mês).
    interface MetaOp { indicador: string; operacao_bi: string; unidade: string; negocio: string; peso: number; valorMes: number | null }
    const metasOps = new Map<string, MetaOp>()
    for (const m of metas.filter(m => m.ano === ano)) {
      const chave = `${m.indicador}|${m.operacao_bi}`
      const atual = metasOps.get(chave)
        ?? { indicador: m.indicador, operacao_bi: m.operacao_bi, unidade: m.unidade, negocio: '', peso: 0, valorMes: null }
      if (m.negocio) atual.negocio = m.negocio
      if (m.peso) atual.peso = Number(m.peso)
      if (m.mes === mes) atual.valorMes = m.valor
      metasOps.set(chave, atual)
    }

    const dreMensal = rowsDre.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === ano)

    return pessoas.map(pessoa => {
      const unidade = resolverUnidade(pessoa.operacao, unidades)
      const itens: ItemApuracao[] = []

      if (unidade) {
        // Indicadores do BI da operação/negócio da pessoa
        for (const mo of metasOps.values()) {
          if (mo.unidade !== unidade.codigo || mo.peso <= 0) continue
          if (!negocioCompativel(mo.negocio, pessoa.negocio)) continue

          const resultado = resultadosIdx.get(`${mo.indicador}|${mo.operacao_bi}`)
          let status: StatusItem
          let detalhe: string
          let metaFmt: string | null = mo.valorMes !== null ? `${fmtPct(mo.valorMes)}%` : null
          let resultadoFmt: string | null = resultado !== undefined ? `${fmtPct(resultado)}%` : null
          if (mo.valorMes === null) {
            status = 'pendente'
            detalhe = 'Sem meta importada pro mês'
          } else if (resultado === undefined) {
            status = 'pendente'
            detalhe = `Meta ${fmtPct(mo.valorMes)} · sem resultado importado`
          } else {
            const bateu = menorMelhor(mo.indicador) ? resultado <= mo.valorMes : resultado >= mo.valorMes
            status = bateu ? 'bateu' : 'perdeu'
            detalhe = `Resultado ${fmtPct(resultado)} · Meta ${fmtPct(mo.valorMes)}`
          }
          itens.push({
            chave: `bi|${mo.indicador}|${mo.operacao_bi}`,
            rotulo: mo.indicador,
            peso: mo.peso,
            status,
            detalhe: `${mo.operacao_bi} · Peso ${fmtPeso(mo.peso)}% · ${detalhe}`,
            metaFmt,
            resultadoFmt,
          })
        }

        // Indicadores do DRE do setor
        const rowsUnidade = dreMensal.filter(r => r.unidade === unidade.codigo)
        const negociosDre = Array.from(new Set(rowsUnidade.map(r => r.negocio)))
        const negocioDre = negocioDreDaPessoa(unidade.codigo, unidade.nome, pessoa.negocio, negociosDre)
        const rowsMes = rowsUnidade.filter(r => r.negocio === negocioDre && r.mes === mes)

        for (const ind of indicadoresDre) {
          const peso = pesosDre.get(ind.id) ?? 0
          if (peso <= 0) continue
          if (ind.negocio && !negocioCompativel(ind.negocio, pessoa.negocio)) continue
          // Frota T1 (Estância/Ponta Grossa/CDR Bahia) usa só Custos Gerais
          // (113) — Manutenção/Pneus/Diesel são do T2, não entram aqui.
          if (incluirFrotaT1 && ehFrotaT1(unidade.codigo, pessoa.negocio)) continue

          // Indicador com negócio fixo (ex: Pacote de Gente da Distribuição,
          // sempre ROTA) ignora o negócio resolvido pra pessoa/unidade e usa
          // sempre o DRE daquele negócio específico.
          const negocioInd = ind.negocio ?? negocioDre
          const rowsMesInd = ind.negocio ? rowsUnidade.filter(r => r.negocio === ind.negocio && r.mes === mes) : rowsMes

          let status: StatusItem
          let detalhe: string
          let metaFmt: string | null = null
          let resultadoFmt: string | null = null

          // Multas do Financeiro (id 'MULTAS', único indicador de DRE que
          // usa esse id em qualquer setor — ver RV_FINANCEIRO_DRE em
          // constants.ts) é o único afetado pelo ajuste manual TEMPORÁRIO do
          // bug do DRE (ver `FinanceiroDreAjuste`).
          const indAjustavel = ind.id === 'MULTAS' ? 'multas' as const : null
          const ajusteAtivo = indAjustavel ? buscarAjusteFinanceiro(mapaAjustesFin, unidade.codigo, ano, mes, indAjustavel) : undefined
          let valorDispersaoDre: number | null = null

          if (rowsMesInd.length === 0 && !ajusteAtivo) {
            status = 'pendente'
            detalhe = 'Sem DRE importado pro mês'
          } else if (ind.tipo === 'avr') {
            const calc = normalizarParaCalculo(rowsMesInd)
            const avr = avrPorPrefixo(calc, ind.prefixos)
            const meta = buscarMetaOrcamento(orcamentos, {
              unidade: unidade.codigo, negocio: negocioInd, ano, codigo: ind.id, mes,
            })
            resultadoFmt = `${fmtPct(avr)}%`
            if (meta === null) {
              status = 'pendente'
              detalhe = `AVR ${fmtPct(avr)} · sem meta cadastrada`
            } else {
              status = avr <= meta ? 'bateu' : 'perdeu'
              detalhe = `AVR ${fmtPct(avr)} · Meta ${fmtPct(meta)}`
              metaFmt = `${fmtPct(meta)}%`
            }
          } else {
            valorDispersaoDre = rowsMesInd
              .filter(r => ind.prefixos.some(p => r.conta_codigo.startsWith(p)))
              .reduce((acc, r) => acc + (r.diferenca ?? 0), 0)
            const valor = ajusteAtivo ? ajusteAtivo.valor : valorDispersaoDre
            status = valor >= 0 ? 'bateu' : 'perdeu'
            detalhe = ajusteAtivo
              ? `Dispersão ${Math.round(valor).toLocaleString('pt-BR')} (ajuste manual) · meta ≥ 0 (sem estouro)`
              : `Dispersão ${Math.round(valor).toLocaleString('pt-BR')} · meta ≥ 0 (sem estouro)`
            resultadoFmt = Math.round(valor).toLocaleString('pt-BR')
            metaFmt = '≥ 0'
          }
          itens.push({
            chave: `dre|${ind.id}`,
            rotulo: ind.nome,
            peso,
            status,
            detalhe: `${negocioInd} · Peso ${fmtPeso(peso)}% · ${detalhe}`,
            metaFmt,
            resultadoFmt,
            ajusteFinanceiro: indAjustavel
              ? { indicador: indAjustavel, unidade: unidade.codigo, mes, ajusteAtual: ajusteAtivo, valorAutomatico: valorDispersaoDre }
              : undefined,
          })
        }

        // Indicador Desconto CIVF (meta e peso únicos, resultado direto por
        // unidade, em R$) — quanto menor melhor (desconto é uma penalidade).
        // Frota T1 (Estância/Ponta Grossa/CDR Bahia) não participa — usa só
        // os 5 indicadores próprios dela.
        if (incluirDescontoCivf && !ehFrotaT1(unidade.codigo, pessoa.negocio) && descontoCivfMeta && descontoCivfMeta.peso > 0) {
          const resultado = resultadosDescontoCivf.find(r => r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor
          let status: StatusItem
          let detalhe: string
          if (resultado === undefined) {
            status = 'pendente'
            detalhe = 'Sem resultado importado pro mês'
          } else {
            status = resultado <= descontoCivfMeta.meta_valor ? 'bateu' : 'perdeu'
            detalhe = `Resultado R$ ${fmtValor(resultado)} · Meta R$ ${fmtValor(descontoCivfMeta.meta_valor)}`
          }
          itens.push({
            chave: 'desconto_civf',
            rotulo: 'Desconto CIVF',
            peso: descontoCivfMeta.peso,
            status,
            detalhe: `Peso ${fmtPeso(descontoCivfMeta.peso)}% · ${detalhe}`,
            metaFmt: `R$ ${fmtValor(descontoCivfMeta.meta_valor)}`,
            resultadoFmt: resultado !== undefined ? `R$ ${fmtValor(resultado)}` : null,
          })
        }

        // Indicador Desconto Stress Test (meta e peso únicos, resultado
        // direto por unidade, em R$) — quanto menor melhor (desconto é uma
        // penalidade). Frota T1 não participa — mesma exclusão do CIVF.
        if (incluirDescontoStressTest && !ehFrotaT1(unidade.codigo, pessoa.negocio) && descontoStressTestMeta && descontoStressTestMeta.peso > 0) {
          const resultado = resultadosDescontoStressTest.find(r => r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor
          let status: StatusItem
          let detalhe: string
          if (resultado === undefined) {
            status = 'pendente'
            detalhe = 'Sem resultado importado pro mês'
          } else {
            status = resultado <= descontoStressTestMeta.meta_valor ? 'bateu' : 'perdeu'
            detalhe = `Resultado R$ ${fmtValor(resultado)} · Meta R$ ${fmtValor(descontoStressTestMeta.meta_valor)}`
          }
          itens.push({
            chave: 'desconto_stress_test',
            rotulo: 'Desconto Stress Test',
            peso: descontoStressTestMeta.peso,
            status,
            detalhe: `Peso ${fmtPeso(descontoStressTestMeta.peso)}% · ${detalhe}`,
            metaFmt: `R$ ${fmtValor(descontoStressTestMeta.meta_valor)}`,
            resultadoFmt: resultado !== undefined ? `R$ ${fmtValor(resultado)}` : null,
          })
        }

        // Indicadores novos da RV de Frota, específicos das 3 lideranças T1
        // (Estância, Ponta Grossa e CDR Bahia — ver `ehFrotaT1` acima). CDR
        // Bahia é só o lado ARM de Camaçari — o CDL Camaçari-Internalização
        // (ROTA, mesma unidade.codigo) é T2, por isso a checagem usa
        // `pessoa.negocio`, não só o código da unidade.
        if (incluirFrotaT1) {
          // Custos Gerais (DRE conta 114) — AVR direto do DRE vs meta do
          // Orçamento, mesmo mecanismo dos indicadores gerais de Frota
          // (Manutenção/Pneus/Diesel — inclusive o peso mora na mesma tabela,
          // `pesosDre`), só que restrito às 3 unidades T1 (checagem explícita
          // aqui, já que o peso não é por unidade — diferente do FAI/DTO T1).
          const custosGeraisPeso = pesosDre.get('114') ?? 0
          if (ehFrotaT1(unidade.codigo, pessoa.negocio) && custosGeraisPeso > 0) {
            let status: StatusItem
            let detalhe: string
            let avr: number | null = null
            const metaOrcamento = buscarMetaOrcamento(orcamentos, { unidade: unidade.codigo, negocio: negocioDre, ano, codigo: '114', mes })
            if (rowsMes.length === 0) {
              status = 'pendente'
              detalhe = 'Sem DRE importado pro mês'
            } else {
              avr = avrPorPrefixo(normalizarParaCalculo(rowsMes), ['114'])
              if (metaOrcamento === null) {
                status = 'pendente'
                detalhe = `AVR ${fmtPct(avr)}% · sem meta cadastrada no Orçamento`
              } else {
                status = avr <= metaOrcamento ? 'bateu' : 'perdeu'
                detalhe = `AVR ${fmtPct(avr)}% · Meta ${fmtPct(metaOrcamento)}%`
              }
            }
            itens.push({
              chave: 'frota_custos_gerais',
              rotulo: 'Custos Gerais Frota',
              peso: custosGeraisPeso,
              status,
              detalhe: `Peso ${fmtPeso(custosGeraisPeso)}% · ${detalhe}`,
              metaFmt: metaOrcamento !== null ? `${fmtPct(metaOrcamento)}%` : null,
              resultadoFmt: avr !== null ? `${fmtPct(avr)}%` : null,
            })
          }

          // Aderência ao Checklist e Aderência à Milimetragem (%, Estância/
          // Ponta Grossa/CDR Bahia) — resultado importado, quanto maior
          // melhor. Meta e peso são únicos por indicador (não por unidade,
          // migration 108) — a checagem de quem participa é explícita
          // (`ehFrotaT1`), já que não dá mais pra usar "tem linha de meta
          // pra essa unidade" como restrição.
          const indicadoresPct: { chave: string; rotulo: string; meta: RvFrotaAdChecklistMeta | RvFrotaAdMilimetragemMeta | null; resultados: { unidade: string; ano: number; mes: number; valor: number }[] }[] = [
            { chave: 'frota_ad_checklist', rotulo: 'Ad. Check List', meta: adChecklistMeta, resultados: resultadosAdChecklist },
            { chave: 'frota_ad_milimetragem', rotulo: 'Ad. Milimetragem', meta: adMilimetragemMeta, resultados: resultadosAdMilimetragem },
          ]
          for (const ind of indicadoresPct) {
            if (!ehFrotaT1(unidade.codigo, pessoa.negocio) || !ind.meta || ind.meta.peso <= 0) continue
            const meta = ind.meta
            const resultado = ind.resultados.find(r => r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor
            let status: StatusItem
            let detalhe: string
            if (resultado === undefined) {
              status = 'pendente'
              detalhe = `Meta ${fmtPct(meta.meta_pct)}% · sem resultado importado`
            } else {
              status = resultado >= meta.meta_pct ? 'bateu' : 'perdeu'
              detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(meta.meta_pct)}%`
            }
            itens.push({
              chave: ind.chave,
              rotulo: ind.rotulo,
              peso: meta.peso,
              status,
              detalhe: `Peso ${fmtPeso(meta.peso)}% · ${detalhe}`,
              metaFmt: `${fmtPct(meta.meta_pct)}%`,
              resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
            })
          }

          // Indisponibilidade Manutenção (%, só Estância/Ponta Grossa) —
          // quanto menor melhor (é uma penalidade, o oposto de aderência).
          if (frotaManutencaoCodigos.has(unidade.codigo) && indispManutencaoMeta && indispManutencaoMeta.peso > 0) {
            const resultado = resultadosIndispManutencao.find(r => r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor
            let status: StatusItem
            let detalhe: string
            if (resultado === undefined) {
              status = 'pendente'
              detalhe = `Meta ${fmtPct(indispManutencaoMeta.meta_pct)}% · sem resultado importado`
            } else {
              status = resultado <= indispManutencaoMeta.meta_pct ? 'bateu' : 'perdeu'
              detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(indispManutencaoMeta.meta_pct)}%`
            }
            itens.push({
              chave: 'frota_indisp_manutencao',
              rotulo: 'Indisponibilidade Manutenção',
              peso: indispManutencaoMeta.peso,
              status,
              detalhe: `Peso ${fmtPeso(indispManutencaoMeta.peso)}% · ${detalhe}`,
              metaFmt: `${fmtPct(indispManutencaoMeta.meta_pct)}%`,
              resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
            })
          }

          // Disponibilidade Empilhadeira (%, só CDR Bahia — o lado ARM de
          // Camaçari, não o CDL ROTA) — quanto maior melhor.
          if (cdrBahiaCodigo && unidade.codigo === cdrBahiaCodigo && pessoa.negocio === 'ARM' && dispEmpilhadeiraMeta && dispEmpilhadeiraMeta.peso > 0) {
            const resultado = resultadosDispEmpilhadeira.find(r => r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor
            let status: StatusItem
            let detalhe: string
            if (resultado === undefined) {
              status = 'pendente'
              detalhe = `Meta ${fmtPct(dispEmpilhadeiraMeta.meta_pct)}% · sem resultado importado`
            } else {
              status = resultado >= dispEmpilhadeiraMeta.meta_pct ? 'bateu' : 'perdeu'
              detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(dispEmpilhadeiraMeta.meta_pct)}%`
            }
            itens.push({
              chave: 'frota_disp_empilhadeira',
              rotulo: 'Disponibilidade Empilhadeira',
              peso: dispEmpilhadeiraMeta.peso,
              status,
              detalhe: `Peso ${fmtPeso(dispEmpilhadeiraMeta.peso)}% · ${detalhe}`,
              metaFmt: `${fmtPct(dispEmpilhadeiraMeta.meta_pct)}%`,
              resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
            })
          }
        }

        // Indicador EFC do Armazém T2 (meta por unidade + peso único) — quanto
        // maior melhor. Não conta pra Estância/CDR Bahia (só têm indicadores do T1).
        if (incluirArmazemEfc && armazemEfcPeso && armazemEfcPeso > 0 && !armazemT1Codigos.has(unidade.codigo)) {
          const meta = armazemEfcMetas.get(unidade.codigo)
          if (meta !== undefined) {
            const resultado = resultadosArmazemBi.find(r => r.indicador === 'efc' && r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor
            let status: StatusItem
            let detalhe: string
            if (resultado === undefined) {
              status = 'pendente'
              detalhe = `Meta ${fmtPct(meta)}% · sem resultado importado`
            } else {
              status = resultado >= meta ? 'bateu' : 'perdeu'
              detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(meta)}%`
            }
            itens.push({
              chave: 'armazem_efc',
              rotulo: 'EFC',
              peso: armazemEfcPeso,
              status,
              detalhe: `Peso ${fmtPeso(armazemEfcPeso)}% · ${detalhe}`,
              metaFmt: `${fmtPct(meta)}%`,
              resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
            })
          }
        }

        // Indicador TMA do Armazém T2 (meta por unidade, em minutos + peso
        // único) — quanto menor melhor. Não conta pra Estância/CDR Bahia (usam o TMA do T1).
        if (incluirArmazemTmaT2 && armazemTmaT2Peso && armazemTmaT2Peso > 0 && !armazemT1Codigos.has(unidade.codigo)) {
          const meta = armazemTmaT2Metas.get(unidade.codigo)
          if (meta !== undefined) {
            const resultado = resultadosArmazemBi.find(r => r.indicador === 'tma' && r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor
            let status: StatusItem
            let detalhe: string
            if (resultado === undefined) {
              status = 'pendente'
              detalhe = `Meta ${formatarMinutosComoDuracao(meta)} · sem resultado importado`
            } else {
              status = resultado <= meta ? 'bateu' : 'perdeu'
              detalhe = `Resultado ${formatarMinutosComoDuracao(resultado)} · Meta ${formatarMinutosComoDuracao(meta)}`
            }
            itens.push({
              chave: 'armazem_tma_t2',
              rotulo: 'TMA',
              peso: armazemTmaT2Peso,
              status,
              detalhe: `Peso ${fmtPeso(armazemTmaT2Peso)}% · ${detalhe}`,
              metaFmt: formatarMinutosComoDuracao(meta),
              resultadoFmt: resultado !== undefined ? formatarMinutosComoDuracao(resultado) : null,
            })
          }
        }

        // Indicador Presenteísmo AL do Armazém T2 (meta mensal por unidade +
        // peso único) — quanto menor melhor. Não conta pra Estância/CDR Bahia
        // (usam o Presenteísmo AL do T1, cadastro separado).
        if (incluirArmazemPresenteismoAlT2 && armazemPresenteismoAlT2Peso && armazemPresenteismoAlT2Peso > 0 && !armazemT1Codigos.has(unidade.codigo)) {
          const metaPresT2 = armazemPresenteismoAlT2Metas.find(mp => mp.unidade === unidade.codigo && mp.ano === ano && mp.mes === mes)
          const resultado = resultadosArmazemBi.find(r => r.indicador === 'presenteismo_al' && r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor
          let status: StatusItem
          let detalhe: string
          if (!metaPresT2) {
            status = 'pendente'
            detalhe = 'Sem meta importada pro mês'
          } else if (resultado === undefined) {
            status = 'pendente'
            detalhe = `Meta ${fmtPct(metaPresT2.valor)}% · sem resultado importado`
          } else {
            status = resultado <= metaPresT2.valor ? 'bateu' : 'perdeu'
            detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(metaPresT2.valor)}%`
          }
          itens.push({
            chave: 'armazem_presenteismo_al_t2',
            rotulo: 'Presenteísmo AL',
            peso: armazemPresenteismoAlT2Peso,
            status,
            detalhe: `Peso ${fmtPeso(armazemPresenteismoAlT2Peso)}% · ${detalhe}`,
            metaFmt: metaPresT2 ? `${fmtPct(metaPresT2.valor)}%` : null,
            resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
          })
        }

        // Indicador Refugo do Armazém T2 (meta e peso únicos) — quanto menor
        // melhor. Não existe no T1, não conta pra Estância/CDR Bahia.
        if (incluirArmazemRefugo && armazemRefugoMeta && armazemRefugoMeta.peso > 0 && !armazemT1Codigos.has(unidade.codigo)) {
          const resultado = resultadosArmazemBi.find(r => r.indicador === 'refugo' && r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor
          let status: StatusItem
          let detalhe: string
          if (resultado === undefined) {
            status = 'pendente'
            detalhe = 'Sem resultado importado pro mês'
          } else {
            status = resultado <= armazemRefugoMeta.meta_pct ? 'bateu' : 'perdeu'
            detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(armazemRefugoMeta.meta_pct)}%`
          }
          itens.push({
            chave: 'armazem_refugo',
            rotulo: 'Refugo',
            peso: armazemRefugoMeta.peso,
            status,
            detalhe: `Peso ${fmtPeso(armazemRefugoMeta.peso)}% · ${detalhe}`,
            metaFmt: `${fmtPct(armazemRefugoMeta.meta_pct)}%`,
            resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
          })
        }

        // Indicador TMA do Armazém T1 (meta mensal por unidade, em minutos +
        // peso único) — cadastro separado do T2. Quanto menor melhor. Só
        // conta pra Estância/CDR Bahia — as únicas do T1.
        if (incluirArmazemTmaT1 && armazemTmaT1Peso && armazemTmaT1Peso > 0 && armazemT1Codigos.has(unidade.codigo)) {
          const metaTmaT1 = armazemTmaT1Metas.find(mt => mt.unidade === unidade.codigo && mt.ano === ano && mt.mes === mes)
          const resultado = resultadosArmazemT1Bi.find(r => r.indicador === 'tma' && r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor
          let status: StatusItem
          let detalhe: string
          if (!metaTmaT1) {
            status = 'pendente'
            detalhe = 'Sem meta importada pro mês'
          } else if (resultado === undefined) {
            status = 'pendente'
            detalhe = `Meta ${formatarMinutosComoDuracao(metaTmaT1.valor)} · sem resultado importado`
          } else {
            status = resultado <= metaTmaT1.valor ? 'bateu' : 'perdeu'
            detalhe = `Resultado ${formatarMinutosComoDuracao(resultado)} · Meta ${formatarMinutosComoDuracao(metaTmaT1.valor)}`
          }
          itens.push({
            chave: 'armazem_tma_t1',
            rotulo: 'TMA (T1)',
            peso: armazemTmaT1Peso,
            status,
            detalhe: `Peso ${fmtPeso(armazemTmaT1Peso)}% · ${detalhe}`,
            metaFmt: metaTmaT1 ? formatarMinutosComoDuracao(metaTmaT1.valor) : null,
            resultadoFmt: resultado !== undefined ? formatarMinutosComoDuracao(resultado) : null,
          })
        }

        // Indicador Disponibilidade de Gente do Armazém T1 (meta mensal por
        // unidade + peso único) — quanto maior melhor. Só conta pra
        // Estância/CDR Bahia — não existe no T2.
        if (incluirArmazemDisponibilidadeGenteT1 && armazemDisponibilidadeGenteT1Peso && armazemDisponibilidadeGenteT1Peso > 0 && armazemT1Codigos.has(unidade.codigo)) {
          const metaDispT1 = armazemDisponibilidadeGenteT1Metas.find(md => md.unidade === unidade.codigo && md.ano === ano && md.mes === mes)
          const resultado = resultadosArmazemT1Bi.find(r => r.indicador === 'disponibilidade_gente' && r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor
          let status: StatusItem
          let detalhe: string
          if (!metaDispT1) {
            status = 'pendente'
            detalhe = 'Sem meta importada pro mês'
          } else if (resultado === undefined) {
            status = 'pendente'
            detalhe = `Meta ${fmtPct(metaDispT1.valor)}% · sem resultado importado`
          } else {
            status = resultado >= metaDispT1.valor ? 'bateu' : 'perdeu'
            detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(metaDispT1.valor)}%`
          }
          itens.push({
            chave: 'armazem_disponibilidade_gente_t1',
            rotulo: 'Disponibilidade de Gente',
            peso: armazemDisponibilidadeGenteT1Peso,
            status,
            detalhe: `Peso ${fmtPeso(armazemDisponibilidadeGenteT1Peso)}% · ${detalhe}`,
            metaFmt: metaDispT1 ? `${fmtPct(metaDispT1.valor)}%` : null,
            resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
          })
        }

        // Indicador Presenteísmo AL do Armazém T1 (meta mensal por unidade +
        // peso único) — cadastro separado do T2. Quanto menor melhor. Só
        // conta pra Estância/CDR Bahia.
        if (incluirArmazemPresenteismoAlT1 && armazemPresenteismoAlT1Peso && armazemPresenteismoAlT1Peso > 0 && armazemT1Codigos.has(unidade.codigo)) {
          const metaPresT1 = armazemPresenteismoAlT1Metas.find(mp => mp.unidade === unidade.codigo && mp.ano === ano && mp.mes === mes)
          const resultado = resultadosArmazemT1Bi.find(r => r.indicador === 'presenteismo_al' && r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor
          let status: StatusItem
          let detalhe: string
          if (!metaPresT1) {
            status = 'pendente'
            detalhe = 'Sem meta importada pro mês'
          } else if (resultado === undefined) {
            status = 'pendente'
            detalhe = `Meta ${fmtPct(metaPresT1.valor)}% · sem resultado importado`
          } else {
            status = resultado <= metaPresT1.valor ? 'bateu' : 'perdeu'
            detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(metaPresT1.valor)}%`
          }
          itens.push({
            chave: 'armazem_presenteismo_al_t1',
            rotulo: 'Presenteísmo AL (T1)',
            peso: armazemPresenteismoAlT1Peso,
            status,
            detalhe: `Peso ${fmtPeso(armazemPresenteismoAlT1Peso)}% · ${detalhe}`,
            metaFmt: metaPresT1 ? `${fmtPct(metaPresT1.valor)}%` : null,
            resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
          })
        }

        // Indicador Quebras do Armazém (cadastro manual, resultado
        // compartilhado entre T2 e T1) — meta e peso vêm de
        // rv_armazem_quebras_meta pras unidades do T2 ou
        // rv_armazem_t1_quebras_meta pra Estância/CDR Bahia. Quanto menor
        // melhor. Mês sem nenhum resultado cadastrado conta como zero quebras
        // (bateu a meta) — mesma regra do FAI/TRI/Excesso de Velocidade, senão
        // a liderança nunca receberia esse pedaço da RV em meses sem quebra.
        if (incluirArmazemQuebras) {
          const metaQuebras = armazemT1Codigos.has(unidade.codigo) ? armazemT1QuebrasMeta : armazemQuebrasMeta
          if (metaQuebras && metaQuebras.peso > 0) {
            const resultadoRow = resultadosArmazemQuebras.find(r => r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)
            const resultado = resultadoRow?.valor ?? 0
            const status: StatusItem = resultado <= metaQuebras.meta_valor ? 'bateu' : 'perdeu'
            const detalhe = resultadoRow
              ? `Resultado R$ ${fmtValor(resultado)} · Meta R$ ${fmtValor(metaQuebras.meta_valor)}`
              : `Sem resultado cadastrado — assumido R$ 0 · Meta R$ ${fmtValor(metaQuebras.meta_valor)}`
            itens.push({
              chave: 'armazem_quebras',
              rotulo: 'Quebras',
              peso: metaQuebras.peso,
              status,
              detalhe: `Peso ${fmtPeso(metaQuebras.peso)}% · ${detalhe}`,
              metaFmt: `R$ ${fmtValor(metaQuebras.meta_valor)}`,
              resultadoFmt: `R$ ${fmtValor(resultado)}`,
            })
          }
        }

        // Indicador DTO T2 (meta e peso únicos, resultado direto por unidade)
        // — em unidade com split de negócio (Camaçari/Ponta Grossa), o BI só
        // cobre a ROTA (a empurrada usa o DTO T1), então não conta pra ARM.
        // Também não vale pra ESTÂNCIA — é T1 puro (junto com Ponta Grossa e
        // Camaçari ARM), mas como não tem split de negócio (não abre
        // ROTA/ARM) cairia no "!unidadeSplit" e herdaria o DTO T2 por
        // engano; como a meta é única (não por unidade, ao contrário do DTO
        // T1), não tem "sem meta cadastrada" pra barrar sozinho — precisa
        // do mesmo check explícito que o GSD já usa.
        const unidadeSplit = unidadeSplitNegocio(unidade.codigo, unidade.nome)
        const dtoT2Aplicavel = unidade.codigo !== estanciaCodigo && (!unidadeSplit || negocioCompativel('ROTA', pessoa.negocio))
        if (incluirDtoT2 && dtoT2Aplicavel && dtoT2Meta && dtoT2Meta.peso > 0) {
          const resultado = resultadosDtoT2.find(r => r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor
          let status: StatusItem
          let detalhe: string
          if (resultado === undefined) {
            status = 'pendente'
            detalhe = 'Sem resultado importado pro mês'
          } else {
            status = resultado >= dtoT2Meta.meta_pct ? 'bateu' : 'perdeu'
            detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(dtoT2Meta.meta_pct)}%`
          }
          itens.push({
            chave: 'dto_t2',
            rotulo: 'DTO T2',
            peso: dtoT2Meta.peso,
            status,
            detalhe: `Peso ${fmtPeso(dtoT2Meta.peso)}% · ${detalhe}`,
            metaFmt: `${fmtPct(dtoT2Meta.meta_pct)}%`,
            resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
          })
        }

        // Indicador DTO T1 (meta e peso por unidade, resultado direto por
        // unidade) — em unidade com split de negócio, é justamente o dado da
        // empurrada (ARM), então não conta pra ROTA.
        const dtoT1Aplicavel = !unidadeSplit || negocioCompativel('ARM', pessoa.negocio)
        if (incluirDtoT1 && dtoT1Aplicavel) {
          const dtoT1Meta = dtoT1Metas.get(unidade.codigo)
          if (dtoT1Meta && dtoT1Meta.peso > 0) {
            const resultado = resultadosDtoT1.find(r => r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)?.valor
            let status: StatusItem
            let detalhe: string
            if (resultado === undefined) {
              status = 'pendente'
              detalhe = 'Sem resultado importado pro mês'
            } else {
              status = resultado >= dtoT1Meta.meta_pct ? 'bateu' : 'perdeu'
              detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(dtoT1Meta.meta_pct)}%`
            }
            itens.push({
              chave: 'dto_t1',
              rotulo: 'DTO T1',
              peso: dtoT1Meta.peso,
              status,
              detalhe: `Peso ${fmtPeso(dtoT1Meta.peso)}% · ${detalhe}`,
              metaFmt: `${fmtPct(dtoT1Meta.meta_pct)}%`,
              resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
            })
          }
        }

        // Indicador GSD (meta e peso únicos; resultado por unidade×negócio —
        // Camaçari tem ROTA e ARM separados, escolhe pelo negócio da pessoa)
        // — não vale pra ESTÂNCIA nem pra Camaçari ARM, igual ao Excesso de
        // Velocidade.
        const gsdAplicavel = unidade.codigo !== estanciaCodigo && (!unidadeSplit || negocioCompativel('ROTA', pessoa.negocio))
        if (incluirGsd && gsdAplicavel && gsdMeta && gsdMeta.peso > 0) {
          const negociosGsd = resultadosGsd.filter(r => r.unidade === unidade.codigo).map(r => r.negocio)
          const negocioGsd = negocioDreDaPessoa(unidade.codigo, unidade.nome, pessoa.negocio, negociosGsd)
          const resultado = resultadosGsd.find(r => r.unidade === unidade.codigo && r.negocio === negocioGsd && r.ano === ano && r.mes === mes)?.valor
          let status: StatusItem
          let detalhe: string
          if (resultado === undefined) {
            status = 'pendente'
            detalhe = 'Sem resultado importado pro mês'
          } else {
            status = resultado >= gsdMeta.meta_pct ? 'bateu' : 'perdeu'
            detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(gsdMeta.meta_pct)}%`
          }
          itens.push({
            chave: 'gsd',
            rotulo: 'GSD',
            peso: gsdMeta.peso,
            status,
            detalhe: `Peso ${fmtPeso(gsdMeta.peso)}% · ${detalhe}`,
            metaFmt: `${fmtPct(gsdMeta.meta_pct)}%`,
            resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
          })
        }

        // Indicador LogOn (meta e peso únicos; resultado por unidade×negócio —
        // Camaçari tem ROTA e ARM separados, escolhe pelo negócio da pessoa)
        if (incluirLogon && logonMeta && logonMeta.peso > 0) {
          const negociosLogon = resultadosLogon.filter(r => r.unidade === unidade.codigo).map(r => r.negocio)
          const negocioLogon = negocioDreDaPessoa(unidade.codigo, unidade.nome, pessoa.negocio, negociosLogon)
          const resultado = resultadosLogon.find(r => r.unidade === unidade.codigo && r.negocio === negocioLogon && r.ano === ano && r.mes === mes)?.valor
          let status: StatusItem
          let detalhe: string
          if (resultado === undefined) {
            status = 'pendente'
            detalhe = 'Sem resultado importado pro mês'
          } else {
            status = resultado >= logonMeta.meta_pct ? 'bateu' : 'perdeu'
            detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(logonMeta.meta_pct)}%`
          }
          itens.push({
            chave: 'logon',
            rotulo: 'LogOn',
            peso: logonMeta.peso,
            status,
            detalhe: `Peso ${fmtPeso(logonMeta.peso)}% · ${detalhe}`,
            metaFmt: `${fmtPct(logonMeta.meta_pct)}%`,
            resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
          })
        }

        // Indicador Excesso de Velocidade (meta e peso por unidade; quanto
        // menor a contagem melhor) — não vale pra ESTÂNCIA (sem meta
        // cadastrada) nem pra Camaçari ARM (só a ROTA é contada no import).
        // Mês sem nenhum resultado importado conta como zero ocorrências
        // (bateu a meta) — não fica pendente, mesma regra do FAI/TRI, senão
        // a liderança nunca receberia esse pedaço da RV em meses sem excesso.
        const excessoVelocidadeAplicavel = !unidadeSplit || negocioCompativel('ROTA', pessoa.negocio)
        if (incluirExcessoVelocidade && excessoVelocidadeAplicavel) {
          const excessoMeta = excessoVelocidadeMetas.get(unidade.codigo)
          if (excessoMeta && excessoMeta.peso > 0) {
            const resultadoRow = resultadosExcessoVelocidade.find(r => r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)
            const resultado = resultadoRow?.valor ?? 0
            const status: StatusItem = resultado <= excessoMeta.meta_max ? 'bateu' : 'perdeu'
            const detalhe = resultadoRow
              ? `Excessos ${fmtContagem(resultado)} · Máx. ${fmtContagem(excessoMeta.meta_max)}`
              : `Sem resultado importado — assumido 0 · Máx. ${fmtContagem(excessoMeta.meta_max)}`
            itens.push({
              chave: 'excesso_velocidade',
              rotulo: 'Excesso de Velocidade',
              peso: excessoMeta.peso,
              status,
              detalhe: `Peso ${fmtPeso(excessoMeta.peso)}% · ${detalhe}`,
              metaFmt: `Máx. ${fmtContagem(excessoMeta.meta_max)}`,
              resultadoFmt: fmtContagem(resultado),
            })
          }
        }

        // Indicador FAI (meta e peso por unidade; quanto menor a contagem
        // melhor) — compensa quem fica de fora do Excesso de Velocidade: só
        // ESTÂNCIA e Camaçari ARM. Mês sem nenhum resultado importado conta
        // como zero ocorrências (bateu a meta) — não fica pendente, senão a
        // liderança nunca receberia esse pedaço da RV em meses sem FAI.
        const faiAplicavel = !unidadeSplit || negocioCompativel('ARM', pessoa.negocio)
        if (incluirFai && faiAplicavel) {
          const faiMeta = faiMetas.get(unidade.codigo)
          if (faiMeta && faiMeta.peso > 0) {
            const resultadoRow = resultadosFai.find(r => r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)
            const resultado = resultadoRow?.valor ?? 0
            const status: StatusItem = resultado <= faiMeta.meta_max ? 'bateu' : 'perdeu'
            const detalhe = resultadoRow
              ? `FAI ${fmtContagem(resultado)} · Máx. ${fmtContagem(faiMeta.meta_max)}`
              : `Sem resultado importado — assumido 0 · Máx. ${fmtContagem(faiMeta.meta_max)}`
            itens.push({
              chave: 'fai',
              rotulo: 'FAI',
              peso: faiMeta.peso,
              status,
              detalhe: `Peso ${fmtPeso(faiMeta.peso)}% · ${detalhe}`,
              metaFmt: `Máx. ${fmtContagem(faiMeta.meta_max)}`,
              resultadoFmt: fmtContagem(resultado),
            })
          }
        }

        // Indicador TRI (acidente grave — meta e peso únicos, vale pra todas
        // as unidades e negócios). Mês sem registro conta como zero
        // ocorrências (bateu a meta), igual ao FAI — acidente grave é raro
        // e não tem planilha, só registro manual quando acontece.
        if (incluirTri && triMeta && triMeta.peso > 0) {
          const resultadoRow = resultadosTri.find(r => r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)
          const resultado = resultadoRow?.valor ?? 0
          const status: StatusItem = resultado <= triMeta.meta_max ? 'bateu' : 'perdeu'
          const detalhe = resultadoRow
            ? `TRI ${fmtContagem(resultado)} · Máx. ${fmtContagem(triMeta.meta_max)}`
            : `Sem acidente grave registrado — assumido 0 · Máx. ${fmtContagem(triMeta.meta_max)}`
          itens.push({
            chave: 'tri',
            rotulo: 'TRI',
            peso: triMeta.peso,
            status,
            detalhe: `Peso ${fmtPeso(triMeta.peso)}% · ${detalhe}`,
            metaFmt: `Máx. ${fmtContagem(triMeta.meta_max)}`,
            resultadoFmt: fmtContagem(resultado),
          })
        }

        // Peso dos indicadores da Distribuição — por função da liderança
        // (COORD. DU / SUPERVISOR DU); a meta de cada um continua única e
        // compartilhada, só o peso muda. LogOn DU não tem linha pra
        // SUPERVISOR DU de propósito — não conta pra essa função.
        const funcaoChave = (pessoa.funcao ?? '').trim().toUpperCase()
        const pesoDistribuicao = (indicador: string) => pesosPorFuncaoDistribuicao.get(`${funcaoChave}|${indicador}`)

        // Indicador Indisponibilidade (painel_perdas_aux × meta única em R$;
        // mesmo dado importado no Painel de Perdas, sem split de negócio) —
        // Distribuição e Empurrada usam, cada uma com sua própria tabela.
        // Meta é negativa (convenção de Metas de Perdas), bateu quando o
        // resultado é maior ou igual (menos negativo é melhor). Mês sem
        // resultado importado fica pendente, não é assumido zero — ausência
        // provavelmente significa "não importado ainda", não "confirmado zero".
        if (indisponibilidadeTabela && indisponibilidadeMeta) {
          const peso = indisponibilidadeTabela === 'rv_indisponibilidade_meta' ? pesoDistribuicao('indisponibilidade') : indisponibilidadeMeta.peso
          if (peso && peso > 0) {
            const resultadoRow = resultadosIndisponibilidade.find(r => r.unidade === unidade.codigo && r.ano === ano && r.mes === mes)
            let status: StatusItem
            let detalhe: string
            let resultadoFmt: string | null = null
            if (!resultadoRow) {
              status = 'pendente'
              detalhe = 'Sem resultado importado pro mês'
            } else {
              const resultado = resultadoRow.valor
              status = resultado >= indisponibilidadeMeta.meta_valor ? 'bateu' : 'perdeu'
              detalhe = `Resultado R$ ${fmtValor(resultado)} · Meta R$ ${fmtValor(indisponibilidadeMeta.meta_valor)}`
              resultadoFmt = `R$ ${fmtValor(resultado)}`
            }
            itens.push({
              chave: 'indisponibilidade',
              rotulo: 'Indisponibilidade',
              peso,
              status,
              detalhe: `Peso ${fmtPeso(peso)}% · ${detalhe}`,
              metaFmt: `R$ ${fmtValor(indisponibilidadeMeta.meta_valor)}`,
              resultadoFmt,
            })
          }
        }

        // Indicador Pacote de Gente da Distribuição (158, contas 158+033) —
        // igual ao que antes vinha de indicadoresDre, mas convertido pra
        // bloco próprio porque o peso agora é por função (só conta pra
        // COORD. DU — sem peso cadastrado pra SUPERVISOR DU). Só conta pra
        // lideranças da ROTA. O negócio do DRE usado depende da unidade: nas
        // que têm split de verdade (Camaçari, Ponta Grossa — rota E armazém
        // importados separados) usa sempre ROTA, senão o valor de armazém
        // vazaria pro indicador; nas demais (só rota, sem armazém — ex: São
        // Cristóvão) o DRE inteiro é importado como CONS, nunca como ROTA —
        // aí CONS já É a rota, então usa CONS (senão o filtro por 'ROTA'
        // nunca acha nada e o indicador fica sempre "sem meta" à toa).
        if (incluirPacoteGenteDu && negocioCompativel('ROTA', pessoa.negocio)) {
          const peso = pesoDistribuicao('pacote_gente')
          if (peso && peso > 0) {
            const indPacoteGente = RV_DISTRIBUICAO_DRE[0]
            const negocioPacoteGente = unidadeSplitNegocio(unidade.codigo, unidade.nome) ? (indPacoteGente.negocio ?? 'ROTA') : 'CONS'
            const rowsMesPacoteGente = rowsUnidade.filter(r => r.negocio === negocioPacoteGente && r.mes === mes)
            let status: StatusItem
            let detalhe: string
            let metaFmt: string | null = null
            let resultadoFmt: string | null = null
            if (rowsMesPacoteGente.length === 0) {
              status = 'pendente'
              detalhe = 'Sem DRE importado pro mês'
            } else {
              const calc = normalizarParaCalculo(rowsMesPacoteGente)
              const avr = avrPorPrefixo(calc, indPacoteGente.prefixos)
              const meta = buscarMetaOrcamento(orcamentos, {
                unidade: unidade.codigo, negocio: negocioPacoteGente, ano, codigo: indPacoteGente.id, mes,
              })
              resultadoFmt = `${fmtPct(avr)}%`
              if (meta === null) {
                status = 'pendente'
                detalhe = `AVR ${fmtPct(avr)} · sem meta cadastrada`
              } else {
                status = avr <= meta ? 'bateu' : 'perdeu'
                detalhe = `AVR ${fmtPct(avr)} · Meta ${fmtPct(meta)}`
                metaFmt = `${fmtPct(meta)}%`
              }
            }
            itens.push({
              chave: 'pacote_gente',
              rotulo: indPacoteGente.nome,
              peso,
              status,
              detalhe: `${negocioPacoteGente} · Peso ${fmtPeso(peso)}% · ${detalhe}`,
              metaFmt,
              resultadoFmt,
            })
          }
        }

        // Indicador Vales (Distribuição e Financeiro) — resultado é a mesma
        // soma da coluna diferença do DRE (contas 052/053) usada no
        // indicador Vales do Painel de Perdas; a meta é um % (ex: 95%) da
        // Meta de Perdas de Vales do mês (metas_perdas_indicadores, anual
        // dividida pelos meses ativos da unidade — ver mesesAtivosNoAno) —
        // a liderança tem que gastar no máximo esse % do que a
        // Meta de Perdas permite. Independente do negócio. Peso: por função
        // na Distribuição (só conta pra SUPERVISOR DU — sem peso cadastrado
        // pra COORD. DU), único no Financeiro (cada um com sua própria tabela).
        if (valesPerdasTabela && valesMeta) {
          const peso = valesPerdasTabela === 'rv_vales_distribuicao_meta' ? pesoDistribuicao('vales') : valesMeta.peso
          if (peso && peso > 0) {
            const metaPerdasVales = metasPerdasVales.find(mp => mp.unidade === unidade.codigo && mp.ano === ano)
            // Ajuste manual só existe pro Vales do Financeiro (bug do DRE) —
            // nunca pro Vales da Distribuição, que usa a tabela de meta
            // diferente (ver `FinanceiroDreAjuste`).
            const indAjustavelVales = valesPerdasTabela === 'rv_vales_financeiro_meta' ? 'vales' as const : null
            const ajusteVales = indAjustavelVales ? buscarAjusteFinanceiro(mapaAjustesFin, unidade.codigo, ano, mes, indAjustavelVales) : undefined
            let status: StatusItem
            let detalhe: string
            let metaFmt: string | null = null
            let resultadoFmt: string | null = null
            let valorDreVales: number | null = null
            if (rowsMes.length === 0 && !ajusteVales) {
              status = 'pendente'
              detalhe = 'Sem DRE importado pro mês'
            } else if (!metaPerdasVales) {
              status = 'pendente'
              detalhe = 'Sem Meta de Perdas de Vales cadastrada pro ano'
            } else {
              valorDreVales = rowsMes
                .filter(r => r.conta_codigo.startsWith('052') || r.conta_codigo.startsWith('053'))
                .reduce((acc, r) => acc + (r.diferenca ?? 0), 0)
              const resultado = ajusteVales ? ajusteVales.valor : valorDreVales
              const mesesAtivos = mesesAtivosNoAno(unidade.data_entrada, ano)
              const metaMensal = (metaPerdasVales.meta_anual / mesesAtivos) * (valesMeta.pct_meta / 100)
              status = resultado >= metaMensal ? 'bateu' : 'perdeu'
              detalhe = ajusteVales
                ? `Resultado R$ ${fmtValor(resultado)} (ajuste manual) · Meta R$ ${fmtValor(metaMensal)} (${fmtPeso(valesMeta.pct_meta)}% da Meta de Perdas)`
                : `Resultado R$ ${fmtValor(resultado)} · Meta R$ ${fmtValor(metaMensal)} (${fmtPeso(valesMeta.pct_meta)}% da Meta de Perdas)`
              metaFmt = `R$ ${fmtValor(metaMensal)}`
              resultadoFmt = `R$ ${fmtValor(resultado)}`
            }
            itens.push({
              chave: 'vales_perdas',
              rotulo: 'Vales',
              peso,
              status,
              detalhe: `Peso ${fmtPeso(peso)}% · ${detalhe}`,
              metaFmt,
              resultadoFmt,
              ajusteFinanceiro: indAjustavelVales
                ? { indicador: indAjustavelVales, unidade: unidade.codigo, mes, ajusteAtual: ajusteVales, valorAutomatico: valorDreVales }
                : undefined,
            })
          }
        }

        // Indicador Avaria de Transporte (só a RV de Empurrada usa) — mesmo
        // resultado do indicador Vales (soma da diferença do DRE, contas
        // 052/053, independente do negócio), mas com meta direta em R$ (não
        // % da Meta de Perdas anual como Distribuição/Financeiro usam).
        // Peso único, direto da tabela.
        if (incluirAvariaTransporte && avariaTransporteMeta && avariaTransporteMeta.peso > 0) {
          let status: StatusItem
          let detalhe: string
          let resultadoFmt: string | null = null
          if (rowsMes.length === 0) {
            status = 'pendente'
            detalhe = 'Sem DRE importado pro mês'
          } else {
            const resultado = rowsMes
              .filter(r => r.conta_codigo.startsWith('051') || r.conta_codigo.startsWith('052'))
              .reduce((acc, r) => acc + (r.diferenca ?? 0), 0)
            status = resultado >= avariaTransporteMeta.meta_valor ? 'bateu' : 'perdeu'
            detalhe = `Resultado R$ ${fmtValor(resultado)} · Meta R$ ${fmtValor(avariaTransporteMeta.meta_valor)}`
            resultadoFmt = `R$ ${fmtValor(resultado)}`
          }
          itens.push({
            chave: 'avaria_transporte',
            rotulo: 'Avaria de Transporte',
            peso: avariaTransporteMeta.peso,
            status,
            detalhe: `Peso ${fmtPeso(avariaTransporteMeta.peso)}% · ${detalhe}`,
            metaFmt: `R$ ${fmtValor(avariaTransporteMeta.meta_valor)}`,
            resultadoFmt,
          })
        }

        // Indicadores GTY/TMV/Tempo de Rendição (só a RV de Empurrada usa) —
        // nomes T1 de indicadores já cadastrados/importados na Reunião
        // Resultados (setor Distribuição, fonte='importado'): resultado/meta
        // já vêm prontos de lá, sem reimportar nada aqui — só peso próprio.
        // Direção (maior/menor melhor) usa a mesma `natureza` cadastrada no
        // indicador e o mesmo `calcularSemaforo` que a Reunião Resultados usa.
        for (const [incluir, peso, nome, chave] of [
          [incluirGty, gtyPeso, 'GTY', 'gty'],
          [incluirTmv, tmvPeso, 'TMV', 'tmv'],
          [incluirTempoRendicao, rendicaoPeso, 'TEMPO RENDIÇÃO', 'tempo_rendicao'],
        ] as const) {
          if (!incluir || !peso || peso <= 0) continue
          const indConfig = indicadoresImportadosDistribuicao.find(i => i.ano === ano && (i.nome === nome || i.nome_t1 === nome))
          let status: StatusItem
          let detalhe: string
          let metaFmt: string | null = null
          let resultadoFmt: string | null = null
          const linhaResultado = indConfig
            ? resultadosImportadosDistribuicao.find(r => r.indicador_id === indConfig.id && r.unidade === unidade.codigo && r.negocio === 'CONS' && r.mes === mes)
            : undefined
          if (!indConfig) {
            status = 'pendente'
            detalhe = 'Indicador não cadastrado na Reunião Resultados pro ano'
          } else if (!linhaResultado || linhaResultado.resultado === null) {
            status = 'pendente'
            detalhe = 'Sem resultado importado pro mês'
          } else {
            const bateu = calcularSemaforo(linhaResultado.resultado, linhaResultado.meta, indConfig.natureza).corClasse === 'positivo'
            status = bateu ? 'bateu' : 'perdeu'
            resultadoFmt = formatarResultado(linhaResultado.resultado, indConfig.formato)
            metaFmt = linhaResultado.meta !== null ? formatarResultado(linhaResultado.meta, indConfig.formato) : null
            detalhe = `Resultado ${resultadoFmt}${metaFmt ? ` · Meta ${metaFmt}` : ''}`
          }
          itens.push({
            chave,
            rotulo: nome === 'TEMPO RENDIÇÃO' ? 'Tempo de Rendição' : nome,
            peso,
            status,
            detalhe: `Peso ${fmtPeso(peso)}% · ${detalhe}`,
            metaFmt,
            resultadoFmt,
          })
        }

        // Indicador LogOn DU (resultado do BI × meta única) — mesma planilha
        // compartilhada de Devolução/Presenteísmo DU, filtrada pelo
        // indicador. Quanto maior melhor. Sem peso cadastrado pra
        // SUPERVISOR DU — não conta pra essa função.
        if (incluirLogonDu && logonDuMeta) {
          const peso = pesoDistribuicao('logon_du')
          if (peso && peso > 0) {
            const resultadosLogonDu = resultadosDistribuicaoBi.filter(r => r.indicador === 'aderencia_logon_du' && r.unidade === unidade.codigo)
            const negociosLogonDu = resultadosLogonDu.map(r => r.negocio)
            const negocioLogonDu = negocioDreDaPessoa(unidade.codigo, unidade.nome, pessoa.negocio, negociosLogonDu)
            const resultado = resultadosLogonDu.find(r => r.negocio === negocioLogonDu && r.ano === ano && r.mes === mes)?.valor
            let status: StatusItem
            let detalhe: string
            if (resultado === undefined) {
              status = 'pendente'
              detalhe = 'Sem resultado importado pro mês'
            } else {
              status = resultado >= logonDuMeta.meta_pct ? 'bateu' : 'perdeu'
              detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(logonDuMeta.meta_pct)}%`
            }
            itens.push({
              chave: 'logon_du',
              rotulo: 'LogOn DU',
              peso,
              status,
              detalhe: `Peso ${fmtPeso(peso)}% · ${detalhe}`,
              metaFmt: `${fmtPct(logonDuMeta.meta_pct)}%`,
              resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
            })
          }
        }

        // Indicador Devolução (resultado do BI × meta por unidade) — quanto
        // menor melhor (devolução é perda).
        if (incluirDevolucao) {
          const peso = pesoDistribuicao('devolucao')
          if (peso && peso > 0) {
            const metaDevolucao = devolucaoMetas.get(unidade.codigo)
            const resultadosDevolucao = resultadosDistribuicaoBi.filter(r => r.indicador === 'devolucao_pdv' && r.unidade === unidade.codigo)
            const negociosDevolucao = resultadosDevolucao.map(r => r.negocio)
            const negocioDevolucao = negocioDreDaPessoa(unidade.codigo, unidade.nome, pessoa.negocio, negociosDevolucao)
            const resultado = resultadosDevolucao.find(r => r.negocio === negocioDevolucao && r.ano === ano && r.mes === mes)?.valor
            let status: StatusItem
            let detalhe: string
            if (metaDevolucao === undefined) {
              status = 'pendente'
              detalhe = 'Sem meta de Devolução cadastrada pra unidade'
            } else if (resultado === undefined) {
              status = 'pendente'
              detalhe = `Meta ${fmtPct(metaDevolucao)}% · sem resultado importado`
            } else {
              status = resultado <= metaDevolucao ? 'bateu' : 'perdeu'
              detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(metaDevolucao)}%`
            }
            itens.push({
              chave: 'devolucao',
              rotulo: 'Devolução',
              peso,
              status,
              detalhe: `Peso ${fmtPeso(peso)}% · ${detalhe}`,
              metaFmt: metaDevolucao !== undefined ? `${fmtPct(metaDevolucao)}%` : null,
              resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
            })
          }
        }

        // Indicador Presenteísmo DU (meta mensal por unidade, importada todo
        // mês; resultado do BI) — quanto menor melhor (presenteísmo é ruim).
        if (incluirPresenteismoDu) {
          const peso = pesoDistribuicao('presenteismo_du')
          if (peso && peso > 0) {
            const metaPresenteismoDu = presenteismoDuMetas.find(m => m.unidade === unidade.codigo && m.ano === ano && m.mes === mes)
            const resultadosPresenteismoDu = resultadosDistribuicaoBi.filter(r => r.indicador === 'presenteismo_du' && r.unidade === unidade.codigo)
            const negociosPresenteismoDu = resultadosPresenteismoDu.map(r => r.negocio)
            const negocioPresenteismoDu = negocioDreDaPessoa(unidade.codigo, unidade.nome, pessoa.negocio, negociosPresenteismoDu)
            const resultado = resultadosPresenteismoDu.find(r => r.negocio === negocioPresenteismoDu && r.ano === ano && r.mes === mes)?.valor
            let status: StatusItem
            let detalhe: string
            if (!metaPresenteismoDu) {
              status = 'pendente'
              detalhe = 'Sem meta importada pro mês'
            } else if (resultado === undefined) {
              status = 'pendente'
              detalhe = `Meta ${fmtPct(metaPresenteismoDu.valor)}% · sem resultado importado`
            } else {
              status = resultado <= metaPresenteismoDu.valor ? 'bateu' : 'perdeu'
              detalhe = `Resultado ${fmtPct(resultado)}% · Meta ${fmtPct(metaPresenteismoDu.valor)}%`
            }
            itens.push({
              chave: 'presenteismo_du',
              rotulo: 'Presenteísmo DU',
              peso,
              status,
              detalhe: `Peso ${fmtPeso(peso)}% · ${detalhe}`,
              metaFmt: metaPresenteismoDu ? `${fmtPct(metaPresenteismoDu.valor)}%` : null,
              resultadoFmt: resultado !== undefined ? `${fmtPct(resultado)}%` : null,
            })
          }
        }
      }

      const pctPossivel = itens.reduce((acc, i) => acc + i.peso, 0)
      const pctConquistado = itens.filter(i => i.status === 'bateu').reduce((acc, i) => acc + i.peso, 0)
      return {
        pessoa,
        unidadeOk: unidade !== undefined,
        itens,
        pctPossivel,
        pctConquistado,
        aReceber: pessoa.valor * pctConquistado / 100,
      }
    }).sort((a, b) =>
      a.pessoa.operacao.localeCompare(b.pessoa.operacao) || a.pessoa.nome.localeCompare(b.pessoa.nome),
    )
  }, [liderancasSetor, metas, resultados, pesosDre, rowsDre, orcamentos, unidades, estanciaCodigo, armazemT1Codigos, verAno, verMes, filtroOperacao, indicadoresDre, incluirDtoT2, resultadosDtoT2, dtoT2Meta, incluirDtoT1, resultadosDtoT1, dtoT1Metas, incluirGsd, resultadosGsd, gsdMeta, incluirLogon, resultadosLogon, logonMeta, incluirExcessoVelocidade, resultadosExcessoVelocidade, excessoVelocidadeMetas, incluirFai, resultadosFai, faiMetas, incluirTri, resultadosTri, triMeta, indisponibilidadeTabela, resultadosIndisponibilidade, indisponibilidadeMeta, valesPerdasTabela, metasPerdasVales, valesMeta, incluirGty, incluirTmv, incluirTempoRendicao, gtyPeso, tmvPeso, rendicaoPeso, indicadoresImportadosDistribuicao, resultadosImportadosDistribuicao, incluirAvariaTransporte, avariaTransporteMeta, incluirPacoteGenteDu, incluirLogonDu, incluirDevolucao, incluirPresenteismoDu, resultadosDistribuicaoBi, logonDuMeta, devolucaoMetas, presenteismoDuMetas, pesosPorFuncaoDistribuicao, incluirDescontoCivf, resultadosDescontoCivf, descontoCivfMeta, incluirDescontoStressTest, resultadosDescontoStressTest, descontoStressTestMeta, incluirFrotaT1, frotaManutencaoCodigos, cdrBahiaCodigo, adChecklistMeta, resultadosAdChecklist, adMilimetragemMeta, resultadosAdMilimetragem, indispManutencaoMeta, resultadosIndispManutencao, dispEmpilhadeiraMeta, resultadosDispEmpilhadeira, incluirArmazemEfc, armazemEfcMetas, armazemEfcPeso, incluirArmazemTmaT2, armazemTmaT2Metas, armazemTmaT2Peso, incluirArmazemPresenteismoAlT2, armazemPresenteismoAlT2Metas, armazemPresenteismoAlT2Peso, incluirArmazemRefugo, armazemRefugoMeta, resultadosArmazemBi, incluirArmazemTmaT1, armazemTmaT1Metas, armazemTmaT1Peso, incluirArmazemDisponibilidadeGenteT1, armazemDisponibilidadeGenteT1Metas, armazemDisponibilidadeGenteT1Peso, incluirArmazemPresenteismoAlT1, armazemPresenteismoAlT1Metas, armazemPresenteismoAlT1Peso, resultadosArmazemT1Bi, incluirArmazemQuebras, armazemQuebrasMeta, armazemT1QuebrasMeta, resultadosArmazemQuebras, mapaAjustesFin])

  const totalBase = linhas.reduce((acc, l) => acc + l.pessoa.valor, 0)
  const totalReceber = linhas.reduce((acc, l) => acc + l.aReceber, 0)

  const carregandoTudo = carregando || loadingDre || loadingOrcamento

  return {
    liderancas,
    linhas,
    anosDisponiveis,
    verAno,
    setVerAno: setVerAnoInterno,
    verMes,
    setVerMes: setVerMesInterno,
    filtroOperacao,
    setFiltroOperacao,
    operacoesDisponiveis,
    carregandoTudo,
    totalBase,
    totalReceber,
  }
}
