/**
 * Conteúdo do botão "O que é isso" (IndicadorInfoButton) — texto e fórmula
 * visual de cada indicador, pra quem não acompanha o painel todo dia
 * entender de onde vem o número sem precisar perguntar. Chave = mesmo id
 * usado em PACOTES/RV_*_DRE (ex: '232' = EBITDA). Pacote sem entrada aqui
 * simplesmente não mostra o botão — cadastro incremental, começando pelos
 * indicadores mais perguntados.
 */

export interface EtapaFormula {
  rotulo: string
  /** Código da conta no DRE, só quando existe uma conta específica e conferida no catálogo (sql/seed_contas.sql) — nunca inventado. */
  codigo?: string
  /** Como essa etapa se relaciona com a anterior — omitido na primeira etapa. */
  operador?: '+' | '−' | '='
}

export interface ExplicacaoIndicador {
  titulo: string
  /** 1-2 frases: o que é e por que olhar pra ele. */
  resumo: string
  formula: EtapaFormula[]
  /** Observação extra sobre a fórmula, quando o DRE tem mais detalhe do que vale a pena colocar na fórmula visual principal. */
  notaFormula?: string
  /** Linha única, formato "AVR = X ÷ Y × 100" — mostrada em destaque acima do texto explicativo. */
  formulaAvr: string
  /** Texto bem didático explicando como o AVR (%) chega nesse número — pensado pra quem não é da área. */
  comoAvrEhCalculado: string
}

