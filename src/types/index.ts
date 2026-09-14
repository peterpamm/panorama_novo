export type Natureza = 'custo' | 'performance'

export interface PacoteInfo {
  nome: string
  natureza: Natureza
  prefixos: string[]
}

export type TipoPeriodo = 'MENSAL' | 'ACUMULADO_ANO'

/** Linha no formato longo (equivalente ao historico_dre.csv antigo), vinda de vw_dre_longo. */
export interface DreLongoRow {
  unidade: string
  negocio: string
  ano: number
  mes: number
  tipo_periodo: TipoPeriodo
  conta_codigo: string
  remunerado: number | null
  realizado: number | null
  diferenca: number | null
  /** Meta mensal por conta, exportada pelo próprio GInfo — não usada nos cálculos do Farol (que usam a tabela `metas`, por pacote). */
  avo: number | null
  avr: number | null
}

/**
 * Linha normalizada para os cálculos do Farol, equivalente às colunas
 * REMUN/REAL/DIF/AVR do historico_dre.csv antigo (produzidas por
 * tratar_dre_pro.py a partir do DreLongoRow bruto): `real` e `remun` são
 * sempre valores absolutos (magnitude), `dif` mantém o sinal original
 * (REALIZADO-REMUNERADO), e `avr` tem o sinal invertido para toda conta
 * que não seja EBITDA (233) ou Geração de Caixa (276) — ver normalizarParaCalculo.
 */
export interface DreCalculoRow {
  conta_codigo: string
  real: number
  remun: number
  dif: number
  avr: number
  /** Meta (%) por conta vinda do GInfo, mesmo sinal/inversão do avr; null quando o período não tem AVO (ex: importado antes da migração 001). */
  avo: number | null
}

export interface Meta {
  id?: string
  unidade: string
  negocio: string
  ano: number
  codigo: string
  mes: number // 0 = anual, 1-12 = mensal
  meta_avr: number
}

/** Meta de Perdas — só por unidade + ano (sempre consolidado, sem quebra mensal), base do futuro Painel de Perdas. */
export interface MetaPerdas {
  id?: string
  unidade: string
  ano: number
  /** % de perdas sobre o faturamento, negativo (ex: -2.42). */
  meta_pct: number
  /** Meta financeira anual em R$, negativo. */
  meta_anual: number
}

/** Meta anual (R$) de um indicador que compõe o total de metas_perdas — ver INDICADORES_PERDAS em painel-perdas-calculations.ts. */
export interface MetaPerdaIndicador {
  id?: string
  unidade: string
  ano: number
  indicador: string
  /** Máximo a perder no ano nesse indicador (R$, negativo — 0 = sem meta pra perder). */
  meta_anual: number
}

export interface Unidade {
  id: string
  nome: string
  codigo: string
  /** Nome completo usado pelo GInfo no arquivo de download (ex: "FOZ_DO_IGUACU"), pra reconhecimento automático na importação em massa. */
  nome_ginfo: string | null
  /** Data (YYYY-MM-DD) em que a unidade começou a operar — null se já existia antes de qualquer dado importado. Usado pra ajustar a meta de Redução de Custos em anos em que a unidade só tem histórico parcial. */
  data_entrada: string | null
  /** Nomes alternativos vindos de arquivos externos (BI da Ambev etc) — ex: CAMACARI ← ["CDL CAMAÇARI", "CDR BAHIA"]. */
  apelidos?: string[] | null
}

/** Meta de gente (BI da Ambev): indicador × operação do BI × ano × mês, valor em %. */
export interface MetaGente {
  id?: string
  indicador: string
  /** Unidade resolvida pelos apelidos — pode repetir entre operações (ex: CDL CAMAÇARI e CDR BAHIA → CAMACARI). */
  unidade: string
  /** Nome original da operação no BI — parte da chave, preserva metas distintas da mesma unidade (rota vs empurrada). */
  operacao_bi: string
  /** Negócio da operação (ROTA/ARMAZEM/...) — auto-sugerido pelo prefixo (CDL→ROTA, CDR→ARMAZEM), editável na tela. */
  negocio: string
  /** Peso (%) desse indicador na RV dessa operação — cadastro manual (varia por operação: ex. rota de Camaçari 30%, Foz 15%+15%). */
  peso: number
  ano: number
  mes: number
  valor: number
}

/** Alteração retroativa detectada num mês já encerrado ao reimportar uma unidade/negócio/ano (espelha importacoes_alteracoes). */
export interface AlteracaoRetroativa {
  id?: string
  importacao_id: string
  unidade: string
  negocio: string
  ano: number
  conta_codigo: string
  campo: string
  valor_antigo: number | null
  valor_novo: number | null
}

/** RV (remuneração variável) por liderança — cadastro corrente, atualizado por upsert no nome. */
export interface RvLideranca {
  id?: string
  /** Matrícula da liderança — exigida pelo time de Matriz/Folha pra importar o valor de RV na folha de pagamento. */
  matricula: string | null
  operacao: string
  /** ROTA / ARMAZEM / EMPURRADA etc — usado depois pra puxar o resultado separado do DRE. */
  negocio: string
  setor: string
  funcao: string
  nome: string
  valor: number
}

