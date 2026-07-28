import { Link } from 'react-router-dom'
import { ChevronRight, AlertTriangle, Users, Banknote, Truck, ShieldCheck, Target, Warehouse, Boxes } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { useAuth } from '@/context/AuthContext'
import type { PaginaChave } from '@/lib/permissoes'

interface SubpaginaCard {
  to: string
  pagina: PaginaChave
  titulo: string
  descricao: string
  icone: React.ReactNode
  corIcone: string
}

const SUBPAGINAS: SubpaginaCard[] = [
  {
    to: '/metas/gerais',
    pagina: 'metas_gerais',
    titulo: 'Metas Gerais',
    descricao: 'Metas usadas só quando o período importado não traz AVO — arquivos antigos ou indicadores fora do plano de contas.',
    icone: <Target className="h-6 w-6 text-blue-500" />,
    corIcone: 'bg-blue-500/10',
  },
  {
    to: '/metas/perdas',
    pagina: 'metas_perdas',
    titulo: 'Metas de Perdas',
    descricao: 'Meta percentual e financeira anual por unidade — base do Painel de Perdas.',
    icone: <AlertTriangle className="h-6 w-6 text-amber-500" />,
    corIcone: 'bg-amber-500/10',
  },
  {
    to: '/metas/gente',
    pagina: 'metas_gente',
    titulo: 'Metas de Gente',
    descricao: 'Pesos dos indicadores do DRE e do BI, metas por operação/mês da RV de Gente.',
    icone: <Users className="h-6 w-6 text-purple-500" />,
    corIcone: 'bg-purple-500/10',
  },
  {
    to: '/metas/financeiro',
    pagina: 'metas_financeiro',
    titulo: 'Metas do Financeiro',
    descricao: 'Metas de RV (pesos dos indicadores do DRE) e Metas de Resultado (ex: aderência das Rotinas Financeiras).',
    icone: <Banknote className="h-6 w-6 text-emerald-500" />,
    corIcone: 'bg-emerald-500/10',
  },
  {
    to: '/metas/frota',
    pagina: 'metas_frota',
    titulo: 'Metas de Frota',
    descricao: 'Pesos dos indicadores do DRE e metas de Desconto CIVF / Desconto Stress Test.',
    icone: <Truck className="h-6 w-6 text-orange-500" />,
    corIcone: 'bg-orange-500/10',
  },
  {
    to: '/metas/seguranca',
    pagina: 'metas_seguranca',
    titulo: 'Metas de Segurança',
    descricao: 'Pesos do DRE e metas de DTO T1/T2, GSD, LogOn, Excesso de Velocidade, FAI e TRI.',
    icone: <ShieldCheck className="h-6 w-6 text-red-500" />,
    corIcone: 'bg-red-500/10',
  },
  {
    to: '/metas/distribuicao',
    pagina: 'metas_distribuicao',
    titulo: 'Metas Distribuição',
    descricao: 'Meta (R$) e peso da Indisponibilidade — resultado vem da mesma planilha importada no Painel de Perdas.',
    icone: <Warehouse className="h-6 w-6 text-cyan-500" />,
    corIcone: 'bg-cyan-500/10',
  },
  {
    to: '/metas/armazem',
    pagina: 'metas_armazem',
    titulo: 'Metas de Armazém',
    descricao: 'Metas e pesos de Presenteísmo AL, EFC, TMA, Refugo e Quebras (T2) e do T1 (Estância/CDR Bahia).',
    icone: <Boxes className="h-6 w-6 text-teal-500" />,
    corIcone: 'bg-teal-500/10',
  },
]

/**
 * Hub de Metas: um card por área — cada uma vira uma subpágina aqui e no
 * menu lateral (mesmo padrão da Área Financeira, ver navItems em Sidebar.tsx).
 * Cards filtrados por `permissoes_paginas` (ver AuthContext).
 */
export function MetasPage() {
  const { podeAcessarPagina } = useAuth()
  const subpaginasVisiveis = SUBPAGINAS.filter(s => podeAcessarPagina(s.pagina))

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Cadastro de metas por área — cada uma vira uma subpágina aqui e no menu lateral.
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
