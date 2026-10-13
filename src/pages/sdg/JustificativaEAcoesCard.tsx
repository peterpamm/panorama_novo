import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { STATUS_LABEL, STATUS_PILL, estaAtrasado, formatDataBr } from '@/lib/plano-acao'
import { cn } from '@/lib/utils'
import type { PlanoAcao, SdgJustificativa } from '@/types'

interface Props {
  justificativa: SdgJustificativa | undefined
  acoes: PlanoAcao[]
}

function topicos(texto: string | undefined): string[] {
  return (texto ?? '').split('\n').map(l => l.trim()).filter(Boolean)
}

function ListaTopicos({ texto, vazio }: { texto: string | undefined; vazio: string }) {
  const itens = topicos(texto)
  if (itens.length === 0) {
    return <p className="text-sm italic text-gray-400 dark:text-slate-500">{vazio}</p>
  }
  return (
    <ul className="space-y-1.5">
      {itens.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-slate-300">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300 dark:bg-slate-600" />
          {item}
        </li>
      ))}
    </ul>
  )
}

/**
 * Bloco compartilhado dos slides "de resultado" do SDG: o print anexado
 * (opcional, ver Área Financeira > SDG Financeiro), a justificativa do mês em
 * tópicos (Pontos Positivos/Principais Impactos — aqui é só leitura) e as
 * ações do Plano de Ação ligadas a esse indicador pela tag (ver
 * `planos_acao_tags.sdg_indicador`).
 */
export function JustificativaEAcoesCard({ justificativa, acoes }: Props) {
  const printPath = justificativa?.print_path ?? null
  const [printUrl, setPrintUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!printPath) { setPrintUrl(null); return }
    let ativo = true
    supabase.storage.from('sdg-prints').createSignedUrl(printPath, 3600)
      .then(({ data }) => { if (ativo) setPrintUrl(data?.signedUrl ?? null) })
    return () => { ativo = false }
  }, [printPath])

  return (
    <div className="flex flex-col gap-5">
      {printUrl && (
        <div className="flex justify-center rounded-2xl bg-white shadow dark:bg-slate-800/60 p-4">
          <img src={printUrl} alt="Print anexado" className="max-h-[480px] w-auto rounded-lg object-contain" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Justificativa do Mês
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Pontos Positivos</p>
              <ListaTopicos texto={justificativa?.pontos_positivos} vazio="Nada registrado ainda." />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-red-600 dark:text-red-400">Principais Impactos</p>
              <ListaTopicos texto={justificativa?.pontos_negativos} vazio="Nada registrado ainda." />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
            Ações do Plano de Ação
          </p>
          <TabelaAcoesPlano acoes={acoes} />
        </div>
      </div>
    </div>
  )
}

/**
 * Tabela Ação/Prazo/Status do Plano de Ação — extraída daqui pra reaproveitar
 * em `SlidePlanoAcaoGerentes.tsx` (slide final do SDG Gerentes, que agrupa as
 * mesmas linhas por indicador em vez de mostrar 1 bloco só por slide).
 */
export function TabelaAcoesPlano({ acoes }: { acoes: PlanoAcao[] }) {
  if (acoes.length === 0) {
    return <p className="text-sm italic text-gray-400 dark:text-slate-500">Nenhuma ação ativa vinculada a esse indicador.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase text-gray-400 dark:border-slate-700 dark:text-slate-500">
            <th className="py-2 pr-3 text-left font-medium">Ação</th>
            <th className="py-2 pr-3 text-left font-medium">Prazo</th>
            <th className="py-2 pl-3 text-center font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {acoes.map(a => {
            const atrasado = estaAtrasado(a.prazo, a.status)
            return (
              <tr key={a.id} className="border-b border-gray-100 last:border-0 dark:border-slate-700/50">
                <td className="py-2 pr-3 font-medium text-gray-800 dark:text-slate-200">{a.titulo}</td>
                <td className={cn(
                  'py-2 pr-3 whitespace-nowrap',
                  atrasado ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400',
                )}>
                  {formatDataBr(a.prazo)}
                </td>
                <td className="py-2 pl-3 text-center">
                  <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_PILL[a.status])}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
