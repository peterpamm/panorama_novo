import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useFinanceiroDreAjustes } from '@/hooks/useFinanceiroDreAjustes'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { RV_FINANCEIRO_DRE } from '@/lib/constants'
import { ehSetorFinanceiro } from '@/lib/rv-gente'
import { AcompanhamentoFinanceiroTab } from '@/components/rv/AcompanhamentoFinanceiroTab'
import { RvApuracao } from '@/components/rv/RvApuracao'

type AbaRvFinanceiro = 'acompanhamento' | 'apuracao'

const ABAS = [
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'apuracao', label: 'Apuração' },
] as const

/**
 * Subpágina RV do Financeiro — /remuneracao-variavel/financeiro. Indicadores
 * 100% do DRE (Despesa ADM, Custo Operacional, Multas) + Vales, que usa a
 * mesma regra da RV de Distribuição (dispersão vs % da Meta de Perdas de
 * Vales, não mais dispersão ≥ 0).
 */
export function RvFinanceiroPage() {
  const [aba, setAba] = useState<AbaRvFinanceiro>('acompanhamento')
  // Ajuste manual TEMPORÁRIO de Multas/Vales (bug do DRE) — qualquer admin lê
  // (RLS de `financeiro_dre_ajustes_manuais`, migration 113), pra refletir
  // pra todo mundo que acessa essa tela; editar continua só o dono (botão de
  // edição do ajuste é `souDono &&`, ver AcompanhamentoReuniaoTab.tsx/RvApuracao.tsx).
  const { ajustes: ajustesFinanceiro, salvar: salvarAjusteFinanceiro, remover: removerAjusteFinanceiro } = useFinanceiroDreAjustes(true)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/remuneracao-variavel"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Remuneração Variável
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h2 className="text-base font-semibold text-foreground">RV do Financeiro</h2>
        <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />
      </div>

      {aba === 'acompanhamento' ? (
        <AcompanhamentoFinanceiroTab />
      ) : (
        <RvApuracao
          setorLabel="FINANCEIRO"
          ehDoSetor={ehSetorFinanceiro}
          indicadoresDre={RV_FINANCEIRO_DRE}
          tabelaPesos="rv_financeiro_pesos_dre"
          valesPerdasTabela="rv_vales_financeiro_meta"
          ajustesFinanceiro={ajustesFinanceiro}
          onSalvarAjusteFinanceiro={salvarAjusteFinanceiro}
          onRemoverAjusteFinanceiro={removerAjusteFinanceiro}
        />
      )}
      <Toaster />
    </div>
  )
}
