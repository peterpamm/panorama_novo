import type { SdgJustificativa } from '@/types'

interface Props {
  justificativa: SdgJustificativa | undefined
}

function topicos(texto: string | undefined): string[] {
  return (texto ?? '').split('\n').map(l => l.trim()).filter(Boolean)
}

/**
 * Slide final do SDG Financeiro — "Assuntos Gerais": texto livre (assuntos
 * que precisam de ajuda, ou outros temas importantes do setor), escrito em
 * Área Financeira > SDG Financeiro. Sem cards/gráfico/Plano de Ação — só o
 * texto, bem centralizado, pra fechar a apresentação.
 */
export function SlideAssuntosGerais({ justificativa }: Props) {
  const itens = topicos(justificativa?.pontos_positivos)

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-10">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-lg dark:bg-slate-800/60 p-10">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500">
          Assuntos Gerais
        </p>
        {itens.length === 0 ? (
          <p className="text-center text-lg italic text-gray-400 dark:text-slate-500">
            Nenhum assunto registrado ainda.
          </p>
        ) : (
          <ul className="space-y-5">
            {itens.map((item, i) => (
              <li key={i} className="flex items-start justify-center gap-3 text-center">
                <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                <span className="text-xl font-medium leading-snug text-gray-800 dark:text-slate-100">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