/** Resultado mensal (realizado) de um indicador de gente, importado do BI pelo corporativo. */
export interface ResultadoGente {
  id?: string
  indicador: string
  unidade: string
  operacao_bi: string
  ano: number
  mes: number
  valor: number
}

/** Resultado mensal do indicador DTO T2 (segurança) — % realizado importado do BI, direto por unidade (sem operação/negócio). */
export interface ResultadoDtoT2 {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/** Meta (%) e peso do indicador DTO T2 — cadastro único, vale pra todas as unidades. */
export interface DtoT2Meta {
  meta_pct: number
  peso: number
}

/** Resultado mensal (R$) do indicador Desconto CIVF (frota) — direto por unidade, coluna CIVF da planilha de Resultado. */
export interface ResultadoDescontoCivf {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/** Resultado mensal (R$) do indicador Desconto Stress Test (frota) — direto por unidade, coluna TT STRESS TEST da planilha de Resultado. */
export interface ResultadoDescontoStressTest {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/**
 * Indicadores novos da RV de Frota (2026) — específicos das 3 lideranças T1
 * (Estância, Ponta Grossa e CDR Bahia — ver `OPERACOES_FROTA_T1`,
 * rv-frota-t1.ts). Resultado por unidade/mês (importado); meta e peso são
 * ÚNICOS por indicador (migration 108) — não variam por unidade, mesmo
 * padrão de `rv_desconto_civf_meta`. Todos em % (`meta_pct`), inclusive
 * Disponibilidade Empilhadeira (migration 109 — quanto maior melhor).
 * Custos Gerais (DRE 114) não entra aqui — resultado vem do DRE (AVR) e meta
 * do Orçamento, igual Manutenção/Pneus/Diesel; o peso mora na mesma tabela
 * deles (`rv_frota_pesos_dre`, id '114' — ver `CUSTOS_GERAIS_FROTA_DRE`,
 * constants.ts).
 */

export interface RvFrotaAdChecklistMeta {
  meta_pct: number
  peso: number
}

export interface ResultadoAdChecklistFrota {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

export interface RvFrotaAdMilimetragemMeta {
  meta_pct: number
  peso: number
}

export interface ResultadoAdMilimetragemFrota {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/** Indisponibilidade Manutenção — só Estância e Ponta Grossa (ver `OPERACOES_FROTA_MANUTENCAO`). */
export interface RvFrotaIndispManutencaoMeta {
  meta_pct: number
  peso: number
}

export interface ResultadoIndispManutencaoFrota {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/** Disponibilidade Empilhadeira — só CDR Bahia (ver `OPERACOES_FROTA_EMPILHADEIRA`); meta em %, quanto maior melhor. */
export interface RvFrotaDispEmpilhadeiraMeta {
  meta_pct: number
  peso: number
}

export interface ResultadoDispEmpilhadeiraFrota {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/**
 * Resultado mensal do indicador DTO T1 (segurança) — % calculado a partir da
 * planilha de inspeções por colaborador (só ESTÂNCIA e CDR BAHIA se enquadram):
 * (total de colaboradores da unidade − colaboradores com "Dias Para Realizar
 * Inspeção" negativo) / total.
 */
export interface ResultadoDtoT1 {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/** Meta (%) e peso do indicador DTO T1 — cadastro por unidade (só ESTÂNCIA e CDR BAHIA). */
export interface DtoT1Meta {
  unidade: string
  meta_pct: number
  peso: number
}

/**
 * Resultado mensal do indicador GSD (segurança) — % calculado a partir da
 * planilha por colaborador (colunas Filial/Status): (total de colaboradores
 * da unidade − colaboradores com Status "FORA DO PRAZO") / total.
 */
export interface ResultadoGsd {
  id?: string
  unidade: string
  /** ROTA (prefixo CDL) / ARM (prefixo CDR) / CONS nas demais — mesmo split do LogOn. */
  negocio: string
  ano: number
  mes: number
  valor: number
}

/** Meta (%) e peso do indicador GSD — cadastro único, vale pra todas as unidades. */
export interface GsdMeta {
  meta_pct: number
  peso: number
}

/**
 * Resultado mensal do indicador LogOn (segurança) — % de "Aderência Total da
 * Trilha" importado direto da planilha (já vem pronto por unidade, sem
 * precisar calcular a partir de colaborador por colaborador). `negocio`
 * separa ROTA/ARM quando a planilha traz as duas operações da mesma
 * unidade (ex: CDL CAMAÇARI × CDR BAHIA, ambas Camaçari) — CONS quando a
 * unidade não abre por negócio.
 */
export interface ResultadoLogon {
  id?: string
  unidade: string
  negocio: string
  ano: number
  mes: number
  valor: number
}

/** Meta (%) e peso do indicador LogOn — cadastro único, vale pra todas as unidades. */
export interface LogonMeta {
  meta_pct: number
  peso: number
}

/**
 * Resultado mensal do indicador Excesso de Velocidade (segurança) —
 * contagem de excessos (linhas da planilha onde EXCESSO > LIMIAR) por
 * unidade. Não vale pra ESTÂNCIA nem pra Camaçari ARM (empurrada) — o
 * import já filtra essas linhas fora, então a contagem de Camaçari aqui é
 * só da ROTA. Quanto menor melhor.
 */
export interface ResultadoExcessoVelocidade {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/** Meta (máximo de excessos permitido) e peso do indicador Excesso de Velocidade — cadastro por unidade. */
export interface ExcessoVelocidadeMeta {
  unidade: string
  meta_max: number
  peso: number
}

/**
 * Resultado mensal do indicador FAI (segurança) — contagem de ocorrências
 * com TIPO = "FAI" por unidade. Só ESTÂNCIA e CDR BAHIA (Camaçari ARM) se
 * enquadram — é o indicador que compensa essas duas unidades, que ficam de
 * fora do Excesso de Velocidade. Quanto menor melhor.
 */
export interface ResultadoFai {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/** Meta (máximo de FAI permitido) e peso do indicador FAI — cadastro por unidade (só ESTÂNCIA e CDR BAHIA). */
export interface FaiMeta {
  unidade: string
  meta_max: number
  peso: number
}

/**
 * Resultado mensal do indicador TRI (acidente grave) — quantidade de
 * acidentes graves da unidade no mês. Não tem planilha de importação: é tão
 * raro (nenhum desde o ano passado) que só existe registro manual quando
 * acontece um — unidade/mês sem registro aqui conta como zero na apuração.
 */
export interface ResultadoTri {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/**
 * Disponibilidade Rota acumulada (Importação > Financeiro > Dados
 * auxiliares) — snapshot único por unidade, sem ano/mês (já vem acumulado
 * da fonte); cada importação substitui o conteúdo inteiro da tabela.
 * Alimenta o indicador "Disp. Rota" do Farol Gerentes. `meta`/`real` em
 * escala de percentual (ex: 85.3 = 85,3%).
 */
export interface DisponibilidadeRotaAcumulada {
  id?: string
  unidade: string
  meta: number
  real: number
}

/**
 * Disponibilidade Armazém acumulada (Importação > Financeiro > Dados
 * auxiliares) — mesmo espírito da `DisponibilidadeRotaAcumulada`, snapshot
 * único por unidade. `meta` é opcional aqui: quando a planilha não traz a
 * coluna de meta, a importação preserva a última meta já salva (só
 * atualiza `real`) — por isso pode ficar `null` até a primeira importação
 * que trouxer meta pra aquela unidade. Alimenta o "Disp. Armazém" do Farol
 * Gerentes.
 */
export interface DisponibilidadeArmazemAcumulada {
  id?: string
  unidade: string
  meta: number | null
  real: number
}

/**
 * Scorecard acumulado (Importação > Financeiro > Dados auxiliares) —
 * snapshot único por unidade × negócio, sem ano/mês; cada importação
 * substitui o conteúdo inteiro da tabela. O `negocio` vem do "Canal" da
 * planilha ("Apoio Logístico" = ARM, "Distribuição Urbana" = ROTA,
 * "Empurrada" = EMP, ver `scorecard-parser.ts`). `score` em escala de
 * percentual (ex: 97.4 = 97,4%); a meta é fixa em 80% no código
 * (`META_SCORECARD`), não vem da planilha. Alimenta as linhas "Scorecard
 * Rota./Arm./Empur." do Farol Gerentes.
 */
export interface ScorecardAcumulado {
  id?: string
  unidade: string
  negocio: 'ARM' | 'ROTA' | 'EMP'
  score: number
}

/** Meta (máximo de TRI) e peso do indicador TRI — cadastro único, vale pra todas as unidades. */
export interface TriMeta {
  meta_max: number
  peso: number
}

/**
 * Linha de orçamento — DRE resumido (só as contas orçadas) por
 * unidade/negócio/ano/mês/conta, espelhando a planilha "ORÇAMENTOS". `mes` é
 * 0 pro bloco TOTAL (meta do ano) e 1-12 pros meses. `orcado` é o valor em R$
 * (gasto, ou faturamento nas contas de receita); `av` é o AVR orçado (%),
 * mesma base usada nas metas do Farol; `ah` é importado mas ainda não usado
 * em nenhum cálculo. `conta_codigo`/`conta_nome` vêm direto da planilha de
 * orçamento — a numeração é própria dela (tem menos linhas que o plano de
 * contas do DRE) e não é garantido bater com a tabela `contas`.
 */
export interface OrcamentoLinha {
  id?: string
  unidade: string
  negocio: string
  ano: number
  mes: number
  conta_codigo: string
  conta_nome: string
  orcado: number
  av: number
  ah: number
  /** Valor de `orcado` antes da primeira edição manual — null se nunca foi editado. */
  orcado_original?: number | null
  /** true quando o `orcado` foi corrigido manualmente na tela (não veio direto da última importação). */
  orcado_editado_manualmente?: boolean
  /** Valor de `av` antes da primeira edição manual — null se nunca foi editado. */
  av_original?: number | null
  /** true quando o `av` foi corrigido manualmente na tela (não veio direto da última importação). */
  av_editado_manualmente?: boolean
}

/**
 * Rotina financeira (catálogo da Área Financeira > Rotinas) — substitui o GOP
 * em planilha. `nome`/`prazo` são editáveis livremente porque o status mensal
 * (RotinaFinanceiraStatus) referencia a rotina por `id`, não por texto.
 */
/**
 * Como ler o `prazo_dia` de uma rotina: dia do mês, n-ésimo dia útil, ou
 * nenhum dia (prazo que depende de outro evento). Ver `rotina-prazo.ts`.
 */
export type PrazoTipo = 'dia_fixo' | 'dia_util' | 'sem_data'

export interface RotinaFinanceira {
  id?: string
  setor: string
  nome: string
  /** Texto livre do prazo, ex: "Dia 10", "4º dia útil", "1 dia após envio da matriz". É o que aparece na tela. */
  prazo: string
  /**
   * Versão estruturada do prazo (migration 099), usada só pra posicionar a
   * rotina no Calendário — ver `rotina-prazo.ts`. 'sem_data' (padrão) = fica
   * na lista de "sem data definida", fora da grade.
   */
  prazo_tipo: PrazoTipo
  /** Dia do mês (prazo_tipo 'dia_fixo') ou o n-ésimo dia útil ('dia_util'); null em 'sem_data'. */
  prazo_dia: number | null
  ordem: number
  ativo: boolean
}

/** Valor de `unidade` num ajuste de dia que vale pra todas as unidades (sentinela, ver migration 100). */
export const AJUSTE_TODAS_UNIDADES = '*'

/**
 * Ajuste de dia de uma rotina no Calendário (migration 100) — o resultado de
 * arrastar o chip. Exceção por cima do prazo cadastrado; qual vence quando
 * mais de um se aplica está em `rotina-ajuste-dia.ts`.
 */
export interface RotinaAjusteDia {
  id?: string
  rotina_id: string
  /** Código da unidade, ou `AJUSTE_TODAS_UNIDADES` ('*') quando vale pra todas. */
  unidade: string
  /** Mês em que foi arrastado — com `permanente`, é a vigência inicial. */
  ano: number
  mes: number
  dia: number
  /** false = só nesse mês; true = desse mês em diante. */
  permanente: boolean
}

export type EventoRecorrencia = 'unico' | 'semanal' | 'mensal'
export type EventoCor = 'roxo' | 'azul' | 'ambar' | 'verde'

/**
 * Evento do Calendário (migration 101, `unidades` migration 105) — RPS,
 * visita, o que a unidade precisar ver na agenda. NÃO é rotina: não tem
 * OK/NOK e não entra na aderência nem em pontuação nenhuma.
 */
export interface CalendarioEvento {
  id?: string
  titulo: string
  descricao: string
  /** Códigos das unidades que o evento vale — pode ter mais de uma; `[AJUSTE_TODAS_UNIDADES]` ('*') quando vale pra todas. */
  unidades: string[]
  tipo: EventoRecorrencia
  /** 0=domingo … 6=sábado — só em `tipo` 'semanal'. */
  dia_semana: number | null
  /** Dia do mês (31 = último dia) — só em `tipo` 'mensal'. */
  dia_mes: number | null
  /** Evento único: a data dele. Semanal/mensal: a partir de quando vale. Formato YYYY-MM-DD. */
  data_inicio: string
  /** Quando deixa de valer (YYYY-MM-DD); null = sem fim. */
  data_fim: string | null
  cor: EventoCor
}

/**
 * Exceção de dia de UMA ocorrência de um evento do Calendário (migration
 * 106) — o resultado de arrastar o chip do evento. `dia_original` identifica
 * qual ocorrência está sendo movida (um evento semanal pode cair várias
 * vezes no mesmo mês); sempre pontual, sem versão "permanente" como
 * `RotinaAjusteDia` — mover um evento é sempre sobre essa ocorrência
 * específica (ver `agruparEventosPorDia`, calendario-eventos.ts).
 */
export interface CalendarioEventoAjusteDia {
  id?: string
  evento_id: string
  /** Código da unidade, ou `AJUSTE_TODAS_UNIDADES` ('*') quando vale pra todas as unidades do evento. */
  unidade: string
  ano: number
  mes: number
  dia_original: number
  dia_novo: number
}

/** Status (OK/NOK/N-A) de uma rotina financeira, por unidade e mês — null = ainda não preenchido. */
export interface RotinaFinanceiraStatus {
  id?: string
  rotina_id: string
  unidade: string
  ano: number
  mes: number
  status: 'OK' | 'NOK' | 'N/A' | null
  observacao: string
}

export type PlanoAcaoStatus = 'pendente' | 'em_andamento' | 'concluido' | 'validado'

/**
 * Plano de Ação (Área Financeira) — ação atribuída a uma unidade, com prazo
 * e tag livre. Status muda só via `registrar_status_plano_acao` (RPC), nunca
 * por UPDATE direto — por isso não tem um "setStatus" aqui, só leitura.
 */
export interface PlanoAcao {
  id: string
  unidade: string
  titulo: string
  descricao: string
  responsavel: string
  tag: string
  prazo: string // date (YYYY-MM-DD)
  status: PlanoAcaoStatus
  criado_por_email: string | null
  criado_por_role: string | null
  created_at: string
  updated_at: string
}

/** Uma entrada do histórico de mudança de status de um Plano de Ação. */
export interface PlanoAcaoHistorico {
  id: string
  plano_id: string
  status_anterior: PlanoAcaoStatus
  status_novo: PlanoAcaoStatus
  observacao: string
  usuario_email: string | null
  usuario_role: string | null
  usuario_unidade: string | null
  created_at: string
}

/**
 * Indicadores "de resultado" do SDG Financeiro (apresentação) — cada um com
 * slide próprio, fora Encontro de Contas/Rotinas/Plano de Ação (esses já são
 * o próprio acompanhamento). Vales abre em 4 slides (Financeiros/Físicos/
 * Refugo/Quebras, cada um com sua Justificativa e ações) — o pacote geral
 * ('vales') não mostra Justificativa própria, só cards/gráfico/ranking.
 */
export type SdgIndicador =
  | 'ebitda' | 'adm-geral' | 'despesa-adm' | 'vales' | 'multas'
  | 'vales-financeiros' | 'vales-fisicos' | 'refugo' | 'quebras'
  | 'encontro-contas'
  /** Slide final — texto livre (usa só `pontos_positivos`), sem ações do Plano de Ação vinculadas. */
  | 'assuntos-gerais'

/** Catálogo padrão de tags do Plano de Ação (Cadastro, admin-only) — substitui o texto livre de antes. `sdg_indicador` é opcional: quando setado, as ações com essa tag aparecem no slide daquele indicador no SDG. */
export interface PlanoAcaoTag {
  id: string
  nome: string
  ativo: boolean
  ordem: number
  sdg_indicador: SdgIndicador | null
}

/**
 * Justificativa do mês de um indicador do SDG (Área Financeira > SDG
 * Financeiro) — Pontos Positivos/Negativos em texto livre (uma ideia por
 * linha), editados pela própria unidade (ou pelo admin em nome dela) antes da
 * reunião, e só exibidos (read-only) no modo apresentação. Sem histórico —
 * é só o apoio da fala, não um status auditado.
 */
export interface SdgJustificativa {
  id: string
  unidade: string
  ano: number
  mes: number
  indicador: SdgIndicador
  pontos_positivos: string
  pontos_negativos: string
  /** Caminho no bucket `sdg-prints` (Storage) do print anexado pela unidade — null = nenhum anexado. Sempre .jpg (recomprimido no upload, ver comprimirImagem). */
  print_path: string | null
  updated_by_email: string | null
  created_at: string
  updated_at: string
}

/** Status do EC (chamado de desconto da Ambev) — mesmo enum/fluxo do Plano de Ação: unidade avança até 'concluido', só admin valida. */
export type EncontroContasStatus = 'pendente' | 'em_andamento' | 'concluido' | 'validado'

/** Categoria cadastrável do motivo de um EC (Encontro de Contas > Tratativas — CRUD embutido no Select de Motivo). */
export interface EncontroContasMotivo {
  id: string
  nome: string
  ativo: boolean
  ordem: number
}

/**
 * EC (chamado de desconto da Ambev) — Encontro de Contas (Área Financeira).
 * `unidade` fica null até alguém atribuir (a planilha importada não traz
 * unidade); um EC de mais de uma unidade vira N linhas com o mesmo
 * `numero_chamado` (ver "Desmembrar"). Status muda só via
 * `registrar_status_encontro_contas` (RPC); `justificativa` muda só via
 * `atualizar_justificativa_encontro_contas` (RPC, unidade só edita a
 * própria) — os demais campos são admin-only, por UPDATE direto.
 */
export interface EncontroContas {
  id: string
  data: string // date (YYYY-MM-DD)
  descricao_original: string
  numero_chamado: string
  solicitante: string
  valor: number
  unidade: string | null
  tem_evidencia: boolean
  motivo: string | null
  justificativa: string
  nota_debito: 'OK' | 'NOK' | 'N/A'
  status: EncontroContasStatus
  /** Setado pela RPC quando o status vira 'validado' — só existe aqui, o Plano de Ação não tem esse carimbo. */
  validado_por_email: string | null
  criado_por_email: string | null
  criado_por_role: string | null
  created_at: string
  updated_at: string
}

/** Uma entrada do histórico de mudança de status de um EC. */
export interface EncontroContasHistorico {
  id: string
  ec_id: string
  status_anterior: EncontroContasStatus
  status_novo: EncontroContasStatus
  observacao: string
  usuario_email: string | null
  usuario_role: string | null
  usuario_unidade: string | null
  created_at: string
}

export type ReuniaoSetor = 'financeiro' | 'gente' | 'frota' | 'seguranca' | 'armazem' | 'distribuicao'
export type ReuniaoFormato = 'percentual' | 'monetario' | 'duracao' | 'numero'
/**
 * 'perdas' = indicador do Painel de Perdas (fonte_chave = key de
 * INDICADORES_PERDAS); 'farol_pacote' = pacote do Farol (fonte_chave =
 * código de PACOTES); 'rotinas' = % de aderência das Rotinas Financeiras
 * (Área Financeira > Rotinas) — sem fonte_chave, só existe uma métrica;
 * 'termometro' = planilha mensal importada (aba Importação), sem meta — a
 * pontuação ganha é o próprio valor importado, capado no `pontos` cadastrado
 * — sem fonte_chave. 'importado' = planilha padrão de Reunião Resultados
 * (colunas Unidade/Indicador/Meta/Peso/Result/Pts — ver `Import_RR -
 * Arm&DU.xlsx`), meta/resultado/pontos vêm todos prontos da planilha, por
 * unidade — o app nunca calcula a pontuação desse fonte, só guarda o que
 * foi importado (`reuniao_resultados_mensais.meta`/`.pontos`) — sem
 * fonte_chave.
 */
export type ReuniaoFonte = 'manual' | 'perdas' | 'farol_pacote' | 'rotinas' | 'termometro' | 'importado'

/**
 * Indicador da Reunião Resultados (ranking mensal de pontos por setor, pra
 * eleger a melhor liderança — não é RV). `meta`/`pontos` são cadastrados por
 * ano (o mesmo indicador pode mudar de meta/pontos de um ano pro outro,
 * então ele é recriado, não editado retroativamente). Quando `fonte !==
 * 'manual'`, `meta` fica `null` (calculada em tempo real a partir de Metas
 * de Perdas/Orçamento/Metas de Rotinas — nunca um snapshot manual desatualizado) e
 * `natureza`/`formato` são derivados de `fonte_chave` (ver
 * `naturezaEFormatoAutomaticos` em `src/lib/reuniao-resultados.ts`).
 */
export interface ReuniaoIndicador {
  id: string
  setor: ReuniaoSetor
  ano: number
  nome: string
  /** Rótulo alternativo pra unidades T1 (ex: nome="DEV PDV", nome_t1="GTY") — qualquer setor/fonte pode usar, opcional. null = mesmo nome pros dois. */
  nome_t1: string | null
  /** Formato do lado `nome_t1`, se for diferente de `formato` (ex: nome="ON TIME" formato='percentual', nome_t1="TMV" formato_t1='duracao'). null = usa `formato` pros dois lados (caso comum — a maioria dos pares T1 é só rótulo diferente, mesmo tipo de valor). */
  formato_t1: ReuniaoFormato | null
  meta: number | null
  /** Só pra fonte 'perdas': quando preenchida, substitui a meta do Painel de Perdas (metas_perdas_indicadores/12) na apuração da Reunião — ex: meta combinada de 0 pra uma indicador que tem orçamento > 0. null = mantém a meta do Painel de Perdas. */
  meta_fixa: number | null
  formato: ReuniaoFormato
  natureza: Natureza
  pontos: number
  ordem: number
  ativo: boolean
  fonte: ReuniaoFonte
  fonte_chave: string | null
}

/**
 * Resultado mensal de um indicador da Reunião Resultados, por unidade+negócio
 * — `resultado` null = ainda não lançado. `negocio` é sempre 'CONS' exceto
 * Camaçari fora do Financeiro, que abre em 'ROTA'/'ARM' (dois gerentes
 * diferentes — ver `unidadesParticipaveis` em `reuniao-resultados.ts`).
 * `meta`/`pontos` só são usados pela fonte 'importado' (planilha já traz os
 * dois prontos) — as demais fontes deixam esses dois campos null.
 */
export interface ReuniaoResultadoMensal {
  id?: string
  indicador_id: string
  unidade: string
  negocio: string
  mes: number
  resultado: number | null
  meta: number | null
  pontos: number | null
  /**
   * Formato EFETIVO desse resultado, só pra fonte 'importado' com indicador
   * combinado (`nome_t1` preenchido) — a planilha diz por linha se aquele
   * valor é do lado `nome` ou `nome_t1` (coluna Indicador), e cada lado pode
   * ter um `formato`/`formato_t1` diferente (ex: ON TIME=% × TMV=duração);
   * gravado aqui na importação pra exibição não precisar re-adivinhar o lado
   * depois. null = usa o `formato` do indicador (todo o resto dos casos).
   */
  formato: ReuniaoFormato | null
}

/**
 * Setor do cadastro de pagamento — os 6 reais da Reunião Resultados, mais
 * 'empurrada': rótulo próprio de Ponta Grossa/Estância (única operação
 * dessas duas unidades, sem "Distribuição" tradicional), mas cujo VENCEDOR
 * do mês continua saindo do ranking do setor 'distribuicao' — 'empurrada' é
 * um alias de exibição/cadastro pra ele, nunca um setor com ranking próprio
 * (ver `setorCompativel`, reuniao-pagamento.ts).
 */
export type SetorPagamento = ReuniaoSetor | 'empurrada'

/**
 * Liderança cadastrada pra receber o prêmio da Reunião Resultados
 * (Reunião Resultados > Pagamento > Cadastro) — nome + cartão Extratta de
 * quem responde por um setor numa unidade×negócio. `negocio` só varia
 * (ROTA/ARM) pra Camaçari fora do Financeiro, mesma régua de
 * `unidadesParticipaveis` (reuniao-resultados.ts). Mais de uma pessoa na
 * mesma unidade×negócio×setor = o prêmio do mês é dividido entre elas (ver
 * `calcularPagamentos`, reuniao-pagamento.ts).
 */
export interface ReuniaoPagamentoLideranca {
  id?: string
  unidade: string
  negocio: string
  setor: SetorPagamento
  nome: string
  numero_extratta: string
}

/** Valor único do prêmio por setor vencido (migration 103) — singleton, dividido entre as lideranças cadastradas quando houver mais de uma. */
export interface ReuniaoPagamentoPremio {
  valor: number
}

/** Setores que têm um Ranking Ambev próprio — cada um com colocação independente (ex: 1º no de Gente, 3º no de Frota). */
export type ResumoGeralAmbevSetor = 'gente' | 'frota' | 'seguranca'

/** Indicador do Financeiro afetado pelo bug atual do DRE (não sobe a receita de multas/vales) — ver `FinanceiroDreAjuste`. */
export type FinanceiroDreAjusteIndicador = 'multas' | 'vales'

/**
 * Ajuste manual TEMPORÁRIO do valor de Multas ou Vales do Financeiro, por
 * unidade×ano×mês — solução pro bug do DRE que não soma a receita que a
 * unidade recebe da Ambev nessas contas (138/223 e 052/053), sem mexer na
 * base oficial do DRE. Só o dono cadastra (RLS `auth_dono()`, migration 104)
 * e só entra no cálculo da Reunião Resultados e da Remuneração Variável do
 * Financeiro — nunca no Painel de Perdas nem no DRE bruto (ver
 * `resultadoEMeta` em useReuniaoDados.ts e `ajustesFinanceiro` em
 * useRvApuracao.ts). Quando o DRE for corrigido retroativamente, essas
 * linhas ficam redundantes — é só apagar, sem mudar código.
 */
export interface FinanceiroDreAjuste {
  id?: string
  unidade: string
  ano: number
  mes: number
  indicador: FinanceiroDreAjusteIndicador
  valor: number
  observacao: string | null
}

/**
 * Posição da unidade em UM dos 3 Rankings Ambev, lançada manualmente pelo
 * admin — o bônus (1º=+50, 2º-5º=+30, resto=0) é calculado em código a
 * partir da posição, somado os 3, não guardado aqui (ver
 * `resumo-geral-calculations.ts`). `negocio` é 'CONS' pra quem não separa —
 * só Camaçari varia (CDL/Rota e CDR/Armazém têm colocações diferentes entre
 * si), mesma convenção do resto da Reunião Resultados.
 */
export interface ResumoGeralRankingAmbev {
  id?: string
  unidade: string
  negocio: string
  ano: number
  mes: number
  setor: ResumoGeralAmbevSetor
  posicao: number
}

/**
 * Acumulado de pontos de uma unidade até um mês de corte (`mes_final`, ex:
 * até Junho), por setor — importado de planilha (Resumo Geral > Importação
 * de Histórico: Unidade + uma coluna por setor; o mês de corte é escolhido
 * na tela, não vem por linha; a coluna Total da planilha é só informativa,
 * recalculada em código como a soma dos 6). No Ranking Anual (e no "YTD" do
 * Ranking por Setor), cada setor vira a base e o cálculo ao vivo soma só os
 * meses APÓS `mes_final` — nunca conta o mesmo mês duas vezes.
 */
export interface ResumoGeralHistorico {
  id?: string
  unidade: string
  ano: number
  mes_final: number
  financeiro: number
  gente: number
  frota: number
  seguranca: number
  distribuicao: number
  armazem: number
}

/** Registro de Indisponibilidade ou Devolução no Painel de Perdas (fonte AUX — não vem da DRE). */
export interface PainelPerdasAux {
  id?: string
  unidade: string
  ano: number
  mes: number
  indicador: 'indisponibilidade' | 'devolucao'
  valor: number
}

export interface Negocio {
  id: string
  codigo: string
  nome: string
}

export interface Conta {
  codigo: string
  descricao: string
  ordem: number
  nivel: number
  ativo: boolean
}

/**
 * Resultado mensal de um indicador de RV da Distribuição vindo do BI por
 * planilha compartilhada (indicador nas linhas — LogOn DU, Devolução,
 * Presenteísmo DU empilhados no mesmo arquivo, filtrados pela coluna
 * INDICADOR). `negocio` separa ROTA/ARM quando a unidade abre por negócio
 * (CDL/CDR) — CONS nas demais, mesma convenção do LogOn de Segurança.
 */
export interface ResultadoDistribuicaoBi {
  id?: string
  indicador: 'aderencia_logon_du' | 'devolucao_pdv' | 'presenteismo_du'
  unidade: string
  negocio: string
  ano: number
  mes: number
  valor: number
}

/** Resultado mensal dos indicadores do Armazém que vêm do BI (Presenteísmo AL, EFC, TMA, Refugo) — mesmo esquema do ResultadoDistribuicaoBi. */
export interface ResultadoArmazemBi {
  id?: string
  indicador: 'presenteismo_al' | 'efc' | 'tma' | 'refugo'
  unidade: string
  negocio: string
  ano: number
  mes: number
  valor: number
}

/** Meta (%) do EFC (Armazém T2) — diferente por unidade, vale o ano todo. Peso único (rv_armazem_efc_peso). */
export interface MetaArmazemEfc {
  unidade: string
  meta_pct: number
}

/** Meta (minutos) do TMA (Armazém T2) — diferente por unidade, vale o ano todo. Peso único (rv_armazem_tma_peso). */
export interface MetaArmazemTma {
  unidade: string
  meta_minutos: number
}

/** Meta mensal (%) do Presenteísmo AL (Armazém T2) — mesmo esquema do MetaPresenteismoDu. Peso único (rv_armazem_presenteismo_al_peso). */
export interface MetaArmazemPresenteismoAl {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/** Meta (%) e peso únicos do Refugo (Armazém T2) — valem pra todas as unidades. */
export interface MetaArmazemRefugo {
  meta_pct: number
  peso: number
}

/** Meta (R$, quanto menor melhor) e peso únicos das Quebras (Armazém T2) — valem pra todas as unidades. */
export interface MetaArmazemQuebras {
  meta_valor: number
  peso: number
}

/** Resultado mensal dos indicadores do Armazém T1 (só ESTÂNCIA e CDR BAHIA) que vêm do BI (TMA, Disponibilidade de Gente, Presenteísmo AL) — mesmo esquema do ResultadoArmazemBi, cadastro separado do T2. */
export interface ResultadoArmazemT1Bi {
  id?: string
  indicador: 'tma' | 'disponibilidade_gente' | 'presenteismo_al'
  unidade: string
  negocio: string
  ano: number
  mes: number
  valor: number
}

/** Meta mensal (minutos) do TMA do Armazém T1 — muda todo mês, diferente por unidade. Peso único (rv_armazem_t1_tma_peso). */
export interface MetaArmazemT1Tma {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/** Meta mensal (%) da Disponibilidade de Gente do Armazém T1 — muda todo mês, diferente por unidade. Peso único (rv_armazem_t1_disponibilidade_gente_peso). */
export interface MetaArmazemT1DisponibilidadeGente {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/** Meta mensal (%) do Presenteísmo AL do Armazém T1 — cadastro separado do T2, muda todo mês, diferente por unidade. Peso único (rv_armazem_t1_presenteismo_al_peso). */
export interface MetaArmazemT1PresenteismoAl {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/** Meta (R$, quanto menor melhor) e peso únicos das Quebras do Armazém T1 — valem pra ESTÂNCIA e CDR BAHIA. */
export interface MetaArmazemT1Quebras {
  meta_valor: number
  peso: number
}

/** Resultado mensal (R$) das Quebras do Armazém — cadastro manual (não vem de planilha), cobre todas as unidades (T2 e T1). */
export interface ResultadoArmazemQuebras {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/** Meta (%) do indicador Devolução — diferente por unidade (peso é por função, ver PesoDistribuicaoFuncao). */
export interface MetaDevolucao {
  unidade: string
  meta_pct: number
}

/** Meta mensal (%) do indicador Presenteísmo DU, por unidade — importada todo mês (peso é por função, ver PesoDistribuicaoFuncao). */
export interface MetaPresenteismoDu {
  id?: string
  unidade: string
  ano: number
  mes: number
  valor: number
}

/**
 * Peso (%) de um indicador da RV de Distribuição, por função da liderança
 * (COORD. DU / SUPERVISOR DU) — a meta de cada indicador continua única e
 * compartilhada entre as duas funções (Indisponibilidade, Pacote de Gente,
 * Vales, LogOn DU, Devolução, Presenteísmo DU); só o peso muda por função.
 * LogOn DU não tem linha pra SUPERVISOR DU — não conta pra essa função.
 */
export interface PesoDistribuicaoFuncao {
  funcao: 'COORD. DU' | 'SUPERVISOR DU'
  indicador: 'indisponibilidade' | 'pacote_gente' | 'vales' | 'logon_du' | 'devolucao' | 'presenteismo_du'
  peso: number
}

/**
 * Lucro pago pela Ambev por unidade×negócio×mês (SDG Corp Fin > Lucro) —
 * Volume Atual × R$/HL, importado da planilha da Ambev. `negocio` vem do
 * prefixo da coluna "Vigencia" (ex: "ROTA_2_3_2026" → 'ROTA') — hoje ROTA e
 * AS, Armazém entra depois com outra planilha, sem lista fixa de valores.
 */
export interface LucroAmbevRow {
  id?: string
  unidade: string
  negocio: string
  ano: number
  mes: number
  volume: number
  valor_hl: number
  lucro: number
}
