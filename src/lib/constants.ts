import type { PacoteInfo } from '@/types'

/**
 * Espelha o dict PACOTES de dashboard/pages/1_Farol_de_Metas.py (linha ~549) no
 * Panorama Financeiro original. Mantido 1:1, inclusive a inconsistência conhecida
 * do código '160' (era '159'), que usa prefixos: ['159'] (igual ao pacote '159',
 * era '158') no Python — não corrigido aqui de propósito, para preservar
 * paridade de cálculo.
 *
 * Códigos atualizados em 09/2026 pro cutover da numeração nova do DRE (283
 * contas — o GInfo inseriu a conta "GASTOS COM SALÁRIOS" logo após a 034,
 * deslocando +1 tudo que já era ≥ 035). Ids e prefixos aqui são sempre a
 * numeração NOVA a partir de agora; ver `ULTIMO_ANO_ORCAMENTO_ESTRUTURA_ANTIGA`
 * em orcamento-farol.ts pra tradução reversa usada só no Orçamento de 2026.
 */
export const PACOTES: Record<string, PacoteInfo> = {
  '233': { nome: 'EBITDA',                     natureza: 'performance', prefixos: ['233'] },
  '276': { nome: 'Geração de Caixa',            natureza: 'performance', prefixos: ['276'] },
  '900': { nome: 'Gastos Totais',               natureza: 'custo',       prefixos: ['021', '158'] },
  '021': { nome: 'Custo Operacional',           natureza: 'custo',       prefixos: ['021'] },
  '159': { nome: 'Pacote de Gente',             natureza: 'custo',       prefixos: ['159', '033'] },
  '033': { nome: 'Custo com Pessoal',           natureza: 'custo',       prefixos: ['033'] },
  '160': { nome: 'Despesa com Pessoal ADM',     natureza: 'custo',       prefixos: ['159'] }, // [sic] igual ao Python original
  '191': { nome: 'Despesas ADM Gerais',         natureza: 'custo',       prefixos: ['191'] },
  '218': { nome: 'Despesas Frota Leve',         natureza: 'custo',       prefixos: ['218'] },
  '219': { nome: 'Manutenção Frota Leve',       natureza: 'custo',       prefixos: ['219'] },
  '114': { nome: 'Pacote de Frota',             natureza: 'custo',       prefixos: ['114'] },
  '118': { nome: 'Manutenção',                  natureza: 'custo',       prefixos: ['118'] },
  '132': { nome: 'Pneus',                       natureza: 'custo',       prefixos: ['132'] },
  '116': { nome: 'Combustíveis',                natureza: 'custo',       prefixos: ['116'] },
  // Os 3 grupos que formam o Pacote de Frota (114) — adicionados pro SDG
  // Corporativo de Frota (Tela 1: abertura de 114 em Variáveis/Fixos/Outros).
  '115': { nome: 'Custos Variáveis Frota',      natureza: 'custo',       prefixos: ['115'] },
  '140': { nome: 'Custo Fixos',                 natureza: 'custo',       prefixos: ['140'] },
  '144': { nome: 'Outros Custos Operacionais',  natureza: 'custo',       prefixos: ['144'] },
  '158': { nome: 'Despesa Administrativa',      natureza: 'custo',       prefixos: ['158'] },
  // Gastos com Benefícios — mesmo caso de Pacote de Gente (159): soma a
  // conta-mãe do operacional (056) com a do administrativo (172), numeração
  // nova do DRE — usado no SDG Gerentes (abertura do Pacote de Gente).
  '056': { nome: 'Gastos com Benefícios',       natureza: 'custo',       prefixos: ['056', '172'] },
  // Salários — mesmo caso: soma 036 (Salários e Ordenados, operacional) com
  // 161 (Salários, administrativo).
  '036': { nome: 'Salários',                    natureza: 'custo',       prefixos: ['036', '161'] },
  '074': { nome: 'Pacote Segurança',            natureza: 'custo',       prefixos: ['074'] },
  '075': { nome: "EPI's",                       natureza: 'custo',       prefixos: ['075'] },
  '076': { nome: 'Uniformes',                   natureza: 'custo',       prefixos: ['076'] },
  '023': { nome: 'Custos com Freteiros',        natureza: 'custo',       prefixos: ['023'] },
  // Gastos Contratação/Demissão — mesmo caso de Salários/Benefícios: soma a
  // conta-mãe do operacional (069) com a do administrativo (184).
  '069': { nome: 'Gastos Contratação/Demissão', natureza: 'custo',       prefixos: ['069', '184'] },
}

