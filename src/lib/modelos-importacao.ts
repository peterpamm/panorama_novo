import type { AbaModelo } from '@/lib/modelo-planilha'

/**
 * Conteúdo dos modelos de planilha oferecidos nas telas de importação. Cada
 * modelo repete o cabeçalho EXATO que o parser correspondente procura — se um
 * parser passar a aceitar outra coluna, o modelo aqui muda junto.
 *
 * Os exemplos usam unidades reais (nomes que o `resolverUnidade` reconhece)
 * de propósito: o usuário consegue rodar uma importação de teste com o modelo
 * sem editar nada, e vê o resultado aparecer na tela.
 */

/**
 * Metas do Armazém — o arquivo real traz T1 e T2 em abas separadas, e é
 * justamente essa separação que o modelo precisa mostrar (foi o que já causou
 * importação do tier errado). Serve pras duas telas: "Armazém T1 — meta
 * mensal" (aba T1) e "Presenteísmo AL (T2)" (aba T2).
 */
export const MODELO_METAS_ARMAZEM: AbaModelo[] = [
  {
    nome: 'RV ARM _T1',
    linhas: [
      ['INDICADOR', 'UNIDADE', 'JUL', 'AGO'],
      ['TMA', 'ESTÂNCIA', '01:40', '01:35'],
      ['TMA', 'CDR BAHIA', '01:50', '01:45'],
      ['DISPONIBILIDADE DE GENTE', 'ESTÂNCIA', '95,9%', '96,5%'],
      ['DISPONIBILIDADE DE GENTE', 'CDR BAHIA', '94,2%', '94,2%'],
      ['PRESENTEISMO AL', 'ESTÂNCIA', '0,48%', '0,50%'],
      ['PRESENTEISMO AL', 'CDR BAHIA', '2,18%', '2,00%'],
    ],
  },
  {
    nome: 'RV ARM _T2',
    linhas: [
      ['INDICADOR', 'UNIDADE', 'JUL', 'AGO'],
      ['PRESENTEISMO AL', 'CD CASCAVEL', '1,14%', '1,10%'],
      ['PRESENTEISMO AL', 'CD FOZ DO IGUAÇU', '1,01%', '1,00%'],
      ['PRESENTEISMO AL', 'CD LONDRINA', '2,14%', '2,00%'],
    ],
  },
]

/**
 * Resultados do Armazém (BI) — mesma estrutura das metas (T1 e T2 em abas
 * separadas), com os indicadores de cada tier: T1 tem TMA, Disponibilidade de
 * Gente e Presenteísmo AL; T2 tem Presenteísmo AL, EFC, TMA e Refugo.
 */
export const MODELO_RESULTADOS_ARMAZEM: AbaModelo[] = [
  {
    nome: 'RV ARM _T1',
    linhas: [
      ['INDICADOR', 'UNIDADE', 'RESULTADO'],
      ['TMA', 'ESTÂNCIA', '01:38'],
      ['TMA', 'CDR BAHIA', '01:52'],
      ['DISPONIBILIDADE DE GENTE', 'ESTÂNCIA', '96,4%'],
      ['DISPONIBILIDADE DE GENTE', 'CDR BAHIA', '94,0%'],
      ['PRESENTEISMO AL', 'ESTÂNCIA', '0,52%'],
      ['PRESENTEISMO AL', 'CDR BAHIA', '2,05%'],
    ],
  },
  {
    nome: 'RV ARM _T2',
    linhas: [
      ['INDICADOR', 'UNIDADE', 'RESULTADO'],
      ['PRESENTEISMO AL', 'CD CASCAVEL', '1,20%'],
      ['EFC', 'CD CASCAVEL', '98,5%'],
      ['TMA', 'CD CASCAVEL', '03:15'],
      ['REFUGO', 'CD CASCAVEL', '0,42%'],
      ['PRESENTEISMO AL', 'CD LONDRINA', '2,08%'],
      ['EFC', 'CD LONDRINA', '97,9%'],
    ],
  },
]

/**
 * Cadastro de lideranças do Pagamento (Reunião Resultados > Pagamento >
 * Cadastro) — uma linha por pessoa. FILIAL aceita o nome/apelido normal da
 * unidade (ex: "Diadema"); Camaçari fora do Financeiro precisa do sufixo
 * "· Rota" ou "· Armazém" (são dois gerentes diferentes) — sem o sufixo a
 * linha fica pra revisão manual, nunca chuta qual dos dois.
 */
export const MODELO_LIDERANCAS_PAGAMENTO: AbaModelo[] = [
  {
    nome: 'Lideranças',
    linhas: [
      ['FILIAL', 'SETOR', 'LIDERANÇA', 'NÚMERO EXTRATTA'],
      ['DIADEMA', 'FINANCEIRO', 'Eduardo Gonçalves Marchesi da Silva', 57159],
      ['CAMAÇARI · ROTA', 'DISTRIBUIÇÃO', 'Fulano da Silva', 342201],
      ['CAMAÇARI · ARMAZÉM', 'ARMAZÉM', 'Ciclana Pereira', 342170],
    ],
  },
]