export const INDICADOR_EXPLICACOES: Record<string, ExplicacaoIndicador> = {
  '232': {
    titulo: 'EBITDA',
    resumo: 'Lucro operacional da unidade antes de juros, impostos, depreciação e amortização — o resultado "limpo" da operação, sem o efeito de itens financeiros/contábeis. Quanto maior, melhor.',
    formula: [
      { rotulo: 'Receita Líquida Operacional', codigo: '002' },
      { rotulo: 'Custo Operacional', codigo: '021', operador: '−' },
      { rotulo: 'Despesa Administrativa', codigo: '157', operador: '−' },
      { rotulo: 'Alocações Matriz', codigo: '228', operador: '−' },
      { rotulo: 'EBITDA', codigo: '232', operador: '=' },
    ],
    formulaAvr: 'AVR (%) = EBITDA (R$) ÷ Receita Líquida Operacional × 100',
    comoAvrEhCalculado: 'O AVR mostra quanto do que a unidade faturou virou EBITDA, em percentual.\n\nPega-se o EBITDA em R$ (Realizado) e divide pela Receita Líquida Operacional do mesmo período.\n\nExemplo: um AVR de 15% significa que, pra cada R$ 100 faturados, R$ 15 sobraram de lucro operacional.',
  },
  '900': {
    titulo: 'Gastos Totais',
    resumo: 'Soma de tudo que a unidade gastou pra manter a operação funcionando no período — de forma simples, é tudo aquilo que a empresa gastou pra realizar sua operação. Quanto menor o gasto pra entregar a mesma operação, melhor a eficiência.',
    formula: [
      { rotulo: 'Custo Operacional', codigo: '021' },
      { rotulo: 'Despesa Administrativa', codigo: '157', operador: '+' },
      { rotulo: 'Gastos Totais', operador: '=' },
    ],
    formulaAvr: 'AVR (%) = Gastos Totais (R$) ÷ Receita Líquida Operacional × 100',
    comoAvrEhCalculado: 'O AVR de Gastos Totais representa quanto consumimos da nossa receita pra manter a operação, em percentual.\n\nPega-se os Gastos Totais em R$ e divide pela Receita Líquida Operacional do mesmo período.\n\nExemplo: um AVR de 60% significa que, pra cada R$ 100 faturados, R$ 60 foram consumidos pra sustentar a operação.',
  },
  '021': {
    titulo: 'Custo Operacional',
    resumo: 'Gastos diretamente ligados à realização da operação da empresa — o que precisamos pra fazer a operação acontecer e entregar o serviço ao cliente, exceto custos administrativos. Inclui, por exemplo, custo de gente operacional (salários e benefícios) e custo de frota (manutenção, combustível, pneu etc.). Quanto menor, melhor a eficiência.',
    formula: [
      { rotulo: 'Custo com Pessoal (time operacional)', codigo: '033' },
      { rotulo: 'Pacote de Frota', codigo: '113', operador: '+' },
      { rotulo: 'Custo Operacional', codigo: '021', operador: '=' },
    ],
    formulaAvr: 'AVR (%) = Custo Operacional (R$) ÷ Receita Líquida Operacional × 100',
    comoAvrEhCalculado: 'O AVR de Custo Operacional representa quanto consumimos da nossa receita pra fazer a operação acontecer, em percentual.\n\nPega-se o Custo Operacional em R$ e divide pela Receita Líquida Operacional do mesmo período.\n\nExemplo: um AVR de 45% significa que, pra cada R$ 100 faturados, R$ 45 foram consumidos entre gente e frota pra tocar a operação.',
  },
  '158': {
    titulo: 'Pacote de Gente',
    resumo: 'Conjunto de gastos relacionados às pessoas que fazem a operação acontecer — salários, benefícios, encargos, horas extras, férias/13º e outros custos com pessoal. De forma simples: representa quanto a empresa gasta com seus colaboradores pra manter a operação funcionando. É um dos principais gastos da operação.',
    formula: [
      { rotulo: 'Custo com Pessoal', codigo: '033' },
      { rotulo: 'Despesas com Pessoal Administrativo', codigo: '158', operador: '+' },
      { rotulo: 'Pacote de Gente', operador: '=' },
    ],
    formulaAvr: 'AVR (%) = Pacote de Gente (R$) ÷ Receita Líquida Operacional × 100',
    comoAvrEhCalculado: 'O AVR de Pacote de Gente representa quanto consumimos da nossa receita com pessoal pra manter a operação, em percentual.\n\nPega-se o Pacote de Gente em R$ e divide pela Receita Líquida Operacional do mesmo período.\n\nExemplo: um AVR de 25% significa que, pra cada R$ 100 faturados, R$ 25 foram consumidos com pessoal (operacional + administrativo).',
  },
  '113': {
    titulo: 'Pacote de Frota',
    resumo: 'Conjunto de gastos necessários pra manter os equipamentos da operação funcionando e rodando — caminhões, carretas, empilhadeiras e paleteiras. De forma simples: mostra quanto a empresa gasta com a frota pra realizar entregas e serviços. Inclui combustível, manutenção, pneus, aluguel de equipamentos e multas de trânsito.',
    formula: [
      { rotulo: 'Custos Gerais com Frota', codigo: '113' },
      { rotulo: 'Pacote de Frota', operador: '=' },
    ],
    formulaAvr: 'AVR (%) = Pacote de Frota (R$) ÷ Receita Líquida Operacional × 100',
    comoAvrEhCalculado: 'O AVR de Pacote de Frota responde: quanto da nossa receita estamos gastando pra manter a frota rodando?\n\nPega-se o Pacote de Frota em R$ e divide pela Receita Líquida Operacional do mesmo período.\n\nExemplo: um AVR de 12% significa que, pra cada R$ 100 faturados, R$ 12 foram consumidos com a frota (combustível, manutenção, pneus etc.).',
  },
  '157': {
    titulo: 'Despesa Administrativa',
    resumo: 'Gastos necessários pra administrar a empresa e cuidar da sua estrutura financeira, mas que não estão diretamente ligados à operação — sistemas e tecnologia, telefonia, bens de pequeno valor, custo com pessoas do administrativo, entre outros. De forma simples: são os gastos pra manter a empresa funcionando por trás da operação. Enquanto o Custo Operacional faz a operação acontecer, a Despesa Administrativa dá suporte pra empresa funcionar.',
    formula: [
      { rotulo: 'Despesas Administrativas e Financeiras', codigo: '157' },
    ],
    formulaAvr: 'AVR (%) = Despesa Administrativa (R$) ÷ Receita Líquida Operacional × 100',
    comoAvrEhCalculado: 'O AVR de Despesa Administrativa representa quanto da nossa receita usamos pra manter a estrutura por trás da operação, em percentual.\n\nPega-se a Despesa Administrativa em R$ e divide pela Receita Líquida Operacional do mesmo período.\n\nExemplo: um AVR de 8% significa que, pra cada R$ 100 faturados, R$ 8 foram consumidos com a estrutura administrativa e financeira.',
  },
}
