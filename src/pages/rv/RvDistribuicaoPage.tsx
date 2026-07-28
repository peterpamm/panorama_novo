import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { ehSetorDistribuicao } from '@/lib/rv-gente'
import { IndicadoresDistribuicaoCard } from '@/components/rv/IndicadoresDistribuicaoCard'
import { ValesPerdasCard } from '@/components/rv/ValesPerdasCard'
import { RvApuracao } from '@/components/rv/RvApuracao'

type AbaRvDistribuicao = 'acompanhamento' | 'apuracao'

const ABAS = [
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'apuracao', label: 'Apuração' },
] as const

/**
 * Subpágina RV de Distribuição — /remuneracao-variavel/distribuicao.
 * Indisponibilidade (todas as lideranças, vem do mesmo dado do Painel de
 * Perdas) + Pacote de Gente (158, origem no DRE, só lideranças da ROTA) +
 * Vales (DRE 051/052 vs % da Meta de Perdas de Vales, todas as lideranças) +
 * LogOn DU / Devolução / Presenteísmo DU (planilha compartilhada do BI,
 * todas as lideranças). Peso de cada indicador é por função da liderança
 * (COORD. DU / SUPERVISOR DU, cadastrado em Metas Distribuição) — LogOn DU
 * não conta pra SUPERVISOR DU.
 */
export function RvDistribuicaoPage() {
  const [aba, setAba] = useState<AbaRvDistribuicao>('acompanhamento')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/remuneracao-variavel"
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Remuneração Variável
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <h2 className="text-base font-semibold text-foreground">RV de Distribuição</h2>
        </div>
        <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />
      </div>

      {aba === 'acompanhamento' ? (
        <div className="space-y-6">
          <IndicadoresDistribuicaoCard />
          <ValesPerdasCard tabelaMeta="rv_vales_distribuicao_meta" />
        </div>
      ) : (
        <RvApuracao
          setorLabel="DISTRIBUIÇÃO"
          ehDoSetor={ehSetorDistribuicao}
          incluirIndisponibilidade
          incluirPacoteGenteDu
          valesPerdasTabela="rv_vales_distribuicao_meta"
          incluirLogonDu
          incluirDevolucao
          incluirPresenteismoDu
        />
      )}
      <Toaster />
    </div>
  )
}
