import { mesesAtivosNoAno } from '@/lib/farol-calculations'
import type { DreLongoRow, MetaPerdaIndicador, PainelPerdasAux } from '@/types'

// ─── Configuração dos indicadores ───────────────────────────────────────────

export const INDICADORES_PERDAS = [
  { key: 'indisponibilidade', label: 'Indisponibilidade',           fonte: 'AUX' as const },
  { key: 'devolucao',         label: 'Devolução',                   fonte: 'AUX' as const },
  { key: 'vales',             label: 'Vales',                       fonte: 'DRE' as const, contas: ['052', '053'] },
  { key: 'multas',            label: 'Multas',                      fonte: 'DRE' as const, contas: ['138', '223'] },
  { key: 'proc_trab',         label: 'Processos Trabalhistas',      fonte: 'DRE' as const, contas: ['043', '088', '168'] },
  { key: 'civif',             label: 'Desconto CIVIF',              fonte: 'DRE' as const, contas: ['131'] },
  { key: 'sinistro_frota',    label: 'Sinistro de Frota',           fonte: 'DRE' as const, contas: ['055', '125'] },
  { key: 'bns',               label: 'BNS – Bônus Nível de Serviço', fonte: 'DRE' as const, contas: ['019'] },
] as const

export type IndicadorKey = typeof INDICADORES_PERDAS[number]['key']
export type TipoLinhaPerdas = 'indicador' | 'total' | 'faturamento' | 'perdas_pct' | 'meta_pct' | 'meta_rs'

export interface LinhaPerdas {
  tipo: TipoLinhaPerdas
  key: string
  label: string
  /** Valor por unidade; null = sem dado. */
  valores: Record<string, number | null>
}

export interface MatrizPerdas {
  /** Unidades disponíveis, em ordem: individuais alfabético + AMBEV no final. */
  unidades: string[]
  linhas: LinhaPerdas[]
}

// ─── Helpers internos ────────────────────────────────────────────────────────

/** Soma da diferença (campo `diferenca` bruto da view, já vindo assim do GInfo — não recalculado via remunerado−realizado abs()'d) das contas do indicador. Exportado pra outros lugares que precisam bater exatamente com o Painel de Perdas (ex: SDG Gerentes). */
export function somaDif(rows: DreLongoRow[], contas: readonly string[]): number {
  return rows
    .filter(r => contas.some(c => r.conta_codigo.startsWith(c)))
    .reduce((acc, r) => acc + (r.diferenca ?? 0), 0)
}

/**
 * Meta de Perdas mensal (Metas > Metas de Perdas) de um indicador pra UMA
 * unidade específica (nunca AMBEV — essa soma a taxa mensal de cada unidade
 * individual, ver `metaPerdasMensal` em `PainelPerdasPage.tsx`, não precisa
 * aqui). A tabela `metas_perdas_indicadores` só guarda o total anual
 * (`meta_anual`), então o valor "mensal" é sempre esse total dividido pelos
 * meses em que a unidade esteve ativa no ano (`mesesAtivosNoAno`) — mesma
 * régua usada em toda a família de Metas de Perdas. null = sem meta
 * cadastrada pra essa unidade/ano/indicador.
 */
export function metaPerdasMensalUnidade(
  metasPerdasIndicadores: MetaPerdaIndicador[],
  indicador: IndicadorKey,
  unidade: string,
  ano: number,
  dataEntrada: string | null,
): number | null {
  const rows = metasPerdasIndicadores.filter(m => m.unidade === unidade && m.ano === ano && m.indicador === indicador)
  if (rows.length === 0) return null
  const metaAnual = rows.reduce((acc, m) => acc + m.meta_anual, 0)
  return metaAnual / mesesAtivosNoAno(dataEntrada, ano)
}

/**
 * Mesma régua de `metaPerdasMensalUnidade`, mas somando os 8 indicadores de
 * uma vez (sem filtrar por `indicador`) — meta TOTAL de Perdas do mês pra uma
 * unidade, mesmo cálculo de `metaMensalUnidade` dentro de `calcularMatrizPerdas`.
 */
