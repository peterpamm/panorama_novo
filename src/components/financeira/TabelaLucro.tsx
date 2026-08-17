import { Fragment, useMemo } from 'react'
import { formatCurrencyInteiro } from '@/lib/utils'
import type { LucroAmbevRow } from '@/types'

// Ordem preferida das colunas de negócio — o que não estiver aqui (novo negócio importado) entra depois, alfabético.
const ORDEM_NEGOCIO = ['ROTA', 'AS', 'ARM']

// ROTA + AS juntos compõem a Distribuição Urbana — Armazém é uma operação
// separada, não entra nessa soma.
const NEGOCIOS_DISTRIBUICAO = ['ROTA', 'AS']

// A planilha da Ambev traz o valor de UMA quinzena — como a tela mostra o
// mês cheio, Volume e Lucro (não R$/HL, que é uma taxa) precisam ser
// dobrados na exibição. Os valores ficam guardados crus (como vieram da
// planilha) — só a exibição multiplica.
function mesCheio(v: number): number {
  return v * 2
}

function fmtVolume(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtHl(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface TabelaLucroProps {
  /** Linhas do Lucro já filtradas pro ano/mês que a tela quer mostrar. */
  linhasPeriodo: LucroAmbevRow[]
  nomesUnidades: Map<string, string>
}

/**
 * Tabela do Lucro que a Ambev paga (Volume Atual × R$/HL): uma linha por
 * unidade, cada negócio virando um grupo de 3 colunas (Volume/R$/HL/Lucro),
 * com a coluna "Total Distribuição" (ROTA + AS) e a linha de Total no
 * rodapé. Compartilhada entre SDG Corp Fin > Lucro (com filtros de período)
 * e o slide "Lucro" da apresentação do SDG Corporativo.
 */
export function TabelaLucro({ linhasPeriodo, nomesUnidades }: TabelaLucroProps) {
  const negociosOrdenados = useMemo(() => {
    const presentes = Array.from(new Set(linhasPeriodo.map(l => l.negocio)))
    return presentes.sort((a, b) => {
      const ia = ORDEM_NEGOCIO.indexOf(a)
      const ib = ORDEM_NEGOCIO.indexOf(b)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.localeCompare(b)
    })
  }, [linhasPeriodo])

  // Distribuição (ROTA/AS) sempre antes de qualquer outro negócio (ex:
  // Armazém, quando entrar) — a coluna TOTAL DISTRIBUIÇÃO fica logo depois.
  const negociosDistribuicao = useMemo(
    () => negociosOrdenados.filter(n => NEGOCIOS_DISTRIBUICAO.includes(n)),
    [negociosOrdenados],
  )
  const negociosOutros = useMemo(
    () => negociosOrdenados.filter(n => !NEGOCIOS_DISTRIBUICAO.includes(n)),
    [negociosOrdenados],
  )
  const mostrarTotalDistribuicao = negociosDistribuicao.length > 0

  const unidadesPeriodo = useMemo(() => {
    const codigos = Array.from(new Set(linhasPeriodo.map(l => l.unidade)))
    return codigos.sort((a, b) => (nomesUnidades.get(a) ?? a).localeCompare(nomesUnidades.get(b) ?? b))
  }, [linhasPeriodo, nomesUnidades])

  function celula(unidade: string, negocio: string) {
    return linhasPeriodo.find(l => l.unidade === unidade && l.negocio === negocio) ?? null
  }

  function totalDistribuicao(unidade: string): number {
    const soma = linhasPeriodo
      .filter(l => l.unidade === unidade && NEGOCIOS_DISTRIBUICAO.includes(l.negocio))
      .reduce((acc, l) => acc + l.lucro, 0)
    return mesCheio(soma)
  }

  // Linha Total (rodapé) — só soma Lucro (R$); Volume e R$/HL não têm leitura
  // útil somados entre unidades, então ficam em branco nessa linha.
  function totalLucroNegocio(negocio: string): number {
    const soma = linhasPeriodo.filter(l => l.negocio === negocio).reduce((acc, l) => acc + l.lucro, 0)
    return mesCheio(soma)
  }

  function totalLucroDistribuicaoGeral(): number {
    const soma = linhasPeriodo.filter(l => NEGOCIOS_DISTRIBUICAO.includes(l.negocio)).reduce((acc, l) => acc + l.lucro, 0)
    return mesCheio(soma)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700">
            <th
              rowSpan={2}
              className="sticky left-0 z-10 bg-card px-4 py-2 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Unidade
            </th>
            {negociosDistribuicao.map(n => (
              <th
                key={n}
                colSpan={3}
                className="border-l border-gray-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:border-slate-700"
              >
                {n}
              </th>
            ))}
            {mostrarTotalDistribuicao && (
              <th
                rowSpan={2}
                className="border-l border-gray-200 bg-muted/40 px-3 py-2 text-center align-bottom text-xs font-semibold uppercase tracking-wide text-foreground dark:border-slate-700"
              >
                Total Distribuição
              </th>
            )}
            {negociosOutros.map(n => (
              <th
                key={n}
                colSpan={3}
                className="border-l border-gray-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:border-slate-700"
              >
                {n}
              </th>
            ))}
          </tr>
          <tr className="border-b border-gray-200 dark:border-slate-700">
            {[...negociosDistribuicao, ...negociosOutros].map(n => (
              <Fragment key={n}>
                <th className="border-l border-gray-200 px-2 py-1.5 text-right text-[11px] font-medium text-muted-foreground dark:border-slate-700">Volume</th>
                <th className="px-2 py-1.5 text-right text-[11px] font-medium text-muted-foreground">R$/HL</th>
                <th className="px-2 py-1.5 text-right text-[11px] font-medium text-muted-foreground">Lucro</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {unidadesPeriodo.map(u => (
            <tr key={u} className="border-b border-gray-200/30 transition-colors hover:bg-gray-50/50 dark:border-gray-700/30 dark:hover:bg-gray-700/30">
              <td className="sticky left-0 z-10 bg-card px-4 py-2 text-sm font-medium text-foreground">
                {nomesUnidades.get(u) ?? u}
              </td>
              {negociosDistribuicao.map(n => {
                const c = celula(u, n)
                return (
                  <Fragment key={n}>
                    <td className="border-l border-gray-200/30 px-2 py-2 text-right text-sm tabular-nums text-muted-foreground dark:border-gray-700/30">
                      {c ? fmtVolume(mesCheio(c.volume)) : '—'}
                    </td>
                    <td className="px-2 py-2 text-right text-sm tabular-nums text-muted-foreground">
                      {c ? fmtHl(c.valor_hl) : '—'}
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-semibold tabular-nums text-foreground">
                      {c ? formatCurrencyInteiro(mesCheio(c.lucro)) : '—'}
                    </td>
                  </Fragment>
                )
              })}
              {mostrarTotalDistribuicao && (
                <td className="border-l border-gray-200/30 bg-muted/40 px-3 py-2 text-right text-sm font-bold tabular-nums text-foreground dark:border-gray-700/30">
                  {formatCurrencyInteiro(totalDistribuicao(u))}
                </td>
              )}
              {negociosOutros.map(n => {
                const c = celula(u, n)
                return (
                  <Fragment key={n}>
                    <td className="border-l border-gray-200/30 px-2 py-2 text-right text-sm tabular-nums text-muted-foreground dark:border-gray-700/30">
                      {c ? fmtVolume(mesCheio(c.volume)) : '—'}
                    </td>
                    <td className="px-2 py-2 text-right text-sm tabular-nums text-muted-foreground">
                      {c ? fmtHl(c.valor_hl) : '—'}
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-semibold tabular-nums text-foreground">
                      {c ? formatCurrencyInteiro(mesCheio(c.lucro)) : '—'}
                    </td>
                  </Fragment>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/40 font-semibold">
            <td className="sticky left-0 z-10 bg-muted px-4 py-2 text-sm text-foreground">
              Total
            </td>
            {negociosDistribuicao.map(n => (
              <Fragment key={n}>
                <td className="border-l border-gray-200/30 px-2 py-2 text-right text-sm text-muted-foreground dark:border-gray-700/30">—</td>
                <td className="px-2 py-2 text-right text-sm text-muted-foreground">—</td>
                <td className="px-2 py-2 text-right text-sm font-bold tabular-nums text-foreground">
                  {formatCurrencyInteiro(totalLucroNegocio(n))}
                </td>
              </Fragment>
            ))}
            {mostrarTotalDistribuicao && (
              <td className="border-l border-gray-200/30 bg-muted/60 px-3 py-2 text-right text-sm font-bold tabular-nums text-foreground dark:border-gray-700/30">
                {formatCurrencyInteiro(totalLucroDistribuicaoGeral())}
              </td>
            )}
            {negociosOutros.map(n => (
              <Fragment key={n}>
                <td className="border-l border-gray-200/30 px-2 py-2 text-right text-sm text-muted-foreground dark:border-gray-700/30">—</td>
                <td className="px-2 py-2 text-right text-sm text-muted-foreground">—</td>
                <td className="px-2 py-2 text-right text-sm font-bold tabular-nums text-foreground">
                  {formatCurrencyInteiro(totalLucroNegocio(n))}
                </td>
              </Fragment>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
