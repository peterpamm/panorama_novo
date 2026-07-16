import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

type Modo = 'panorama' | 'sdg'

const MODOS: { id: Modo; titulo: string; descricao: string; icone: string }[] = [
  { id: 'panorama', titulo: 'Panorama Financeiro', descricao: 'Análise completa por unidade', icone: '📊' },
  { id: 'sdg',      titulo: 'SDG Financeiro',       descricao: 'Modo de apresentação',        icone: '📽️' },
]

/**
 * Tela de login seguindo o design system LOG20 (artifact "LOG20 · Design System",
 * seção 09): única tela com fundo próprio (gray-900→800) e glassmorphism total —
 * header do card em navy gradient com logo ring, body em dark glass, botão branco.
 */
export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [modo, setModo] = useState<Modo>('panorama')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError('E-mail ou senha inválidos.')
    } else {
      navigate(modo === 'sdg' ? '/sdg-financeiro' : '/')
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      {/* Glow decorativo */}
      <div className="pointer-events-none absolute -right-16 -top-20 h-[300px] w-[300px] rounded-full bg-white/[0.03] blur-3xl" />

      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-gray-800/70 shadow-[0_24px_64px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        {/* Header navy com logo */}
        <div className="flex flex-col items-center gap-2.5 border-b border-white/10 bg-gradient-to-br from-[hsl(222,45%,17%)] to-[hsl(222,35%,27%)] px-6 pb-5 pt-7 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-[rgba(10,15,30,0.6)] backdrop-blur-md">
            <span className="bg-gradient-to-br from-orange-400 to-white bg-clip-text text-[22px] font-black text-transparent">
              L20
            </span>
          </div>
          <div>
            <div className="text-lg font-bold text-white">Panorama Financeiro</div>
            <div className="text-xs text-slate-400">Acesse sua conta</div>
          </div>
        </div>

        {/* Body dark glass */}
        <div className="flex flex-col gap-4 px-6 pb-6 pt-5">
          {/* Seletor de destino */}
          <div className="grid grid-cols-2 gap-2">
            {MODOS.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModo(m.id)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-all',
                  modo === m.id
                    ? 'border-blue-500/60 bg-gradient-to-br from-blue-500/20 to-purple-500/10 shadow-lg shadow-blue-500/10'
                    : 'border-white/10 bg-slate-900/40 hover:border-white/25',
                )}
              >
                <div className="text-lg">{m.icone}</div>
                <div className={cn('mt-1 text-xs font-semibold', modo === m.id ? 'text-white' : 'text-gray-300')}>
                  {m.titulo}
                </div>
                <div className="text-[10px] leading-tight text-gray-500">{m.descricao}</div>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[11px] font-semibold text-gray-400">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-lg border border-white/10 bg-slate-900/50 py-2 pl-9 pr-3 text-sm text-gray-200 outline-none transition placeholder:text-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-[11px] font-semibold text-gray-400">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="password"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/10 bg-slate-900/50 py-2 pl-9 pr-10 text-sm text-gray-200 outline-none transition placeholder:text-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  tabIndex={-1}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition hover:text-gray-300"
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-lg bg-white py-2.5 text-sm font-bold text-gray-900 transition hover:bg-gray-100 disabled:opacity-60"
            >
              {loading ? 'Entrando...' : `Entrar no ${modo === 'sdg' ? 'SDG Financeiro' : 'Panorama'}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