export const PACOTES_RESUMO    = ['233', '276', '900', '021', '159', '114', '158', '074']
export const PACOTES_GENTE     = ['159', '033', '160']
export const PACOTES_FROTA     = ['114', '118', '132', '116']
export const PACOTES_SEGURANCA = ['074', '075', '076']
export const PACOTES_ADM       = ['160', '191', '218', '219']

/**
 * Contas totalizadoras da faixa da Despesa Administrativa (158–228) — cada
 * uma é a soma de subcontas que já aparecem na própria faixa, então elas
 * ocupariam o topo do Top Contas repetindo o que está logo abaixo. Ficam de
 * fora do ranking (ver `topContasFaixa`, opção `excluir`).
 */
export const CONTAS_TOTALIZADORAS_ADM = ['158', '159', '160', '163', '172', '184', '188', '191', '218']

/** Código da conta "Receita Líquida Operacional", usado como base de todo cálculo de % de faturamento e impacto financeiro. */
export const CONTA_RECEITA = '002'
export const NOME_RECEITA = 'Receita Líquida Operacional'

/**
 * Indicadores das abas Performance e Custos da página Ranking, espelhando
 * 1:1 as listas hardcoded de dashboard/pages/03_Ranking.py (linha ~237) do
 * Panorama Financeiro original. Cada código já existe em `PACOTES` (reaproveitado
 * pra natureza/prefixos) — mantido como lista separada porque é um recorte
 * diferente de PACOTES_RESUMO (usado no Farol).
 */
export const RANKING_PERFORMANCE = ['233', '276']
export const RANKING_CUSTOS = ['900', '021', '159', '114', '158', '075', '076']

/**
 * Contas cujo AVR (%) do GInfo NÃO é invertido ao normalizar (mantém o sinal
 * original). Espelha `performance_codes = [232, 275]` em
 * scripts/tratar_dre_pro.py do Panorama Financeiro original — para todas as
 * outras contas (custo), o AVR bruto é multiplicado por -1, porque o GInfo
 * exporta o AVR de custo com o mesmo sinal do REALIZADO (negativo), e o Farol
 * espera custo como percentual positivo (ex: "77,83% da receita").
 */
export const CODIGOS_PERFORMANCE = ['233', '276']

/**
 * Código(s) de conta NO PRÓPRIO ORÇAMENTO (tabela `orcamentos` — numeração
 * própria da planilha, consistente entre as ~29 abas ORÇ_XXX_SUFIXO, mas
 * diferente da numeração do plano de contas do DRE) que correspondem a cada
 * pacote do Farol — usado pra puxar a meta mensal/anual/semestral direto do
 * orçamento em vez da tabela `metas`, pra qualquer unidade/negócio. Confirmado por nome junto
 * com o usuário e depois traduzido pro código — casar só pelo nome dava
 * problema porque a planilha tem linhas duplicadas (ex: "048 UNIFORMES" e
 * "051 UNIFORMES" são a mesma descrição, contas diferentes). Pacotes sem
 * entrada aqui continuam usando a tabela `metas` normalmente.
 *
 * IMPORTANTE (cutover 09/2026): as CHAVES aqui continuam sendo os ids
 * ANTIGOS do pacote (pré-numeração nova do DRE), de propósito — o Orçamento
 * de 2026 nunca vai ser re-numerado, então esse dict fica congelado na
 * estrutura antiga. `buscarMetaOrcamento` (orcamento-farol.ts) traduz o id
 * novo de volta pro antigo antes de indexar aqui, só pra `ano <=
 * ULTIMO_ANO_ORCAMENTO_ESTRUTURA_ANTIGA`. Não atualizar essas chaves.
 */
