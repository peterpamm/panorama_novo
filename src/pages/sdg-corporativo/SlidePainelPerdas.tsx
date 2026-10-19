import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcularMatrizPerdas, type LinhaPerdas, type MatrizPerdas } from '@/lib/painel-perdas-calculations'
import { TableCard } from '@/components/ui/table-card'
import { MES_ABREV } from '@/components/farol/chart-shared'
import { cn, formatCurrencyInteiro } from '@/lib/utils'
import type { DreLongoRow, MetaPerdaIndicador, PainelPerdasAux, Unidade } from '@/types'

interface Props {
  /** Linhas do ano selecionado, de todas as unidades — sem filtro de negócio (Painel de Perdas é sempre CONS). */
  rowsAnoTodosNegocios: DreLongoRow[]
  /** Todos os registros de `painel_perdas_aux` (indisponibilidade/devolução) — vem do cache global (`DataContext`), sem filtro de ano/unidade (`calcularMatrizPerdas` filtra internamente). */
  rowsAux: PainelPerdasAux[]
  unidades: Unidade[]
  ano: number
  mes: number
}

const theadNavy = 'bg-gradient-to-r from-[hsl(222,45%,20%)] to-[hsl(222,35%,30%)] dark:from-[hsl(224,28%,14%)] dark:to-[hsl(224,22%,20%)]'
const thStickyNavy = 'bg-[hsl(222,45%,20%)] dark:bg-[hsl(224,28%,14%)]'

const POSITIVO = 'text-emerald-600 dark:text-emerald-400 font-semibold'
const NEGATIVO = 'text-red-600 dark:text-red-400 font-semibold'

/** Mesma régua de `classeCelula`/`formatarCelula` em `PainelPerdasPage.tsx` (mantida separada de propósito, ver comentário de `valorIndicadorUnidadeMes`) — só pras 3 linhas que esse resumo mostra (indicador/total comparam pelo sinal, perdas_pct compara contra a Meta (%) da mesma unidade). */
function classeCelula(linha: LinhaPerdas, unidade: string, matriz: MatrizPerdas): string {
  const val = linha.valores[unidade]
  if (val === null) return 'text-muted-foreground'
  if (linha.tipo === 'indicador' || linha.tipo === 'total') return val >= 0 ? POSITIVO : NEGATIVO
  if (linha.tipo === 'perdas_pct') {
    const meta = matriz.linhas.find(l => l.tipo === 'meta_pct')?.valores[unidade] ?? null
    if (meta === null) return 'text-muted-foreground font-semibold'
    return val >= meta ? POSITIVO : NEGATIVO
  }
  return ''
}

function formatarCelula(linha: LinhaPerdas, unidade: string): string {
  const val = linha.valores[unidade]
  if (val === null) return '—'
  if (linha.tipo === 'perdas_pct') return `${(val * 100).toFixed(2)}%`
  return Math.round(val).toLocaleString('pt-BR')
}

/**
 * Slide "Painel de Perdas" do SDG Corporativo — última leva, mesmo visual
 * (cabeçalho navy, unidades em coluna + AMBEV no final) e os mesmos 8
 * indicadores da tela cheia (`PainelPerdasPage.tsx`, aba Consolidado), só
 * que sem as linhas FATURAMENTO/META (%)/META (R$) — pedido do usuário pra
 * manter só TOTAL e PERDAS ACUMULADAS (%) como totalizadoras, resumindo pro
 * modo apresentação. Busca a própria Meta de Perdas (preciso pra colorir
 * PERDAS ACUMULADAS (%) direito, mesma regra da tela cheia) — só do mês
 * selecionado (sem toggle YTD, é resumo de apresentação, não análise).
 */
export function SlidePainelPerdas({ rowsAnoTodosNegocios, rowsAux, unidades, ano, mes }: Props) {
  const nomesUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])
  const dataEntradaPorUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.data_entrada])), [unidades])
  const rowsCons = useMemo(() => rowsAnoTodosNegocios.filter(r => r.negocio === 'CONS'), [rowsAnoTodosNegocios])

  const [metasPerdasIndicadores, setMetasPerdasIndicadores] = useState<MetaPerdaIndicador[]>([])
  useEffect(() => {
    let ativo = true
    supabase.from('metas_perdas_indicadores').select('*').eq('ano', ano)
      .then(({ data }) => { if (ativo) setMetasPerdasIndicadores((data ?? []) as MetaPerdaIndicador[]) })
    return () => { ativo = false }
  }, [ano])

  const matriz = useMemo(
    () => calcularMatrizPerdas(rowsCons, rowsAux, metasPerdasIndicadores, ano, [mes], dataEntradaPorUnidade),
    [rowsCons, rowsAux, metasPerdasIndicadores, ano, mes, dataEntradaPorUnidade],
  )
  const linhas = useMemo(
    () => matriz.linhas.filter(l => l.tipo === 'indicador' || l.tipo === 'total' || l.tipo === 'perdas_pct'),
    [matriz],
  )

  return (
    <div className="flex h-full flex-col items-center justify-center p-4">
      {matriz.unidades.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">Nenhum dado disponível para o período selecionado.</p>
      ) : (
        <div className="min-h-[95%] w-[96%]">
          <TableCard titulo="Painel de Perdas" subtitulo={`${MES_ABREV[mes]}/${ano}`}>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className={theadNavy}>
                  <tr className="border-b border-white/10">
                    <th className={cn('sticky left-0 z-10 px-4 py-3 text-left text-xs font-semibold text-white/80 min-w-[180px]', thStickyNavy)}>
                      Indicador
                    </th>
                    {matriz.unidades.map(u => (
                      <th
                        key={u}
                        className={cn('px-3 py-3 text-center text-xs font-semibold min-w-[100px]', u === 'AMBEV' ? 'text-white' : 'text-white/80')}
                      >
                        {nomesUnidade.get(u) ?? u}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha, idx) => {
                    const totalizadora = linha.tipo !== 'indicador'
                    return (
                      <tr
                        key={linha.key}
                        className={cn(
                          'border-b border-gray-200/30 dark:border-gray-700/30',
                          totalizadora && 'bg-muted/40',
                          totalizadora && idx > 0 && 'border-t-2 border-border',
                        )}
                      >
                        <td className={cn(
                          'sticky left-0 z-10 px-4 py-2.5 font-medium',
                          totalizadora ? 'bg-muted text-muted-foreground font-semibold text-xs uppercase tracking-wide' : 'bg-card text-foreground',
                        )}>
                          {linha.label}
                        </td>
                        {matriz.unidades.map(u => (
                          <td
                            key={u}
                            className={cn('px-3 py-2.5 text-center text-sm tabular-nums', classeCelula(linha, u, matriz), u === 'AMBEV' && 'bg-muted/20')}
                          >
                            {linha.tipo === 'perdas_pct' ? formatarCelula(linha, u) : (linha.valores[u] === null ? '—' : formatCurrencyInteiro(linha.valores[u] as number))}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </TableCard>
        </div>
      )}
    </div>
  )
}
