import { NavLink } from 'react-router-dom'
import {
  Gauge, LineChart, Trophy, Target, Upload,
  Settings, AlertTriangle, PanelLeftClose, PanelLeftOpen,
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
  { to: '/metas',         icon: Target,         label: 'Metas',          adminOnly: true },
  { to: '/importacao',    icon: Upload,         label: 'Importação',     adminOnly: true },
  { to: '/admin',         icon: Settings,       label: 'Administração',  adminOnly: true },
]

// Tokens CSS do sidebar — independentes do tema da página (sidebar é sempre escuro)
const S = {
  fg:      'text-[hsl(var(--sidebar-foreground))]',
  muted:   'text-[hsl(var(--sidebar-muted-foreground))]',
  hoverBg: 'hover:bg-[hsl(var(--sidebar-accent))]',
  hoverFg: 'hover:text-[hsl(var(--sidebar-foreground))]',
} as const

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

export function Sidebar({ open, onToggle }: SidebarProps) {
  const { role } = useAuth()

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center rounded-lg text-sm font-medium transition-colors duration-150',
      open ? 'gap-3 px-3 py-2.5 w-full' : 'h-9 w-9 justify-center mx-auto',
      isActive
        ? 'bg-primary text-primary-foreground shadow-sm'
        : cn(S.muted, S.hoverBg, S.hoverFg),
    )

  return (
    <aside
      className={cn(
        'relative flex h-screen flex-col border-r transition-[width] duration-200 ease-in-out overflow-hidden shrink-0',
        'bg-[hsl(var(--sidebar-background))] border-[hsl(var(--sidebar-border))]',
        open ? 'w-60' : 'w-[60px]',
      )}
    >
      {/* ── Logo + toggle ── */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-[hsl(var(--sidebar-border))]',
          open ? 'px-4 gap-3' : 'justify-center',
        )}
      >
        {open && (
          <span className={cn('flex-1 text-sm font-semibold tracking-tight', S.fg)}>
            Panorama <span className="text-primary">Financeiro</span>
          </span>
        )}
        <button
          onClick={onToggle}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
            S.muted, S.hoverBg, S.hoverFg,
          )}
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
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate leading-none">{label}</span>
              </NavLink>
            )
          })}
      </nav>
    </aside>
  )
}