export const PACOTE_CONTA_ORCAMENTO: Record<string, string[]> = {
  '232': ['133'], // EBITDA
  '275': ['155'], // Lucro Líquido do Exercício - Geração de Caixa
  '021': ['012'], // Custos Operacionais
  '900': ['012', '077'], // Custos Operacionais + Despesas Administrativas e Financeiras
  '157': ['077'], // Despesas Administrativas e Financeiras
  '158': ['020', '078'], // Custo com Pessoal + Despesas com Pessoal Administrativo
  '033': ['020'], // Custo com Pessoal
  '159': ['078'], // Despesas com Pessoal Administrativo
  '113': ['052'], // Custos Gerais com Frota
  '114': ['053'], // Custos Variáveis Frota
  '073': ['046'], // Gastos com Uniformes e EPI's
  '117': ['056'], // Manutenção de Veículos Próprios
  '131': ['058'], // Pneus
  '115': ['054'], // Óleo Diesel
  '139': ['063'], // Custo Fixos
  '143': ['067'], // Outros Custos Operacionais
  '074': ['047'], // EPI's
  '075': ['048'], // Uniformes
  '190': ['096'], // Despesas Administrativas Gerais
  '217': ['121'], // Despesas Gerais Frota Leve
  '218': ['122'], // Manutenção Frota Leve
  '055': ['033', '087'], // Gastos com Benefícios (operacional + ADM) — chave '055' = paraCodigoPreCutover('056')
  '035': ['022', '080'], // Salários (operacional + ADM) — chave '035' = paraCodigoPreCutover('036')
  '023': ['014'], // Custos com Freteiros (Frete Pago a Terceiros e Agregados) — código do DRE não mudou no cutover (< 035, paraCodigoPreCutover não desloca), só o do Orçamento difere
}

/**
 * Códigos-alvo de PACOTE_CONTA_ORCAMENTO (esquema bespoke, unidades antigas)
 * deslocados +1 pro equivalente na aba TT (consolidado) das unidades novas
 * — mesma regra de `paraCodigoTtDeslocado` em orcamento-farol.ts (mantida
 * em sincronia manualmente, os dois são a mesma gambiarra temporária).
 * Sem isso, os valores da aba TT dessas unidades (código já deslocado,
 * ex: '134' em vez de '133') nunca apareceriam numa query filtrada por
 * CONTAS_ORCAMENTO_USADAS — mesmo depois de buscarMetaOrcamento saber
 * traduzir, a linha em si já teria sido cortada antes de chegar no cliente.
 */
const CONTAS_ORCAMENTO_USADAS_TT_DESLOCADO = Object.values(PACOTE_CONTA_ORCAMENTO)
  .flat()
  .map((codigo) => {
    const n = Number(codigo)
    return n >= 22 && n <= 155 ? String(n + 1).padStart(3, '0') : codigo
  })

/**
 * Código nativo do DRE (numeração atual, 283 contas) → código da planilha
 * de Orçamento bespoke das unidades antigas (155 contas) — contas-FILHA
 * (não pacote inteiro, ver `PACOTE_CONTA_ORCAMENTO` pra isso) usadas nas
 * tabelas de Análise por Conta do SDG Gerentes/Análise Detalhada (Pacote
 * de Gente, Pacote de Frota, Despesa Administrativa). Fica aqui (não em
 * `orcamento-conta-filha.ts`, que importa de `orcamento-farol.ts`, que por
 * sua vez importa deste arquivo) só pra não criar import circular — ver
 * `buscarOrcadoContaFilha` em orcamento-conta-filha.ts pra como é usado.
 *
 * Montada comparando a DESCRIÇÃO de cada conta nos dois planos (não um
 * offset numérico fixo — a diferença de contagem entre os dois planos não
 * é uniforme, e várias contas do plano novo simplesmente não existiam
 * separadas no antigo). Conferido célula a célula contra um DRE e um
 * Orçamento reais (Diadema, 09/2026). Código nativo sem entrada aqui = o
 * formato antigo nunca detalhou essa conta separadamente (fica sem orçado
 * pra unidade antiga — 0, não é bug).
 */
