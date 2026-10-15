import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PillToggle } from '@/components/ui/pill-toggle'
import { IndicadorChart } from '@/components/farol/IndicadorChart'
import { calcularImpactoFinanceiro, type SeriePontoCaptura, type SeriePontoMensal } from '@/lib/farol-calculations'
import { formatCurrencyInteiro } from '@/lib/utils'
import type { Natureza } from '@/types'

type ModoExibicao = 'pct' | 'rs'

const OPCOES_MODO = [
  { value: 'pct' as const, label: '%' },
  { value: 'rs' as const, label: 'Impacto R$' },
]

export interface IndicadorPainelItem {
  codigo: string
  nome: string
  natureza: Natureza
  serieAnual: SeriePontoMensal[]
  serieCaptura: SeriePontoCaptura[]
}

interface IndicadorPainelProps {
  indicadores: IndicadorPainelItem[]
  ano: number
  /** Nome da série principal na legenda/tooltip dos gráficos — ex: "Realizado" no lugar do default "AVR Realizado". */
  nomeSerie?: string
  /** Nome da linha de meta na curva de captura — ex: "Meta Mensal (méd.)" no lugar do default "Meta Anual". */
  nomeMeta?: string
  /** Como formatar os valores nos gráficos — default percentual (AVR); passe formatCurrencyInteiro pra séries em R$. */
  formatter?: (v: number) => string
  /** Notificado sempre que o indicador selecionado no dropdown muda — pra outro componente (ex: uma tabela abaixo) acompanhar a mesma seleção. */
  onSelecionadoChange?: (codigo: string) => void
}

export function IndicadorPainel({ indicadores, ano, nomeSerie, nomeMeta, formatter, onSelecionadoChange }: IndicadorPainelProps) {
  const [selecionado, setSelecionado] = useState(indicadores[0]?.codigo ?? '')
  // "%" ou "Impacto R$" — só faz sentido pra séries que ainda são percentual
  // (formatter não veio de fora, ex: Redução de Custos já é R$ nativo, sem o
  // que converter). Pedido dos usuários: às vezes é difícil enxergar QUANTO
  // precisa economizar só olhando o percentual — ver calcularImpactoFinanceiro.
  const [modo, setModo] = useState<ModoExibicao>('pct')

  useEffect(() => {
    if (indicadores.length > 0 && !indicadores.some(i => i.codigo === selecionado)) {
      setSelecionado(indicadores[0].codigo)
    }
  }, [indicadores, selecionado])

  useEffect(() => {
    if (selecionado) onSelecionadoChange?.(selecionado)
  }, [selecionado, onSelecionadoChange])

  const toggleDisponivel = formatter === undefined
  const modoImpacto = toggleDisponivel && modo === 'rs'

  const atual = indicadores.find(i => i.codigo === selecionado) ?? indicadores[0]

  // Fallback só pro caso raro de `calcularSerieCaptura` não ter achado a
  // receita orçada de algum mês específico (normalmente ela vem preenchida
  // mês a mês, inclusive nos futuros — ver `SeriePontoCaptura.receita`).
  const receitaMediaCaptura = useMemo(() => {
    if (!atual) return 0
    const valores = atual.serieCaptura.map(p => p.receita).filter((v): v is number => v !== null && v !== undefined)
    return valores.length > 0 ? valores.reduce((acc, v) => acc + v, 0) / valores.length : 0
  }, [atual])

  const serieAnualExibida: SeriePontoMensal[] = useMemo(() => {
    if (!atual) return []
    if (!modoImpacto) return atual.serieAnual
    return atual.serieAnual.map(p => ({
      mes: p.mes,
      avr: calcularImpactoFinanceiro(p.avr, p.meta, p.receita ?? 0, atual.natureza),
      meta: 0, // linha de equilíbrio — o alvo do impacto é nunca ficar negativo
    }))
  }, [atual, modoImpacto])

  const serieCapturaExibida: SeriePontoCaptura[] = useMemo(() => {
    if (!atual) return []
    if (!modoImpacto) return atual.serieCaptura
    return atual.serieCaptura.map(p => ({
      mes: p.mes,
      avrRealizado: p.avrRealizado === null || p.receita == null
        ? null
        : calcularImpactoFinanceiro(p.avrRealizado, p.metaAnual, p.receita, atual.natureza),
      // Teto de gasto (ou alvo, pra performance) em R$ daquele mês — não um
      // gap contra a meta: o Necessário já É a meta ajustada, então o gap
      // dele contra a própria meta é quase sempre pertinho de zero, não
      // importa a gravidade real (ver farol-calculations.ts, calcularSerieCaptura).
      avrNecessario: p.avrNecessario === null
        ? null
        : (p.avrNecessario / 100) * (p.receita ?? receitaMediaCaptura),
      metaAnual: 0,
    }))
  }, [atual, modoImpacto, receitaMediaCaptura])

  if (indicadores.length === 0 || !atual) return null

  // Em modo Impacto R$ os dois pontos de comparação já viram avr=impacto/meta=0
  // (ver acima) — forçar natureza='performance' faz o semáforo (verde/vermelho)
  // dos gráficos usar a mesma regra "positivo é sempre bom", que já é como
  // calcularImpactoFinanceiro devolve o sinal (independente de custo/performance).
  const naturezaExibida: Natureza = modoImpacto ? 'performance' : atual.natureza
  const formatterExibido = modoImpacto ? formatCurrencyInteiro : formatter
  const nomeSerieExibido = modoImpacto ? 'Impacto Financeiro' : nomeSerie
  const curvaDisponivel = atual.serieCaptura.length > 0

  return (
    <Card className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-foreground">Tendência do indicador</div>
          <div className="text-xs text-muted-foreground">Ano {ano}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {toggleDisponivel && <PillToggle opcoes={OPCOES_MODO} value={modo} onChange={setModo} />}
          <Select value={selecionado} onValueChange={setSelecionado}>
            <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
            <SelectContent>
              {indicadores.map(i => <SelectItem key={i.codigo} value={i.codigo}>{i.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-muted-foreground">Acompanhamento mensal</div>
        <IndicadorChart
          serie={serieAnualExibida}
          gradientId={`grad-mensal-${atual.codigo}`}
          natureza={naturezaExibida}
          nomeSerie={nomeSerieExibido}
          nomeMeta={nomeMeta}
          formatter={formatterExibido}
          serieCaptura={serieCapturaExibida}
          mostrarCurvaCaptura={curvaDisponivel}
        />
      </div>

      <p className="mt-2 text-right text-[0.65rem] text-muted-foreground">
        <span className="text-green-600">●</span> meta batida &nbsp;
        <span className="text-red-600">●</span> meta não batida
      </p>
    </Card>
  )
}
