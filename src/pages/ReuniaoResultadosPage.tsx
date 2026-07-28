import { Link } from 'react-router-dom'
import { ChevronRight, Landmark } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'

interface SetorCard {
  to: string
  titulo: string
  descricao: string
  icone: React.ReactNode
  corIcone: string
}

const SETORES: SetorCard[] = [
  {
    to: '/reuniao-resultados/financeiro',
    titulo: 'Financeiro',
    descricao: 'Indicadores, metas e pontos do setor Financeiro — ranking mensal de pontos por unidade.',
    icone: <Landmark className="h-6 w-6 text-emerald-500" />,
    corIcone: 'bg-emerald-500/10',
  },
]

/**
 * Hub da Reunião Resultados: ranking mensal de pontos por setor (até 200
 * pontos), pra eleger a melhor liderança — não é RV. Um card por setor,
 * novos setores entram como novos cards (só Financeiro construído por ora).
 */
export function ReuniaoResultadosPage() {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Ranking mensal de pontos por setor, usado na reunião de resultados pra eleger a melhor liderança —
        cada setor tem até 200 pontos, divididos entre os indicadores cadastrados nele.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SETORES.map(s => (
          <Link
            key={s.to}
            to={s.to}
            className="group bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-gray-200/30 dark:border-gray-700/30 shadow-xl shadow-gray-200/20 dark:shadow-black/20 p-5 transition-all duration-300 hover:shadow-gray-300/40 dark:hover:shadow-black/40 hover:border-blue-400/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.corIcone}`}>
                {s.icone}
              </div>
              <ChevronRight className="h-5 w-5 text-gray-300 transition-all group-hover:translate-x-1 group-hover:text-blue-500 dark:text-gray-600" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">{s.titulo}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{s.descricao}</p>
          </Link>
        ))}
      </div>

      <Toaster />
    </div>
  )
}
