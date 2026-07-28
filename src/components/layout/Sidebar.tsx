import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Gauge, LineChart, Trophy, Target, Upload,
  Settings, AlertTriangle, HandCoins, Banknote, Award, ChevronDown, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import type { PaginaChave } from '@/lib/permissoes'
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  adminOnly?: boolean
  /** Exclusivo do dono do sistema (flag `dono`) — só a Administração usa isso. */
  donoApenas?: boolean
  /** Exige essa página liberada em `permissoes_paginas` (ou ser dono). */
  pagina?: PaginaChave
  /** Subitens que aparecem recolhidos dentro deste item (só no modo expandido da sidebar). */
  children?: { to: string; label: string; pagina?: PaginaChave }[]
}

const navItems: NavItem[] = [
  { to: '/',              icon: Gauge,         label: 'Farol de Metas' },
  { to: '/analise-conta', icon: LineChart,      label: 'Análise por Conta' },
  { to: '/ranking',       icon: Trophy,         label: 'Ranking' },
  { to: '/painel-perdas', icon: AlertTriangle,  label: 'Painel de Perdas' },
  {
    to: '/remuneracao-variavel', icon: HandCoins, label: 'Remuneração Variável',
    children: [
      { to: '/remuneracao-variavel/painel-geral', label: 'Painel Geral', pagina: 'rv_painel_geral' },
      { to: '/remuneracao-variavel/gente', label: 'RV de Gente', pagina: 'rv_gente' },
      { to: '/remuneracao-variavel/financeiro', label: 'RV do Financeiro', pagina: 'rv_financeiro' },
      { to: '/remuneracao-variavel/frota', label: 'RV de Frota', pagina: 'rv_frota' },
      { to: '/remuneracao-variavel/seguranca', label: 'RV de Segurança', pagina: 'rv_seguranca' },
      { to: '/remuneracao-variavel/distribuicao', label: 'RV de Distribuição', pagina: 'rv_distribuicao' },
      { to: '/remuneracao-variavel/armazem', label: 'RV de Armazém', pagina: 'rv_armazem' },
      { to: '/remuneracao-variavel/matriz', label: 'Matriz', pagina: 'rv_matriz' },
    ],
  },
  {
    to: '/area-financeira', icon: Banknote, label: 'Área Financeira',
    children: [
      { to: '/area-financeira/rotinas', label: 'Rotinas' },
      { to: '/area-financeira/plano-de-acao', label: 'Plano de Ação' },
    ],
  },
  {
    to: '/metas', icon: Target, label: 'Metas', adminOnly: true,
    children: [
      { to: '/metas/gerais', label: 'Metas Gerais', pagina: 'metas_gerais' },
      { to: '/metas/perdas', label: 'Metas de Perdas', pagina: 'metas_perdas' },
      { to: '/metas/gente', label: 'Metas de Gente', pagina: 'metas_gente' },
      { to: '/metas/financeiro', label: 'Metas do Financeiro', pagina: 'metas_financeiro' },
      { to: '/metas/frota', label: 'Metas de Frota', pagina: 'metas_frota' },
      { to: '/metas/seguranca', label: 'Metas de Segurança', pagina: 'metas_seguranca' },
      { to: '/metas/distribuicao', label: 'Metas Distribuição', pagina: 'metas_distribuicao' },
      { to: '/metas/armazem', label: 'Metas de Armazém', pagina: 'metas_armazem' },
    ],
  },
  {
    to: '/reuniao-resultados', icon: Award, label: 'Reunião Resultados',
    children: [
      { to: '/reuniao-resultados/financeiro', label: 'Financeiro', pagina: 'reuniao_financeiro' },
    ],
  },
  { to: '/importacao',    icon: Upload,         label: 'Importação',     adminOnly: true, pagina: 'importacao' },
  { to: '/admin',         icon: Settings,       label: 'Administração',  donoApenas: true },
]

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

/**
 * Sidebar seguindo o design system LOG20 (artifact "LOG20 · Design System",
 * seção 04): gradiente navy vertical fixo (sempre escuro, nos dois temas),
 * itens em blue-300, ativo com gradiente azul→roxo + barra lateral. Itens com
 * `children` (ex: Área Financeira > Rotinas) expandem/recolhem inline — abrem
 * sozinhos quando a rota atual já está dentro deles.
 */
export function Sidebar({ open, onToggle }: SidebarProps) {
  const { role, souDono, podeAcessarPagina } = useAuth()
  const location = useLocation()
  const [togglesManual, setTogglesManual] = useState<Record<string, boolean>>({})

  function itemVisivel(pagina?: PaginaChave, adminOnly?: boolean, donoApenas?: boolean): boolean {
    if (donoApenas && !souDono) return false
    if (adminOnly && role !== 'admin') return false
    if (pagina && !podeAcessarPagina(pagina)) return false
    return true
  }

  const itemsVisiveis = navItems
    .map(item => item.children ? { ...item, children: item.children.filter(c => itemVisivel(c.pagina)) } : item)
    .filter(item => itemVisivel(item.pagina, item.adminOnly, item.donoApenas) && !(item.children && item.children.length === 0))

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative flex items-center rounded-lg text-sm font-medium transition-colors duration-150',
      open ? 'gap-3 px-3 py-2.5 flex-1 min-w-0' : 'h-9 w-9 justify-center mx-auto',
      isActive
        ? 'bg-gradient-to-br from-blue-500/30 to-purple-500/20 font-semibold text-white shadow-lg shadow-blue-500/20'
        : 'text-blue-300 hover:bg-white/10 hover:text-white',
    )

  function estaExpandido(item: NavItem): boolean {
    if (!item.children) return false
    const manual = togglesManual[item.to]
    if (manual !== undefined) return manual
    return location.pathname.startsWith(item.to)
  }

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
        {itemsVisiveis
          .map(item => {
            const { to, icon: Icon, label, children } = item

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

            if (!children) {
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
            }

            const expandido = estaExpandido(item)
            return (
              <div key={to}>
                <div className="flex items-center gap-0.5">
                  <NavLink to={to} end className={navClass}>
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
                  <button
                    type="button"
                    onClick={() => setTogglesManual(prev => ({ ...prev, [to]: !expandido }))}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-blue-300/70 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label={expandido ? `Recolher ${label}` : `Expandir ${label}`}
                  >
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-150', expandido && 'rotate-180')} />
                  </button>
                </div>
                {expandido && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {children.map(child => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) => cn(
                          'block truncate rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                          isActive
                            ? 'bg-gradient-to-br from-blue-500/30 to-purple-500/20 font-semibold text-white'
                            : 'text-blue-300/80 hover:bg-white/10 hover:text-white',
                        )}
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
      </nav>
    </aside>
  )
}