export function metaPerdasMensalTotalUnidade(
  metasPerdasIndicadores: MetaPerdaIndicador[],
  unidade: string,
  ano: number,
  dataEntrada: string | null,
): number | null {
  const rows = metasPerdasIndicadores.filter(m => m.unidade === unidade && m.ano === ano)
  if (rows.length === 0) return null
  const metaAnualTotal = rows.reduce((acc, m) => acc + m.meta_anual, 0)
  return metaAnualTotal / mesesAtivosNoAno(dataEntrada, ano)
}

/**
 * Valor de UM indicador de Perdas pra uma unidade/mês/negócio — DRE usa
 * `somaDif` no DRE daquele negócio (`negocio` default 'CONS' = unidade
 * inteira, comportamento de sempre), AUX soma `painel_perdas_aux` (com
 * `negocio` diferente de 'CONS', filtra pela linha daquele negócio — unidade
 * com 2 gerentes reais, ex: Camaçari, grava uma linha por negócio desde a
 * migration_131; 'CONS' soma todos os negócios, já que AUX não tem uma linha
 * 'CONS' de verdade pra unidade inteira). Réplica exata de
 * `valorIndicadorUnidadeMes` em `PainelPerdasPage.tsx` (mantida separada de
 * propósito — evita acoplar essa página, já complexa, a outros consumidores
 * como o SDG Gerentes; qualquer mudança de regra precisa espelhar as duas).
 */
export function valorIndicadorUnidadeMes(
  rowsDre: DreLongoRow[],
  rowsAux: PainelPerdasAux[],
  ind: (typeof INDICADORES_PERDAS)[number],
  unidade: string,
  ano: number,
  mes: number,
  negocio: string = 'CONS',
): number | null {
  if (ind.fonte === 'AUX') {
    const indKey = ind.key as PainelPerdasAux['indicador']
    const rows = rowsAux.filter(r =>
      r.unidade === unidade && r.ano === ano && r.mes === mes && r.indicador === indKey
      && (negocio === 'CONS' || r.negocio === negocio),
    )
    return rows.length > 0 ? rows.reduce((acc, r) => acc + r.valor, 0) : null
  }
  const rowsU = rowsDre.filter(
    r => r.unidade === unidade && r.negocio === negocio && r.tipo_periodo === 'MENSAL' && r.ano === ano && r.mes === mes,
  )
  if (rowsU.length === 0) return null
  return somaDif(rowsU, ind.contas)
}

/** Faturamento (conta '001', REMUN em magnitude) de uma unidade/mês — `negocio` default 'CONS' (unidade inteira, mesmo denominador de `calcularMatrizPerdas` pro % de Perdas); unidade com 2 gerentes reais pode pedir o faturamento só do próprio negócio (ROTA/ARM/EMP), pro % de Perdas bater com o Realizado também filtrado. null = sem dado no mês. */
export function faturamentoMes(rowsDre: DreLongoRow[], unidade: string, ano: number, mes: number, negocio: string = 'CONS'): number | null {
  const rows = rowsDre.filter(
    r => r.unidade === unidade && r.negocio === negocio && r.tipo_periodo === 'MENSAL' && r.ano === ano && r.mes === mes && r.conta_codigo.startsWith('001'),
  )
  if (rows.length === 0) return null
  return rows.reduce((acc, r) => acc + Math.abs(r.remunerado ?? 0), 0)
}

function somaAux(rows: PainelPerdasAux[], unidade: string | null, indicador: PainelPerdasAux['indicador']): number {
  return rows
    .filter(r => (unidade === null || r.unidade === unidade) && r.indicador === indicador)
    .reduce((acc, r) => acc + r.valor, 0)
}

// ─── Função principal ────────────────────────────────────────────────────────

