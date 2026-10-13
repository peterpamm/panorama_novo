import { Link } from 'react-router-dom'
import { ChevronRight, MonitorPlay, Presentation, Users } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/toaster'

interface SubpaginaCard {
  to: string
  titulo: string
  descricao: string
  icone: React.ReactNode
  corIcone: string
  /** Só o dono do sistema vê — mesma trava da rota (ver App.tsx). */
  donoApenas?: boolean
}

const SUBPAGINAS: SubpaginaCard[] = [
  {
    to: '/sdg/financeiro',
    titulo: 'SDG Financeiro',
    descricao: 'Justificativa do mês (Pontos Positivos/Negativos) por indicador — exibida no modo apresentação (SDG Financeiro).',
    icone: <MonitorPlay className="h-6 w-6 text-amber-500" />,
    corIcone: 'bg-amber-500/10',
  },
  {
    to: '/sdg/corp-fin',
    titulo: 'SDG Corp Fin',
    descricao: 'Assuntos Gerais e Lucro pra apresentação corporativa (SDG Corporativo, diretoria) — só o dono acessa.',
    icone: <Presentation className="h-6 w-6 text-indigo-500" />,
    corIcone: 'bg-indigo-500/10',
    donoApenas: true,
  },
  {
    to: '/sdg/gerentes',
    titulo: 'SDG Gerentes',
    descricao: 'Assuntos Gerais por unidade pra apresentação dos gerentes (SDG Gerentes) — qualquer usuário acessa.',
    icone: <Users className="h-6 w-6 text-rose-500" />,
    corIcone: 'bg-rose-500/10',
  },
]

/**
 * Hub do SDG: gestão de conteúdo das apresentações (Modo Apresentação), uma
 * subpágina por apresentação — mesmo molde de `AreaFinanceiraPage.tsx`, de
 * onde essas duas subpáginas foram migradas (antes `/area-financeira/
 * sdg-financeiro` e `/area-financeira/sdg-corp-fin`). Novas apresentações
 * entram como novos cards, e também aparecem no sidebar dentro de "SDG" (ver
 * navItems em Sidebar.tsx).
 */
export function SdgPage() {
  const { souDono } = useAuth()
  const subpaginasVisiveis = SUBPAGINAS.filter(s => !s.donoApenas || souDono)

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Gestão de conteúdo das apresentações (Modo Apresentação) — cada uma vira uma subpágina aqui e no menu lateral.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {subpaginasVisiveis.map(s => (
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
