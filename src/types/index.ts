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
 * que não seja EBITDA (232) ou Geração de Caixa (275) — ver normalizarParaCalculo.
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
export interface RotinaFinanceira {
  id?: string
  setor: string
  nome: string
  /** Texto livre do prazo, ex: "Dia 10", "4º dia útil", "1 dia após envio da matriz". */
  prazo: string
  ordem: number
  ativo: boolean
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

export type ReuniaoSetor = 'financeiro' | 'gente' | 'frota' | 'seguranca' | 'armazem' | 'distribuicao'
export type ReuniaoFormato = 'percentual' | 'monetario' | 'duracao' | 'numero'
/**
 * 'perdas' = indicador do Painel de Perdas (fonte_chave = key de
 * INDICADORES_PERDAS); 'farol_pacote' = pacote do Farol (fonte_chave =
 * código de PACOTES); 'rotinas' = % de aderência das Rotinas Financeiras
 * (Área Financeira > Rotinas) — sem fonte_chave, só existe uma métrica.
 */
export type ReuniaoFonte = 'manual' | 'perdas' | 'farol_pacote' | 'rotinas'

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
  meta: number | null
  formato: ReuniaoFormato
  natureza: Natureza
  pontos: number
  ordem: number
  ativo: boolean
  fonte: ReuniaoFonte
  fonte_chave: string | null
}

/** Resultado mensal de um indicador da Reunião Resultados, por unidade — `resultado` null = ainda não lançado. */
export interface ReuniaoResultadoMensal {
  id?: string
  indicador_id: string
  unidade: string
  mes: number
  resultado: number | null
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
