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
