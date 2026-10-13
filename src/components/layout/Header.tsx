import { Building2, LogOut, MonitorPlay, Moon, Sun, Truck, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface HeaderProps {
  title: string
  isDark: boolean
  onToggleTheme: () => void
}

export function Header({ title, isDark, onToggleTheme }: HeaderProps) {
  const { user, role, unidade, souDono, signOut } = useAuth()
  const navigate = useNavigate()
  const inicial = user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200/30 bg-white/60 px-6 shadow-sm backdrop-blur-xl print:hidden dark:border-white/5 dark:bg-gray-800/60">
      <h1 className="bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-base font-semibold text-transparent">
        {title}
      </h1>

      <div className="flex items-center gap-1">
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={isDark ? 'Modo claro' : 'Modo escuro'}
        >
          {isDark
            ? <Sun  className="h-4 w-4" />
            : <Moon className="h-4 w-4" />
          }
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="ml-1 gap-2 text-muted-foreground hover:text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-[11px] font-bold text-white shadow-sm">
                {inicial}
              </div>
              <span className="hidden text-sm sm:inline">{user?.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="pb-1">
              <div className="text-xs font-medium text-foreground truncate">{user?.email}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {role === 'admin' ? 'Administrador' : 'Unidade'}
                {unidade && ` · ${unidade}`}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* Atalho pros modos apresentação (telas cheias, fora do AppShell) —
                antes só dava pra entrar neles pela tela de login, o que obrigava
                a deslogar só pra trocar de modo. Sair da apresentação (Esc ou o
                X do header dela) volta pro painel. */}
            <DropdownMenuLabel className="pb-1 text-xs font-medium text-muted-foreground">
              Modo apresentação
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate('/sdg-financeiro')} className="cursor-pointer">
              <MonitorPlay className="mr-2 h-4 w-4" />
              SDG Financeiro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/sdg-gerentes')} className="cursor-pointer">
              <Users className="mr-2 h-4 w-4" />
              SDG Gerentes
            </DropdownMenuItem>
            {souDono && (
              <DropdownMenuItem onClick={() => navigate('/sdg-corporativo')} className="cursor-pointer">
                <Building2 className="mr-2 h-4 w-4" />
                SDG Corporativo
              </DropdownMenuItem>
            )}
            {role === 'admin' && (
              <DropdownMenuItem onClick={() => navigate('/sdg-corporativo-frota')} className="cursor-pointer">
                <Truck className="mr-2 h-4 w-4" />
                SDG Corporativo de Frota
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