export const CONTA_FILHA_ORCAMENTO_BESPOKE: Record<string, string> = {
  // Pacote de Gente — lado operacional (036-079 nativo → 022-048 bespoke)
  '036': '022', // SALÁRIOS E ORDENADOS
  '039': '024', // INSS E PROVISÕES
  '040': '025', // FGTS E PROVISÕES
  '041': '026', // FÉRIAS E PROVISÕES
  '042': '027', // DÉCIMO TERCEIRO SALÁRIO E PROVISÕES
  '043': '028', // PROCESSOS TRABALHISTAS
  '044': '029', // AVISO PRÉVIO
  '049': '030', // FGTS S/ RESCISÕES
  '055': '032', // VALES SINISTRO
  '057': '034', // VALE REFEIÇÃO
  '058': '035', // VALE TRANSPORTE
  '059': '036', // PLANO DE SAÚDE
  '060': '037', // CESTA BÁSICA
  '061': '038', // CAFÉ DA MANHÃ
  '062': '039', // SEGURO DE VIDA
  '063': '040', // PLR – PARTICIPAÇÃO NOS RESULTADOS
  '067': '041', // INCENTIVOS
  '070': '043', // PCMSO/PPRA
  '071': '044', // EXAMES MÉDICOS
  '073': '045', // CURSOS E TREINAMENTOS
  '075': '047', // EPI'S
  '076': '048', // UNIFORMES

  // Pacote de Gente / Despesa Administrativa — lado ADM (161-190 nativo → 080-095 bespoke)
  '161': '080', // SALÁRIOS
  '164': '082', // INSS E PROVISÕES
  '165': '083', // FGTS E PROVISÕES
  '166': '084', // FÉRIAS E PROVISÕES
  '167': '085', // DÉCIMO TERCEIRO SALÁRIO E PROVISÕES
  '170': '086', // CONTRIBUIÇÃO SINDICAL PATRONAL
  '173': '088', // VALE REFEIÇÃO
  '174': '089', // VALE TRANSPORTE
  '175': '090', // PLANO DE SAÚDE
  '176': '091', // CESTA BÁSICA
  '177': '092', // AUXILIO EDUCAÇÃO
  '181': '093', // CURSOS E TREINAMENTOS
  '186': '095', // EXAMES MÉDICOS

  // Despesa Administrativa Gerais (192-228 nativo → 097-128 bespoke)
  '192': '097', // HONORÁRIOS PROFISSIONAIS
  '193': '098', // DESPESA DE VIAGENS E HOSPEDAGENS
  '194': '099', // SISTEMAS DE INFORMÁTICA
  '195': '100', // ALUGUÉIS E CONDOMÍNIOS
  '196': '101', // ENERGIA ELÉTRICA
  '197': '102', // ÁGUA E ESGOTO
  '198': '103', // TELEFONE
  '199': '104', // INTERNET
  '200': '105', // BENS DE PEQUENO VALOR
  '201': '106', // MATERIAIS DE EXPEDIENTE
  '202': '107', // MATERIAL DE LIMPEZA
  '203': '108', // CORREIOS
  '204': '109', // CARTÓRIO
  '205': '110', // OUTRAS DESPESAS ADMINISTRATIVAS
  '206': '111', // MANUTENÇÃO E REPAROS ADMINISTRATIVOS
  '207': '112', // IMPRESSOS GRÁFICOS
  '208': '113', // DESPESA C/TAXAS E IMPOSTOS
  '209': '114', // CONFRATERNIZAÇÃO E EVENTOS
  '210': '115', // DESPESAS LEGAIS E JUDICIAIS
  '211': '116', // SEGURANÇA E VIGILÂNCIA
  '212': '117', // LANCHES, REFEIÇÕES
  '214': '118', // BRINDES DIVERSOS
  '215': '119', // DESPESA C/MERCADO
  '217': '120', // HONORÁRIOS COM CONSULTORIA DE OPERAÇÕES
  '219': '122', // MANUTENÇÃO FROTA LEVE
  '220': '123', // COMBUSTÍVEL FROTA LEVE
  '222': '124', // ALUGUEL FROTA LEVE
  '224': '125', // IPVA FROTA LEVE
  '225': '126', // SEGURO FROTA LEVE
  '226': '127', // PEDÁGIO FROTA LEVE
  '227': '128', // LAVAÇÃO FROTA LEVE

  // Pacote de Frota (119-152 nativo → 056-073 bespoke)
  '117': '054', // ÓLEO DIESEL — mesma conta bespoke já usada em PACOTE_CONTA_ORCAMENTO['115'] (Combustível = Óleo Diesel pro orçamento antigo, nunca teve conta-mãe separada)
  '119': '056', // MANUTENÇÃO DE VEÍCULOS PRÓPRIOS
  '125': '057', // AVARIAS E SINISTROS
  '133': '058', // PNEUS
  '137': '060', // PEDÁGIOS
  '138': '061', // MULTAS DE TRÂNSITO
  '139': '062', // LAVAÇÃO
  '141': '064', // IPVA/DPVAT E LICENCIAMENTOS
  '142': '065', // SEGURO DE FROTA
  '143': '066', // RASTREAMENTO
  '146': '068', // MANUTENÇÃO DE RASTREADORES
  '152': '073', // ALUGUEL DE EQUIPAMENTOS
}

/** Mesma regra de `CONTAS_ORCAMENTO_USADAS_TT_DESLOCADO`, aplicada aos valores de `CONTA_FILHA_ORCAMENTO_BESPOKE`. */
const CONTAS_FILHA_ORCAMENTO_USADAS_TT_DESLOCADO = Object.values(CONTA_FILHA_ORCAMENTO_BESPOKE)
  .map((codigo) => {
    const n = Number(codigo)
    return n >= 22 && n <= 155 ? String(n + 1).padStart(3, '0') : codigo
  })

