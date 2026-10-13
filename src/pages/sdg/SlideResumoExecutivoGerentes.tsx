import { Bell, Clock, ThumbsDown, ThumbsUp, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SdgJustificativa } from '@/types'

interface Props {
  justificativa: SdgJustificativa | undefined
}

function topicos(texto: string | undefined): string[] {
  return (texto ?? '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
}

interface Quadrante {
  titulo: string
  itens: string[]
  Icon: LucideIcon
  cor: string
}

function BlocoQuadrante({
  titulo,
  itens,
  Icon,
  cor,
}: Quadrante) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-lg dark:border-slate-700/50 dark:bg-slate-900/70">

      {/* Cabeçalho */}
      <div
        className={cn(
          'flex h-12 shrink-0 items-center gap-2 px-5 text-white',
          cor
        )}
      >
        <Icon className="h-4 w-4" />

        <p className="text-xs font-bold uppercase tracking-[0.12em]">
          {titulo}
        </p>
      </div>

      {/* Conteúdo */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">

        {itens.length === 0 ? (
          <p className="text-sm italic text-slate-400 dark:text-slate-500">
            Nenhum ponto registrado.
          </p>
        ) : (
          <ul className="space-y-3">

            {itens.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-3"
              >
                <span
                  className={cn(
                    'mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full',
                    cor
                  )}
                />

                <span className="text-[15px] font-medium leading-relaxed text-slate-700 dark:text-slate-200">
                  {item}
                </span>
              </li>
            ))}

          </ul>
        )}

      </div>
    </div>
  )
}

export function SlideResumoExecutivoGerentes({
  justificativa,
}: Props) {

  const quadrantes: Quadrante[] = [
    {
      titulo: 'Pontos Positivos',
      itens: topicos(justificativa?.pontos_positivos),
      Icon: ThumbsUp,
      cor: 'bg-emerald-500',
    },
    {
      titulo: 'Pontos Negativos',
      itens: topicos(justificativa?.pontos_negativos),
      Icon: ThumbsDown,
      cor: 'bg-red-500',
    },
    {
      titulo: 'Pontos de Atenção',
      itens: topicos(justificativa?.pontos_atencao),
      Icon: Bell,
      cor: 'bg-orange-500',
    },
    {
      titulo: 'Pontos em Andamento',
      itens: topicos(justificativa?.pontos_andamento),
      Icon: Clock,
      cor: 'bg-blue-500',
    },
  ]

  return (
    <div className="flex h-full flex-col">

      {/* Quadrantes */}
      <div className="flex min-h-0 flex-1 items-center justify-center">

        <div
          className="
            grid
            h-[74%]
            w-[84%]
            max-w-5xl
            grid-cols-2
            grid-rows-2
            gap-5
          "
        >

          {quadrantes.map(q => (
            <BlocoQuadrante
              key={q.titulo}
              {...q}
            />
          ))}

        </div>

      </div>

    </div>
  )
}