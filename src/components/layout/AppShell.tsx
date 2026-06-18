import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

const PAGE_TITLES: Record<string, string> = {
  '/':           'Farol de Metas',
  '/metas':      'Metas',
  '/importacao': 'Importação de DRE',
  '/admin':      'Administração',
}

export function AppShell() {
  const { pathname } = useLocation()
  const basePath = '/' + (pathname.split('/')[1] ?? '')
  const title = PAGE_TITLES[basePath] ?? 'Panorama Financeiro'

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
