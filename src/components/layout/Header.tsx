import { LogOut, Moon, Sun, User } from 'lucide-react'
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
  const { user, role, unidade, signOut } = useAuth()

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-sm">
      <h1 className="text-base font-semibold text-foreground">{title}</h1>

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
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-3.5 w-3.5" />
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
