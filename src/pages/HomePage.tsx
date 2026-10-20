import { ExternalLink } from 'lucide-react'

interface LinkPainel {
  titulo: string
  descricao: string
  url: string
}

interface CategoriaPaineis {
  titulo: string
  paineis: LinkPainel[]
}

const CATEGORIAS: CategoriaPaineis[] = [
  {
    titulo: 'Painéis Operacionais',
    paineis: [
      { titulo: 'BNS', descricao: 'Bônus de Nível de Serviço', url: 'https://claude.ai/artifact/EdWEfX4LL8UfvAppVhrS3V' },
      { titulo: 'Score Card', descricao: 'Acompanhamento de indicadores por unidade', url: 'https://claude.ai/artifact/Lh3b6PhFXzUDEoFckcwqvE' },
    ],
  },
  {
    titulo: 'Painéis Financeiros',
    paineis: [
      { titulo: 'Painel de Multas', descricao: 'Acompanhamento de multas por unidade', url: 'https://painelamultas.netlify.app/' },
    ],
  },
  {
    titulo: 'Painéis da Frota',
    paineis: [
      { titulo: 'Gerenciador de Placas', descricao: 'Cadastro e consulta de placas da frota', url: 'https://gerenciador-plcas-log20.netlify.app/' },
    ],
  },
]

/**
 * Página inicial (/) — hub de acesso rápido a outros painéis que a LOG20
 * usa, fora deste app (cada um hospedado à parte). Fica FORA do
 * `DataProvider` de propósito (ver App.tsx): diferente de toda rota
 * "normal" do app, que carrega DRE/Orçamento/Painel de Perdas assim que
 * monta, essa tela não precisa de nenhum dado do Supabase, só os links —
 * antes o app caía direto no Farol de Metas (agora em `/farol-metas`) e já
 * disparava esse carregamento pesado só de abrir, mesmo quando a pessoa só
 * queria entrar num painel externo. Pra entrar no Panorama Financeiro em
 * si, usa o menu lateral normal (Farol de Metas é o 1º item).
 */
export function HomePage() {
  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Acesso rápido aos painéis que a LOG20 usa fora do Panorama Financeiro — pra entrar no Panorama em si, use o
        menu ao lado.
      </p>

      {CATEGORIAS.map(categoria => (
        <div key={categoria.titulo} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500">
            {categoria.titulo}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categoria.paineis.map(painel => (
              <a
                key={painel.url}
                href={painel.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-3 rounded-2xl border border-gray-200/30 bg-white/60 p-5 shadow-xl shadow-gray-200/20 backdrop-blur-xl transition-all duration-300 hover:border-blue-400/40 hover:shadow-gray-300/40 dark:border-gray-700/30 dark:bg-gray-800/60 dark:shadow-black/20 dark:hover:shadow-black/40"
              >
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{painel.titulo}</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{painel.descricao}</p>
                </div>
                <ExternalLink className="h-5 w-5 shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-gray-600" />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