/**
 * Códigos de conta do orçamento realmente usados por algum pacote do Farol:
 * todos os valores de PACOTE_CONTA_ORCAMENTO (esquema bespoke, unidades
 * antigas) + seus equivalentes deslocados na aba TT das unidades novas
 * (CONTAS_ORCAMENTO_USADAS_TT_DESLOCADO) + os prefixos de PACOTES (usados
 * direto pelas abas RT/AR das unidades novas, que já vêm na numeração
 * nativa do DRE — ver usaNumeracaoDreNativa) + a Receita Líquida
 * Operacional (denominador de qualquer AV/semestre) + as contas-FILHA de
 * `CONTA_FILHA_ORCAMENTO_BESPOKE` (chaves = código nativo, usado direto
 * pelas unidades novas; valores + deslocados = código bespoke, unidades
 * antigas). Usado pra recalcular só o necessário em vez de todas as contas
 * de cada aba — bem mais rápido e mais leve pro Supabase.
 */
export const CONTAS_ORCAMENTO_USADAS = Array.from(
  new Set([
    CONTA_RECEITA,
    ...Object.values(PACOTE_CONTA_ORCAMENTO).flat(),
    ...CONTAS_ORCAMENTO_USADAS_TT_DESLOCADO,
    ...Object.values(PACOTES).flatMap((p) => p.prefixos),
    ...Object.keys(CONTA_FILHA_ORCAMENTO_BESPOKE),
    ...Object.values(CONTA_FILHA_ORCAMENTO_BESPOKE),
    ...CONTAS_FILHA_ORCAMENTO_USADAS_TT_DESLOCADO,
  ]),
)

export const CORES_FAROL = {
  positivo: '#10b981',
  negativo: '#ef4444',
  atencao: '#f59e0b',
  neutro: '#6b7280',
} as const

/** Cards "Estouro Zero" da aba Gente — real não pode exceder remunerado. */
export const ESTOURO_ZERO_CARDS = [
  { nome: 'Salários',   prefixos: ['036', '161'] },
  { nome: 'Benefícios', prefixos: ['056', '172'] },
]

/** Indicador de RV com origem no DRE — 'avr' compara com a meta do Farol; 'dispersao' usa a coluna DIFERENÇA (≥ 0 = bateu). */
export interface RvIndicadorDre {
  /** Chave do peso na tabela de pesos do setor (rv_gente_pesos_dre / rv_financeiro_pesos_dre). */
  id: string
  nome: string
  tipo: 'avr' | 'dispersao'
  prefixos: string[]
  /** Só conta na apuração de lideranças com esse negócio (ex: 'ROTA') — undefined = vale pra todas. */
  negocio?: string
}

/**
 * Indicadores de gente com origem no DRE que compõem a RV das lideranças.
 * - 'avr': AVR mensal vs meta do Farol (pacote 158).
 * - 'dispersao': coluna DIFERENÇA do DRE (REAL−REMUN) somada nas contas —
 *   meta implícita é não estourar (dispersão ≥ 0 = verde).
 * O `id` é a chave do peso em rv_gente_pesos_dre.
 */
export const RV_GENTE_DRE: RvIndicadorDre[] = [
  { id: '159',        nome: 'Pacote de Gente',      tipo: 'avr',       prefixos: ['159', '033'] },
  { id: 'SALARIOS',   nome: 'Salários',             tipo: 'dispersao', prefixos: ['036', '161'] },
  { id: 'BENEFICIOS', nome: 'Pacote de Benefícios', tipo: 'dispersao', prefixos: ['056', '172'] },
]

/**
 * Indicadores do setor financeiro — todos com origem no DRE, sem importação
 * de metas (AVR usa a meta do Farol; dispersão usa as contas do Painel de
 * Perdas). O `id` é a chave do peso em rv_financeiro_pesos_dre. Vales (contas
 * 052/053) não entra aqui — vira o indicador `valesPerdasTabela` do
 * RvApuracao (mesma regra da Distribuição: dispersão vs % da Meta de Perdas
 * de Vales, não mais ≥ 0).
 */
export const RV_FINANCEIRO_DRE: RvIndicadorDre[] = [
  { id: '158',    nome: 'Despesa Administrativa', tipo: 'avr',       prefixos: ['158'] },
  { id: '021',    nome: 'Custo Operacional',      tipo: 'avr',       prefixos: ['021'] },
  { id: 'MULTAS', nome: 'Multas',                 tipo: 'dispersao', prefixos: ['138', '223'] },
]

