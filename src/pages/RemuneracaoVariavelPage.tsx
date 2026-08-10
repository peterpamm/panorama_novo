import { Link } from 'react-router-dom'
import { ChevronRight, Landmark, ShieldCheck, Truck, Users, Warehouse, Boxes, LayoutDashboard, Table2, Target, PackageSearch } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { useAuth } from '@/context/AuthContext'
import type { PaginaChave } from '@/lib/permissoes'

interface SetorCard {
  to: string
  /** Ausente só no card de Metas — o hub em si não exige uma página específica, cada subpágina dele checa a sua própria. */
  pagina?: PaginaChave
  /** Restringe o card a admin, igual à rota (ex: Metas). */
  adminOnly?: boolean
  titulo: string
  descricao: string
  icone: React.ReactNode
  corIcone: string
}

const SETORES: SetorCard[] = [
  {
    to: '/remuneracao-variavel/painel-geral',
    pagina: 'rv_painel_geral',
    titulo: 'Painel Geral',
    descricao: 'Visão do gerente da unidade — acompanhamento e valor a receber de todas as lideranças da sua unidade, por setor ou por liderança.',
    icone: <LayoutDashboard className="h-6 w-6 text-violet-500" />,
    corIcone: 'bg-violet-500/10',
  },
  {
    to: '/remuneracao-variavel/gente',
    pagina: 'rv_gente',
    titulo: 'RV de Gente',
    descricao: 'Disponibilidade, presenteísmo e demais indicadores de gente — acompanhamento mensal vs meta por operação.',
    icone: <Users className="h-6 w-6 text-blue-500" />,
    corIcone: 'bg-blue-500/10',
  },
  {
    to: '/remuneracao-variavel/financeiro',
    pagina: 'rv_financeiro',
    titulo: 'RV do Financeiro',
    descricao: 'Despesa ADM, Custo Operacional, Vales e Multas — indicadores 100% do DRE, acompanhamento e apuração mensal.',
    icone: <Landmark className="h-6 w-6 text-emerald-500" />,
    corIcone: 'bg-emerald-500/10',
  },
  {
    to: '/remuneracao-variavel/frota',
    pagina: 'rv_frota',
    titulo: 'RV de Frota',
    descricao: 'Manutenção, Pneus e Diesel — AVR vs meta do Farol, acompanhamento e apuração mensal.',
    icone: <Truck className="h-6 w-6 text-amber-500" />,
    corIcone: 'bg-amber-500/10',
  },
  {
    to: '/remuneracao-variavel/seguranca',
    pagina: 'rv_seguranca',
    titulo: 'RV de Segurança',
    descricao: "EPI's e Uniformes — AVR vs meta do Farol, acompanhamento e apuração mensal.",
    icone: <ShieldCheck className="h-6 w-6 text-rose-500" />,
    corIcone: 'bg-rose-500/10',
  },
  {
    to: '/remuneracao-variavel/distribuicao',
    pagina: 'rv_distribuicao',
    titulo: 'RV de Distribuição',
    descricao: 'Indisponibilidade — mesmo dado do Painel de Perdas, acompanhamento e apuração mensal.',
    icone: <Warehouse className="h-6 w-6 text-cyan-500" />,
    corIcone: 'bg-cyan-500/10',
  },
  {
    to: '/remuneracao-variavel/armazem',
    pagina: 'rv_armazem',
    titulo: 'RV de Armazém',
    descricao: 'T2 (EFC, TMA, Presenteísmo AL, Refugo, Quebras) e T1 (Estância/CDR Bahia) — acompanhamento e apuração mensal.',
    icone: <Boxes className="h-6 w-6 text-teal-500" />,
    corIcone: 'bg-teal-500/10',
  },
  {
    to: '/remuneracao-variavel/empurrada',
    pagina: 'rv_empurrada',
    titulo: 'RV de Empurrada',
    descricao: 'Só Estância — Indisponibilidade e Avaria de Transporte (Painel de Perdas) e GTY/TMV/Tempo de Rendição (Reunião Resultados), acompanhamento e apuração mensal.',
    icone: <PackageSearch className="h-6 w-6 text-orange-500" />,
    corIcone: 'bg-orange-500/10',
  },
  {
    to: '/remuneracao-variavel/matriz',
    pagina: 'rv_matriz',
    titulo: 'Matriz',
    descricao: 'Todas as lideranças dos 6 setores numa lista só, com o valor final a receber no mês — exportável em Excel.',
    icone: <Table2 className="h-6 w-6 text-indigo-500" />,
    corIcone: 'bg-indigo-500/10',
  },
  {
    to: '/remuneracao-variavel/metas',
    adminOnly: true,
    titulo: 'Metas',
    descricao: 'Cadastro de pesos e metas de cada setor, usados no cálculo da RV — Gente, Financeiro, Frota, Segurança, Distribuição e Armazém.',
    icone: <Target className="h-6 w-6 text-slate-500" />,
    corIcone: 'bg-slate-500/10',
  },
]

/**
 * Hub da Remuneração Variável: uma subpágina por setor, cada corporativo
 * controla as metas e resultados do seu — novos setores entram como novos cards.
 * Cards filtrados por `permissoes_paginas` (ver AuthContext) — um gerente de
 * unidade só vê o card de Painel Geral, por exemplo.
 */
export function RemuneracaoVariavelPage() {
  const { role, podeAcessarPagina } = useAuth()
  const setoresVisiveis = SETORES.filter(s =>
    (!s.pagina || podeAcessarPagina(s.pagina)) && (!s.adminOnly || role === 'admin'),
  )

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Acompanhamento da remuneração variável das lideranças por setor. Cada corporativo
        importa e controla as metas e resultados dos seus indicadores.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {setoresVisiveis.map(s => (
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
