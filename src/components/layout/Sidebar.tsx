import { NavLink } from 'react-router-dom'
import { Gauge, Target, Upload, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

const navItems = [
  { to: '/',            icon: Gauge,    label: 'Farol de Metas' },
  { to: '/metas',       icon: Target,   label: 'Metas',         adminOnly: true },
  { to: '/importacao',  icon: Upload,   label: 'Importação',    adminOnly: true },
  { to: '/admin',       icon: Settings, label: 'Administração', adminOnly: true },
]

export function Sidebar() {
  const { role } = useAuth()

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      <div className="flex h-16 items-center px-6 border-b">
        <span className="font-bold text-lg text-primary">Panorama Financeiro</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems
          .filter(item => !item.adminOnly || role === 'admin')
          .map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
      </nav>
    </aside>
  )
}
