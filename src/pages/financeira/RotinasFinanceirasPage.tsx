import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { CadastroRotinasTab } from '@/components/financeira/CadastroRotinasTab'
import { AcompanhamentoRotinasTab } from '@/components/financeira/AcompanhamentoRotinasTab'
import { DashboardRotinasTab } from '@/components/financeira/DashboardRotinasTab'

type AbaRotinas = 'acompanhamento' | 'dashboard' | 'cadastro'

const ABAS_BASE = [
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'dashboard', label: 'Dashboard' },
] as const

const ABA_CADASTRO = { value: 'cadastro', label: 'Cadastro' } as const

/**
 * Subpágina Rotinas — /area-financeira/rotinas. Substitui o GOP de rotinas em
 * planilha. Qualquer usuário logado pode ver (Acompanhamento/Dashboard);
 * editar (marcar OK/NOK, lançamento em massa, cadastro de rotinas) é só admin
 * — a aba Cadastro nem aparece pra quem não é admin.
 */
export function RotinasFinanceirasPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [aba, setAba] = useState<AbaRotinas>('acompanhamento')

  const abas = useMemo(() => (isAdmin ? [...ABAS_BASE, ABA_CADASTRO] : ABAS_BASE), [isAdmin])

  useEffect(() => {
    if (aba === 'cadastro' && !isAdmin) setAba('acompanhamento')
  }, [aba, isAdmin])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/area-financeira"
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Área Financeira
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <h2 className="text-base font-semibold text-foreground">Rotinas</h2>
        </div>
        <PillToggle opcoes={abas} value={aba} onChange={setAba} />
      </div>

      {aba === 'acompanhamento' ? (
        <AcompanhamentoRotinasTab podeEditar={isAdmin} />
      ) : aba === 'dashboard' ? (
        <DashboardRotinasTab />
      ) : (
        <CadastroRotinasTab />
      )}
      <Toaster />
    </div>
  )
}