/**
 * Indicadores de frota com origem no DRE — AVR mensal vs meta do Farol
 * (pacotes de custo). Os indicadores de frota de fora do DRE entram depois,
 * quando a importação deles for estruturada. O `id` é a chave do peso em
 * rv_frota_pesos_dre.
 */
export const RV_FROTA_DRE: RvIndicadorDre[] = [
  { id: '118', nome: 'Manutenção',            tipo: 'avr', prefixos: ['118'] },
  { id: '132', nome: 'Pneus',                 tipo: 'avr', prefixos: ['132'] },
  { id: '116', nome: 'Diesel (Combustíveis)', tipo: 'avr', prefixos: ['116'] },
]

/**
 * Custos Gerais (DRE 114, "Pacote de Frota" — já mapeado em PACOTES/
 * PACOTE_CONTA_ORCAMENTO) — mesmo mecanismo dos indicadores de RV_FROTA_DRE
 * (AVR vs meta do Orçamento), mas fora do array acima de propósito: só as 3
 * lideranças T1 de Frota participam (Estância, Ponta Grossa e CDR Bahia — ver
 * `OPERACOES_FROTA_T1`, rv-frota-t1.ts), não a frota inteira, então não pode
 * entrar no loop genérico de `indicadoresDre` (que aplica pra toda unidade).
 * O peso é cadastrado na mesma tabela `rv_frota_pesos_dre` (id '114') — só o
 * card de cadastro (MetasFrotaTab) mostra os dois juntos, o cálculo em
 * useRvApuracao.ts trata esse `id` à parte, com restrição de unidade.
 */
export const CUSTOS_GERAIS_FROTA_DRE: RvIndicadorDre = { id: '114', nome: 'Custos Gerais Frota', tipo: 'avr', prefixos: ['114'] }

/**
 * Indicadores de segurança com origem no DRE — EPI's (075) e Uniformes (076),
 * os mesmos acompanhados no Farol de Metas, por AVR mensal vs meta do Farol.
 * O `id` é a chave do peso em rv_seguranca_pesos_dre.
 */
export const RV_SEGURANCA_DRE: RvIndicadorDre[] = [
  { id: '075', nome: "EPI's",     tipo: 'avr', prefixos: ['075'] },
  { id: '076', nome: 'Uniformes', tipo: 'avr', prefixos: ['076'] },
]

/**
 * Metadados do indicador Pacote de Gente da Distribuição — 159, contas
 * 159+033 (inclui a Despesa com Pessoal ADM, mesmo pacote do Farol de
 * Metas), AVR mensal vs meta do Farol do pacote 159. Só conta na apuração
 * das lideranças da ROTA (negocio: 'ROTA') — a RV é da liderança da
 * rota/distribuição, então usa sempre o resultado do negócio ROTA (nunca
 * CONS/consolidado), mesmo em unidades sem split de negócio no DRE. Usado
 * como bloco customizado no RvApuracao (prop incluirPacoteGenteDu), não pelo
 * mecanismo genérico indicadoresDre/tabelaPesos — o peso é por função da
 * liderança (rv_distribuicao_peso_funcao), não por indicador único.
 */
export const RV_DISTRIBUICAO_DRE: RvIndicadorDre[] = [
  { id: '159', nome: 'Pacote de Gente', tipo: 'avr', prefixos: ['159', '033'], negocio: 'ROTA' },
]

/** Cards "Redução de Custos -15%" da aba ADM. */
export const REDUCAO_CUSTOS_CARDS = [
  { nome: 'Despesas Frota Leve', contas: ['218'] },
  { nome: 'Despesas com Viagem', contas: ['148', '193'] },
]

/**
 * Faixas numéricas "Pacote DRE" da aba Abertura de Contas, espelhando 1:1 o
 * dict PACOTES de dashboard/pages/04_Analise_por_Conta.py (linha ~264) do
 * Panorama Financeiro original. Usado só nessa aba (não confundir com
 * PACOTES, os indicadores do Farol de Metas).
 */
export const PACOTES_DRE: Record<string, [number, number]> = {
  'Receita': [1, 20],
  'Custo Operacional Geral': [21, 32],
  'Pacote de Gente Operacional': [33, 113],
  'Frota': [114, 157],
  'Despesa Administrativa': [158, 228],
  'Contas Finais do DRE': [229, 283],
}
