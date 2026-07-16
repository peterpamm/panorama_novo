import { NavLink } from 'react-router-dom'
import {
  Gauge, LineChart, Trophy, Target, Upload,
  Settings, AlertTriangle, HandCoins, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip'

const navItems = [
  { to: '/',              icon: Gauge,         label: 'Farol de Metas' },
  { to: '/analise-conta', icon: LineChart,      label: 'Análise por Conta' },
  { to: '/ranking',       icon: Trophy,         label: 'Ranking' },
  { to: '/painel-perdas', icon: AlertTriangle,  label: 'Painel de Perdas' },
  { to: '/remuneracao-variavel', icon: HandCoins, label: 'Remuneração Variável' },
  { to: '/metas',         icon: Target,         label: 'Metas',          adminOnly: true },
  { to: '/importacao',    icon: Upload,         label: 'Importação',     adminOnly: true },
  { to: '/admin',         icon: Settings,       label: 'Administração',  adminOnly: true },
]

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

/**
 * Sidebar seguindo o design system LOG20 (artifact "LOG20 · Design System",
 * seção 04): gradiente navy vertical fixo (sempre escuro, nos dois temas),
 * itens em blue-300, ativo com gradiente azul→roxo + barra lateral.
 */
export function Sidebar({ open, onToggle }: SidebarProps) {
  const { role } = useAuth()

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative flex items-center rounded-lg text-sm font-medium transition-colors duration-150',
      open ? 'gap-3 px-3 py-2.5 w-full' : 'h-9 w-9 justify-center mx-auto',
      isActive
        ? 'bg-gradient-to-br from-blue-500/30 to-purple-500/20 font-semibold text-white shadow-lg shadow-blue-500/20'
        : 'text-blue-300 hover:bg-white/10 hover:text-white',
    )

  return (
    <aside
      className={cn(
        'relative flex h-screen shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200 ease-in-out',
        'border-[rgba(99,130,200,0.15)] bg-gradient-to-b from-slate-800 via-blue-950 to-slate-900',
        open ? 'w-60' : 'w-[60px]',
      )}
    >
      {/* ── Logo + toggle ── */}
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-[rgba(99,130,200,0.12)]',
          open ? 'px-4 gap-3' : 'justify-center',
        )}
      >
        {open && (
          <span className="flex-1 bg-gradient-to-br from-blue-300 to-purple-300 bg-clip-text text-sm font-bold tracking-tight text-transparent">
            Panorama Financeiro
          </span>
        )}
        <button
          onClick={onToggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-blue-300/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={open ? 'Recolher menu' : 'Expandir menu'}
        >
          {open
            ? <PanelLeftClose className="h-4 w-4" />
            : <PanelLeftOpen  className="h-4 w-4" />
          }
        </button>
      </div>

      {/* ── Navegação ── */}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {navItems
          .filter(item => !item.adminOnly || role === 'admin')
          .map(({ to, icon: Icon, label }) => {
            if (!open) {
              return (
                <Tooltip key={to} delayDuration={300}>
                  <TooltipTrigger asChild>
                    <div>
                      <NavLink to={to} end={to === '/'} className={navClass}>
                        <Icon className="h-4 w-4 shrink-0" />
                      </NavLink>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              )
            }

            return (
              <NavLink key={to} to={to} end={to === '/'} className={navClass}>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute -left-2 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-blue-400 to-purple-400" />
                    )}
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate leading-none">{label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
      </nav>
    </aside>
  )
}
