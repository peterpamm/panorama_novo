import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useTheme } from '@/hooks/useTheme'
import { TooltipProvider } from '@/components/ui/tooltip'

const PAGE_TITLES: Record<string, string> = {
  '/':              'Farol de Metas',
  '/analise-conta': 'Análise por Conta',
  '/ranking':       'Ranking',
  '/painel-perdas': 'Painel de Perdas',
  '/remuneracao-variavel': 'Remuneração Variável',
  '/metas':         'Metas',
  '/importacao':    'Importação de DRE',
  '/admin':         'Administração',
}

function getSidebarDefault(): boolean {
  return localStorage.getItem('pf-sidebar') !== 'closed'
}

export function AppShell() {
  const { pathname } = useLocation()
  const basePath = '/' + (pathname.split('/')[1] ?? '')
  const title = PAGE_TITLES[basePath] ?? 'Panorama Financeiro'

  const { isDark, toggleTheme } = useTheme()

  const [sidebarOpen, setSidebarOpen] = useState(getSidebarDefault)

  function handleToggleSidebar() {
    setSidebarOpen(prev => {
      const next = !prev
      localStorage.setItem('pf-sidebar', next ? 'open' : 'closed')
      return next
    })
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-gray-100/80 to-slate-200/80 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <Sidebar open={sidebarOpen} onToggle={handleToggleSidebar} />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Header title={title} isDark={isDark} onToggleTheme={toggleTheme} />
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}