/**
 * Encontro de Contas — colunas Data/Descrição/Valor (a Unidade não entra
 * aqui, é atribuída depois na aba Tratativas). Descrição precisa seguir o
 * padrão "EC - <chamado> - <nome de quem abriu>", senão a linha cai pra
 * revisão manual — o exemplo já mostra isso pronto.
 */
export const MODELO_ENCONTRO_CONTAS: AbaModelo[] = [
  {
    nome: 'Encontro de Contas',
    linhas: [
      ['DATA', 'DESCRICAO', 'VALOR'],
      ['15/01/2026', 'EC - R14602322 - Vinicius Etges Silveira', '1234,56'],
      ['22/01/2026', 'EC - R14611087 - Ana Paula Ferreira', '850,00'],
    ],
  },
]

/**
 * Termômetro (Reunião Resultados > Gente/Frota/Segurança > Importação) —
 * Unidade + a pontuação do mês (o cabeçalho da 2ª coluna é lido pela
 * posição, pode ser qualquer nome de mês) + a coluna opcional Posição (a
 * colocação da unidade no Ranking Ambev do setor, que sem essa coluna
 * continua sendo lançada à mão no Resumo Geral).
 */
export const MODELO_TERMOMETRO: AbaModelo[] = [
  {
    nome: 'Termômetro',
    linhas: [
      ['Unidade', 'Junho', 'Posição'],
      ['ESTÂNCIA', '92,5', 1],
      ['CDR BAHIA', '88', 2],
      ['CD CASCAVEL', '81,3', 3],
      ['CD FOZ DO IGUAÇU', '75', ''],
    ],
  },
]

/**
 * Meta do Presenteísmo DU — formato simples (um mês por arquivo, o mês vem do
 * seletor da tela) e o histórico (uma coluna por mês) na segunda aba, que é a
 * forma de trazer vários meses fechados de uma vez.
 */
export const MODELO_META_PRESENTEISMO_DU: AbaModelo[] = [
  {
    nome: 'Meta do mês',
    linhas: [
      ['UNIDADE', 'META'],
      ['CD CASCAVEL', '2,5%'],
      ['CD FOZ DO IGUAÇU', '3%'],
      ['CD LONDRINA', '2,8%'],
    ],
  },
  {
    nome: 'Histórico (vários meses)',
    linhas: [
      ['INDICADOR', 'UNIDADE', 'JAN', 'FEV', 'MAR'],
      ['PRESENTEISMO DU', 'CD CASCAVEL', '2,5%', '2,4%', '2,6%'],
      ['PRESENTEISMO DU', 'CD FOZ DO IGUAÇU', '3%', '3,1%', '2,9%'],
    ],
  },
]

/**
 * Planilha padrão de Reunião Resultados (`Import_RR - Arm&DU.xlsx` — meta,
 * peso, resultado e pontos já prontos, ver `reuniao-planilha-parser.ts`) —
 * uma linha de título (o mês) acima do cabeçalho de verdade, igual o arquivo
 * real. PESO entra no exemplo mas é só informativo (não é lido, já está
 * cadastrado como `pontos` do indicador). Nome do INDICADOR precisa bater
 * com o "Nome" ou "Nome no T1" cadastrado em Cadastro pro setor/ano — os
 * nomes do exemplo são só ilustrativos, não uma garantia de cadastro.
 */
export const MODELO_INDICADORES_ARMAZEM: AbaModelo[] = [
  {
    nome: 'Import RR_ARM',
    linhas: [
      ['Mês: Agosto/2026'],
      ['Unidade', 'Indicador', 'Meta', 'Peso', 'Result', 'Pts'],
      ['ESTÂNCIA', 'TMA', '01:40', 20, '01:38', 20],
      ['ESTÂNCIA', 'DISPONIBILIDADE DE GENTE', '95,9%', 20, '96,4%', 20],
      ['CD CASCAVEL', 'PRESENTEISMO AL', '1,14%', 20, '1,20%', 0],
    ],
  },
]

/** Mesmo formato de `MODELO_INDICADORES_ARMAZEM`, aba/indicadores do setor Distribuição (DU/Empurrada). */
export const MODELO_INDICADORES_DU: AbaModelo[] = [
  {
    nome: 'Import RR_DU',
    linhas: [
      ['Mês: Agosto/2026'],
      ['Unidade', 'Indicador', 'Meta', 'Peso', 'Result', 'Pts'],
      ['CD CASCAVEL', 'GTY', '95%', 20, '96,2%', 20],
      ['CD CASCAVEL', 'TMV', '00:45', 20, '00:42', 20],
      ['CD FOZ DO IGUAÇU', 'TEMPO DE RENDIÇÃO', '00:15', 20, '00:18', 0],
    ],
  },
]
