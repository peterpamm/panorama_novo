import { Link } from 'react-router-dom'
import { ChevronRight, Landmark, ShieldCheck, Truck, Users, Warehouse, Boxes, Crown, Wallet } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { useAuth } from '@/context/AuthContext'
import type { PaginaChave } from '@/lib/permissoes'

interface SetorCard {
  to: string
  pagina: PaginaChave
  /** Restringe o card a admin, igual à rota — Resumo Geral (visão corporativa) e Pagamento (dado sensível) usam isso. */
  adminOnly?: boolean
  titulo: string
  descricao: string
  icone: React.ReactNode
  corIcone: string
}

const SETORES: SetorCard[] = [
  {
    to: '/reuniao-resultados/resumo-geral',
    pagina: 'reuniao_resumo_geral',
    adminOnly: true,
    titulo: 'Resumo Geral',
    descricao: 'Consolida a pontuação dos 6 setores por unidade, soma bonificações (EBITDA + Ranking Ambev) e define o vencedor do mês/ano — só Corporativo.',
    icone: <Crown className="h-6 w-6 text-amber-600" />,
    corIcone: 'bg-amber-600/10',
  },
  {
    to: '/reuniao-resultados/financeiro',
    pagina: 'reuniao_financeiro',
    titulo: 'Financeiro',
    descricao: 'Indicadores, metas e pontos do setor Financeiro — ranking mensal de pontos por unidade.',
    icone: <Landmark className="h-6 w-6 text-emerald-500" />,
    corIcone: 'bg-emerald-500/10',
  },
  {
    to: '/reuniao-resultados/gente',
    pagina: 'reuniao_gente',
    titulo: 'Gente',
    descricao: 'AVR do Pacote de Gente e pontuação do Termômetro — ranking mensal de pontos por unidade.',
    icone: <Users className="h-6 w-6 text-blue-500" />,
    corIcone: 'bg-blue-500/10',
  },
  {
    to: '/reuniao-resultados/frota',
    pagina: 'reuniao_frota',
    titulo: 'Frota',
    descricao: 'Pacotes de Manutenção, Combustível e Pneu (DRE) e pontuação do Termômetro — ranking mensal de pontos por unidade.',
    icone: <Truck className="h-6 w-6 text-amber-500" />,
    corIcone: 'bg-amber-500/10',
  },
  {
    to: '/reuniao-resultados/seguranca',
    pagina: 'reuniao_seguranca',
    titulo: 'Segurança',
    descricao: 'Pacote Segurança (DRE) e pontuação do Termômetro — ranking mensal de pontos por unidade.',
    icone: <ShieldCheck className="h-6 w-6 text-rose-500" />,
    corIcone: 'bg-rose-500/10',
  },
  {
    to: '/reuniao-resultados/distribuicao',
    pagina: 'reuniao_distribuicao',
    titulo: 'Distribuição',
    descricao: 'DEV PDV/GTY, ON TIME/TMV, DEV HL/TEMPO RENDIÇÃO, JORNADA e INDISPONIBILIDADE — importados de planilha, ranking mensal por unidade.',
    icone: <Warehouse className="h-6 w-6 text-cyan-500" />,
    corIcone: 'bg-cyan-500/10',
  },
  {
    to: '/reuniao-resultados/armazem',
    pagina: 'reuniao_armazem',
    titulo: 'Armazém',
    descricao: 'Indicadores importados de planilha (aba Import RR_ARM), ranking mensal por unidade.',
    icone: <Boxes className="h-6 w-6 text-teal-500" />,
    corIcone: 'bg-teal-500/10',
  },
  {
    to: '/reuniao-resultados/pagamento',
    pagina: 'reuniao_pagamento',
    adminOnly: true,
    titulo: 'Pagamento',
    descricao: 'Cadastro das lideranças (cartão Extratta) e relatório em PDF de quem venceu cada setor no mês, pra enviar à matriz depositar o prêmio.',
    icone: <Wallet className="h-6 w-6 text-violet-600" />,
    corIcone: 'bg-violet-600/10',
  },
]

/**
 * Hub da Reunião Resultados: ranking mensal de pontos por setor (até 200
 * pontos), pra eleger a melhor liderança — não é RV. Um card por setor,
 * filtrado por permissão (mesmo padrão de `RemuneracaoVariavelPage.tsx`).
 */
export function ReuniaoResultadosPage() {
  const { role, podeAcessarPagina } = useAuth()
  const setoresVisiveis = SETORES.filter(s => podeAcessarPagina(s.pagina) && (!s.adminOnly || role === 'admin'))

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Ranking mensal de pontos por setor, usado na reunião de resultados pra eleger a melhor liderança —
        cada setor tem até 200 pontos, divididos entre os indicadores cadastrados nele.
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