/**
 * Monta a matriz do Painel de Perdas, espelhando a lógica da aba Gerencial
 * da página SDG do painel antigo (08_SDG.py, linhas ~2870–3100).
 *
 * @param rowsDre  Todas as linhas de vw_dre_longo disponíveis (sem pré-filtro).
 * @param rowsAux  Todos os registros de painel_perdas_aux disponíveis.
 * @param metasPerdasIndicadores Todos os registros de metas_perdas_indicadores
 *   pro `ano` exibido (Metas > Metas de Perdas — meta anual por indicador,
 *   sem quebra mensal). META (%) e META (R$) somam os 8 indicadores em vez de
 *   usar o total único da tabela `metas_perdas` (antiga, cadastro manual).
 * @param ano      Ano a exibir.
 * @param meses    Meses selecionados (ex: [1, 2, 3]).
 * @param dataEntradaPorUnidade `data_entrada` de cada unidade (Administração
 *   > Unidades) — usado só pra distribuir a Meta de Perdas anual (META %/R$)
 *   pelos meses em que a unidade realmente esteve ativa, em vez de sempre
 *   por 12 (ver `mesesAtivosNoAno`) — unidade sem entrada aqui cai no padrão
 *   de 12, comportamento idêntico a antes.
 */
export function calcularMatrizPerdas(
  rowsDre: DreLongoRow[],
  rowsAux: PainelPerdasAux[],
  metasPerdasIndicadores: MetaPerdaIndicador[],
  ano: number,
  meses: number[],
  dataEntradaPorUnidade: Map<string, string | null> = new Map(),
): MatrizPerdas {
  if (meses.length === 0) return { unidades: [], linhas: [] }

  // ── Dados DRE filtrados: CONS + MENSAL + ano + meses selecionados
  const dreMensal = rowsDre.filter(
    r => r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === ano && meses.includes(r.mes),
  )

  // ── Dados AUX filtrados: ano + meses selecionados
  const auxFiltrado = rowsAux.filter(r => r.ano === ano && meses.includes(r.mes))

  // ── Unidades: das linhas MENSAL, exceto AMBEV — depois AMBEV ao final
  const unidadesSet = new Set(dreMensal.filter(r => r.unidade !== 'AMBEV').map(r => r.unidade))
  const unidades = [...Array.from(unidadesSet).sort(), 'AMBEV']

  // ── Linhas de indicadores ────────────────────────────────────────────────
  const linhasIndicadores: LinhaPerdas[] = INDICADORES_PERDAS.map(ind => {
    const valores: Record<string, number | null> = {}
    for (const u of unidades) {
      if (ind.fonte === 'DRE') {
        const rowsU = dreMensal.filter(r => r.unidade === u)
        valores[u] = rowsU.length > 0 ? somaDif(rowsU, ind.contas) : null
      } else {
        // AUX: AMBEV = soma de todas as unidades
        const indKey = ind.key as PainelPerdasAux['indicador']
        if (u === 'AMBEV') {
          valores[u] = somaAux(auxFiltrado, null, indKey)
        } else {
          const v = somaAux(auxFiltrado, u, indKey)
          // Retorna null se não há dados AUX para essa unidade nesse período
          const temDados = auxFiltrado.some(r => r.unidade === u && r.indicador === indKey)
          valores[u] = temDados ? v : null
        }
      }
    }
    return { tipo: 'indicador' as const, key: ind.key, label: ind.label, valores }
  })

  // ── TOTAL ────────────────────────────────────────────────────────────────
  const totalValores: Record<string, number | null> = {}
  for (const u of unidades) {
    const vals = linhasIndicadores.map(l => l.valores[u])
    const temAlgum = vals.some(v => v !== null)
    totalValores[u] = temAlgum ? vals.reduce((acc, v) => (acc ?? 0) + (v ?? 0), 0 as number | null) : null
  }

  // ── FATURAMENTO (soma da conta 001, REMUN, dos mesmos meses MENSAL
  // selecionados no filtro — precisa bater com o recorte de TOTAL, senão o %
  // de perdas fica errado ao selecionar um subconjunto de meses (ex: só um
  // mês teria o prejuízo desse mês dividido pelo faturamento do ano inteiro).
  // Antes usava sempre o acumulado do ano até o último mês disponível
  // (ACUMULADO_ANO), independente dos meses marcados no filtro.
  const fatValores: Record<string, number | null> = {}
  for (const u of unidades) {
    const rowsU = dreMensal.filter(r => r.unidade === u && r.conta_codigo.startsWith('001'))
    if (rowsU.length === 0) { fatValores[u] = null; continue }
    fatValores[u] = rowsU.reduce((acc, r) => acc + Math.abs(r.remunerado ?? 0), 0)
  }

  // ── PERDAS ACUMULADAS (%) = TOTAL / FATURAMENTO
  const perdasPctValores: Record<string, number | null> = {}
  for (const u of unidades) {
    const total = totalValores[u]
    const fat = fatValores[u]
    if (total === null || fat === null || fat === 0) { perdasPctValores[u] = null; continue }
    perdasPctValores[u] = total / fat
  }

  // ── META (%) e META (R$) — soma dos 8 indicadores de metas_perdas_indicadores
  // (meta_anual, distribuída linearmente pelos meses selecionados, igual
  // metaPerdasMensal em PainelPerdasPage.tsx) — dividida pelos MESES ATIVOS
  // da unidade no ano, não sempre por 12 (ver mesesAtivosNoAno; unidade que
  // entrou em maio, por ex., divide por 8 — senão a meta mensal ficaria
  // artificialmente pequena nos meses em que ela de fato operou). META (%)
  // deriva do mesmo faturamento acumulado usado em PERDAS ACUMULADAS (%),
  // pra as duas serem comparáveis (ver classeCelula).
  //
  // AMBEV: cada unidade individual tem seu próprio divisor (mesesAtivos
  // pode variar entre elas), então a taxa mensal de cada uma é calculada
  // separada e só depois somada — não dá pra somar os meta_anual de todas
  // primeiro e dividir uma vez só, senão o divisor de uma unidade contamina
  // as outras.
  function metaMensalUnidade(unidade: string): number | null {
    const rows = metasPerdasIndicadores.filter(m => m.unidade === unidade && m.ano === ano)
    if (rows.length === 0) return null
    const metaAnualTotal = rows.reduce((acc, r) => acc + r.meta_anual, 0)
    return metaAnualTotal / mesesAtivosNoAno(dataEntradaPorUnidade.get(unidade) ?? null, ano)
  }

  const metaPctValores: Record<string, number | null> = {}
  const metaRsValores: Record<string, number | null> = {}
  for (const u of unidades) {
    let metaRs: number | null
    if (u === 'AMBEV') {
      const mensalPorUnidade = unidades
        .filter(x => x !== 'AMBEV')
        .map(metaMensalUnidade)
        .filter((v): v is number => v !== null)
      metaRs = mensalPorUnidade.length > 0 ? mensalPorUnidade.reduce((acc, v) => acc + v, 0) * meses.length : null
    } else {
      const mensal = metaMensalUnidade(u)
      metaRs = mensal !== null ? mensal * meses.length : null
    }
    metaRsValores[u] = metaRs
    const fat = fatValores[u]
    metaPctValores[u] = metaRs === null || fat === null || fat === 0 ? null : metaRs / fat
  }

  return {
    unidades,
    linhas: [
      ...linhasIndicadores,
      { tipo: 'total',       key: 'total',       label: 'TOTAL',                   valores: totalValores },
      { tipo: 'faturamento', key: 'faturamento', label: 'FATURAMENTO',              valores: fatValores },
      { tipo: 'perdas_pct',  key: 'perdas_pct',  label: 'PERDAS ACUMULADAS (%)',    valores: perdasPctValores },
      { tipo: 'meta_pct',    key: 'meta_pct',    label: 'META (%)',                 valores: metaPctValores },
      { tipo: 'meta_rs',     key: 'meta_rs',     label: 'META (R$)',                valores: metaRsValores },
    ],
  }
}
