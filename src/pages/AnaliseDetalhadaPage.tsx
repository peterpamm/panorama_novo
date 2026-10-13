import { Link } from 'react-router-dom'
import { ChevronRight, LineChart, Users } from 'lucide-react'

interface SubpaginaCard {
  to: string
  titulo: string
  descricao: string
  icone: React.ReactNode
  corIcone: string
}

const SUBPAGINAS: SubpaginaCard[] = [
  {
    to: '/analise-detalhada/conta',
    titulo: 'Análise por Conta',
    descricao: 'Visão de uma conta do DRE por vez — evolução mensal, comparativo ano vs ano, abertura de contas e comparativo por unidade.',
    icone: <LineChart className="h-6 w-6 text-blue-500" />,
    corIcone: 'bg-blue-500/10',
  },
  {
    to: '/analise-detalhada/pacote-de-gente',
    titulo: 'Pacote de Gente',
    descricao: 'Cards, gráfico mensal, comparativo de acumulado e tabela do Pacote de Gente — Salários, Benefícios, Segurança, Encargos e Vales.',
    icone: <Users className="h-6 w-6 text-emerald-500" />,
    corIcone: 'bg-emerald-500/10',
  },
]

/**
 * Hub de Análise Detalhada: uma subpágina por análise — novas análises entram
 * como novos cards, e também aparecem no sidebar dentro de "Análise
 * Detalhada" (ver navItems em Sidebar.tsx). Mesmo padrão de
 * `AreaFinanceiraPage.tsx`/`SdgPage.tsx`.
 */
export function AnaliseDetalhadaPage() {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Análises detalhadas por conta/pacote — cada uma vira uma subpágina aqui e no menu lateral.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SUBPAGINAS.map(s => (
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
    </div>
  )
}
