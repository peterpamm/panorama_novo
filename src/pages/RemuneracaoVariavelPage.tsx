import { Link } from 'react-router-dom'
import { ChevronRight, Landmark, Truck, Users } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'

interface SetorCard {
  to: string
  titulo: string
  descricao: string
  icone: React.ReactNode
  corIcone: string
}

const SETORES: SetorCard[] = [
  {
    to: '/remuneracao-variavel/gente',
    titulo: 'RV de Gente',
    descricao: 'Disponibilidade, presenteísmo e demais indicadores de gente — acompanhamento mensal vs meta por operação.',
    icone: <Users className="h-6 w-6 text-blue-500" />,
    corIcone: 'bg-blue-500/10',
  },
  {
    to: '/remuneracao-variavel/financeiro',
    titulo: 'RV do Financeiro',
    descricao: 'Despesa ADM, Custo Operacional, Vales e Multas — indicadores 100% do DRE, acompanhamento e apuração mensal.',
    icone: <Landmark className="h-6 w-6 text-emerald-500" />,
    corIcone: 'bg-emerald-500/10',
  },
  {
    to: '/remuneracao-variavel/frota',
    titulo: 'RV de Frota',
    descricao: 'Manutenção, Pneus e Diesel — AVR vs meta do Farol, acompanhamento e apuração mensal.',
    icone: <Truck className="h-6 w-6 text-amber-500" />,
    corIcone: 'bg-amber-500/10',
  },
]

/**
 * Hub da Remuneração Variável: uma subpágina por setor, cada corporativo
 * controla as metas e resultados do seu — novos setores entram como novos cards.
 */
export function RemuneracaoVariavelPage() {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Acompanhamento da remuneração variável das lideranças por setor. Cada corporativo
        importa e controla as metas e resultados dos seus indicadores.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SETORES.map(s => (
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

        {/* Espaço reservado pros próximos setores */}
        <div className="flex min-h-[150px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 p-5 text-center dark:border-gray-700/50">
          <p className="text-sm font-medium text-gray-400 dark:text-gray-500">Novos setores em breve</p>
          <p className="mt-1 text-xs text-gray-400/80 dark:text-gray-600">Segurança...</p>
        </div>
      </div>

      <Toaster />
    </div>
  )
}
