import { useMemo, useState } from 'react'
import { IndicadorChart } from '@/components/farol/IndicadorChart'
import { CapturaChart } from '@/components/farol/CapturaChart'
import { PresentationCard } from '@/pages/sdg/PresentationCard'
import { JustificativaEAcoesCard } from '@/pages/sdg/JustificativaEAcoesCard'
import { useIndicadorSdg, type IndicadorSdgParams } from '@/pages/sdg/useIndicadorSdg'
import { useContas } from '@/hooks/useContas'
import { topContasFaixa } from '@/lib/top-contas'
import { cn, formatCurrencyCompact } from '@/lib/utils'
import type { PlanoAcao, SdgJustificativa } from '@/types'

const CODIGO = '190'
/** Faixa das subcontas do pacote Despesas ADM Gerais (a linha 190 é o total do pacote). */
const CONTA_INI = 191
const CONTA_FIM = 227

interface Props extends Omit<IndicadorSdgParams, 'codigo'> {
  justificativa: SdgJustificativa | undefined
  acoesRelacionadas: PlanoAcao[]
}

export function Slide03AdmGeral(props: Props) {
  const { ano, mes, mesAcumMax, justificativa, acoesRelacionadas } = props
  const { info, calcMensal, calcYtd, mensal, ytd, serieAnual, serieCaptura } =
    useIndicadorSdg({ ...props, codigo: CODIGO })
  const { contas } = useContas()

  const [periodoTabela, setPeriodoTabela] = useState<'mensal' | 'ytd'>('mensal')
  const nomesPorCodigo = useMemo(() => new Map(contas.map(c => [c.codigo, c.descricao])), [contas])

  const linhas = useMemo(
    () => topContasFaixa(periodoTabela === 'mensal' ? calcMensal : calcYtd, CONTA_INI, CONTA_FIM),
    [periodoTabela, calcMensal, calcYtd],
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4">
          <PresentationCard
            nome={info.nome}
            periodo={`Mensal — M${mes}`}
            avr={mensal.avr}
            meta={mensal.meta}
            impacto={mensal.impacto}
            semaforo={mensal.semaforo}
          />
          <PresentationCard
            nome={info.nome}
            periodo={`YTD — M${mesAcumMax ?? mes}`}
            avr={ytd.avr}
            meta={ytd.meta}
            impacto={ytd.impacto}
            semaforo={ytd.semaforo}
          />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Acompanhamento Mensal — {ano}
            </p>
            <div className="h-[280px]">
              <IndicadorChart
                serie={serieAnual}
                gradientId={`sdg-${CODIGO}-mensal`}
                natureza={info.natureza}
                nomeSerie="Realizado"
              />
            </div>
          </div>

          <div className="flex flex-col rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Curva de Captura da Meta
            </p>
            <div className="h-[280px]">
              <CapturaChart
                serie={serieCaptura}
                natureza={info.natureza}
                nomeSerie="Realizado"
              />
            </div>
          </div>
        </div>

        {/* Top contas */}
        <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Top Contas — {CONTA_INI} a {CONTA_FIM}
            </p>
            <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-slate-700">
              {(['mensal', 'ytd'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodoTabela(p)}
                  className={cn(
                    'rounded-md px-2.5 py-0.5 text-xs font-medium transition',
                    periodoTabela === p
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-900 dark:text-white'
                      : 'text-gray-500 dark:text-slate-400',
                  )}
                >
                  {p === 'mensal' ? `M${mes}` : 'YTD'}
                </button>
              ))}
            </div>
          </div>

          {linhas.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-gray-400 dark:text-slate-500">
              Sem dados na faixa de contas.
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-800">
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-400 dark:border-slate-700 dark:text-slate-500">
                    <th className="pb-2 pr-2 font-medium">Conta</th>
                    <th className="pb-2 pr-2 text-right font-medium">Realizado</th>
                    <th className="pb-2 text-right font-medium">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l => (
                    <tr key={l.codigo} className="border-b border-gray-100 last:border-0 dark:border-slate-700/50">
                      <td className="py-1.5 pr-2 text-gray-700 dark:text-slate-300">
                        <span className="mr-1.5 text-xs text-gray-400 dark:text-slate-500">{l.codigo}</span>
                        {nomesPorCodigo.get(l.codigo) ?? '—'}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-gray-800 dark:text-slate-200">
                        {formatCurrencyCompact(l.realizado)}
                      </td>
                      <td className={cn(
                        'py-1.5 text-right font-medium tabular-nums',
                        l.gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                      )}>
                        {formatCurrencyCompact(l.gap)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <JustificativaEAcoesCard justificativa={justificativa} acoes={acoesRelacionadas} />
      </div>
    </div>
  )
}
