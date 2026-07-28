import type { DreLongoRow, MetaPerdaIndicador, PainelPerdasAux } from '@/types'

// ─── Configuração dos indicadores ───────────────────────────────────────────

export const INDICADORES_PERDAS = [
  { key: 'indisponibilidade', label: 'Indisponibilidade',           fonte: 'AUX' as const },
  { key: 'devolucao',         label: 'Devolução',                   fonte: 'AUX' as const },
  { key: 'vales',             label: 'Vales',                       fonte: 'DRE' as const, contas: ['051', '052'] },
  { key: 'multas',            label: 'Multas',                      fonte: 'DRE' as const, contas: ['137', '222'] },
  { key: 'proc_trab',         label: 'Processos Trabalhistas',      fonte: 'DRE' as const, contas: ['042', '087', '167'] },
  { key: 'civif',             label: 'Desconto CIVIF',              fonte: 'DRE' as const, contas: ['130'] },
  { key: 'sinistro_frota',    label: 'Sinistro de Frota',           fonte: 'DRE' as const, contas: ['054', '124'] },
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

function somaDif(rows: DreLongoRow[], contas: readonly string[]): number {
  return rows
    .filter(r => contas.some(c => r.conta_codigo.startsWith(c)))
    .reduce((acc, r) => acc + (r.diferenca ?? 0), 0)
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
 */
export function calcularMatrizPerdas(
  rowsDre: DreLongoRow[],
  rowsAux: PainelPerdasAux[],
  metasPerdasIndicadores: MetaPerdaIndicador[],
  ano: number,
  meses: number[],
): MatrizPerdas {
  if (meses.length === 0) return { unidades: [], linhas: [] }

  // ── Dados DRE filtrados: CONS + MENSAL + ano + meses selecionados
  const dreMensal = rowsDre.filter(
    r => r.negocio === 'CONS' && r.tipo_periodo === 'MENSAL' && r.ano === ano && meses.includes(r.mes),
  )

  // ── Dados DRE acumulados: CONS + ACUMULADO_ANO + ano (para FATURAMENTO)
  const dreAcumulado = rowsDre.filter(
    r => r.negocio === 'CONS' && r.tipo_periodo === 'ACUMULADO_ANO' && r.ano === ano,
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

  // ── FATURAMENTO (ACUMULADO_ANO, conta 001, REMUN, último mes disponível)
  const fatValores: Record<string, number | null> = {}
  for (const u of unidades) {
    const rowsU = dreAcumulado.filter(r => r.unidade === u && r.conta_codigo.startsWith('001'))
    if (rowsU.length === 0) { fatValores[u] = null; continue }
    const maxMes = Math.max(...rowsU.map(r => r.mes))
    const rowMes = rowsU.find(r => r.mes === maxMes)
    fatValores[u] = rowMes ? Math.abs(rowMes.remunerado ?? 0) : null
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
  // metaPerdasMensal em PainelPerdasPage.tsx). AMBEV soma a meta de cada
  // unidade individual (não tem linha própria na planilha importada). META
  // (%) deriva do mesmo faturamento acumulado usado em PERDAS ACUMULADAS
  // (%), pra as duas serem comparáveis (ver classeCelula).
  const metaPctValores: Record<string, number | null> = {}
  const metaRsValores: Record<string, number | null> = {}
  for (const u of unidades) {
    const rows = u === 'AMBEV'
      ? metasPerdasIndicadores.filter(m => m.unidade !== 'AMBEV' && m.ano === ano)
      : metasPerdasIndicadores.filter(m => m.unidade === u && m.ano === ano)
    if (rows.length === 0) { metaPctValores[u] = null; metaRsValores[u] = null; continue }
    const metaAnualTotal = rows.reduce((acc, r) => acc + r.meta_anual, 0)
    const metaRs = (metaAnualTotal / 12) * meses.length
    metaRsValores[u] = metaRs
    const fat = fatValores[u]
    metaPctValores[u] = fat === null || fat === 0 ? null : metaRs / fat
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
