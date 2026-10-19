import { useMemo } from 'react'
import { BarChart3, CalendarDays } from 'lucide-react'
import { CardFarolGerente } from '@/components/farol-gerentes/CardFarolGerente'
import { calcularRampaBonus, montarCardsFarolGerentes, type ResultadoRampaBonus } from '@/lib/farol-gerentes'
import { PACOTES } from '@/lib/constants'
import { cn, formatPercent } from '@/lib/utils'
import type {
  DisponibilidadeArmazemAcumulada, DisponibilidadeEmpurradaAcumulada, DisponibilidadeRotaAcumulada, DreLongoRow,
  MetaPerdaIndicador, OrcamentoLinha, PainelPerdasAux, ResultadoTri, Unidade,
} from '@/types'

function corBonus(bonusPercent: number): string {
  if (bonusPercent >= 100) return 'text-emerald-600 dark:text-emerald-400'
  if (bonusPercent >= 75) return 'text-amber-600 dark:text-amber-400'
  if (bonusPercent >= 50) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

/** Um item da Rampa de Bônus (EBITDA ou Gastos Totais) — só o atingimento da unidade, sem mostrar os degraus da regra (pedido do usuário). */
function RampaBonusItem({ titulo, resultado }: { titulo: string; resultado: ResultadoRampaBonus | null }) {
  return (
    <div className="rounded-xl bg-white shadow dark:bg-slate-800/60 p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">{titulo}</p>
      {resultado === null ? (
        <p className="mt-2 text-sm text-gray-400 dark:text-slate-500">Sem meta cadastrada</p>
      ) : (
        <>
          <p className={cn('mt-1 text-xl font-bold', corBonus(resultado.bonusPercent))}>Atingiu {formatPercent(resultado.percentualAtingido, 1)}</p>
          <p className="text-xs text-muted-foreground">{resultado.bonusPercent}% do bônus</p>
        </>
      )}
    </div>
  )
}

interface Props {
  unidades: Unidade[]
  /** Código da unidade selecionada no cabeçalho da apresentação. */
  unidade: string
  /** Negócio selecionado no cabeçalho (CONS/ROTA/ARM/EMP) — unidade com split (ex: Camaçari CDL/CDR) só mostra o card do negócio escolhido; CONS mostra os 2 (resumo soma os dois, comportamento de sempre). */
  negocio: string
  /** Dataset do Farol Gerentes — TODAS as unidades (não só a selecionada), buscado via `useFarolGerentesDados` — precisa disso pro EBITDA Global (sempre o resultado da AMBEV). */
  rows: DreLongoRow[]
  orcamentos: OrcamentoLinha[]
  resultadosTri: ResultadoTri[]
  rowsAux: PainelPerdasAux[]
  metasPerdasIndicadores: MetaPerdaIndicador[]
  disponibilidadeRota: DisponibilidadeRotaAcumulada[]
  disponibilidadeArmazem: DisponibilidadeArmazemAcumulada[]
  disponibilidadeEmpurrada: DisponibilidadeEmpurradaAcumulada[]
  /** Faixa da Posição LOG20 pro `ano` selecionado (ver `linhaPosicaoLog20`) — null sem registro ainda. */
  posicaoLog20: string | null
  ano: number
  loading: boolean
}

/**
 * Slide "Metas Bônus" do SDG Gerentes — reaproveita o Farol Gerentes
 * (`montarCardsFarolGerentes`, mesma lógica de `FarolGerentesPage.tsx`) pra
 * mostrar só a unidade selecionada na apresentação: 2 cards de resumo
 * (quantidade total × indicadores batidos, Semestre e Ano) e embaixo o
 * `CardFarolGerente` completo (indicador a indicador) — o mesmo card "plain"
 * usado na seção Unidades Operacionais do Farol Gerentes, aqui centralizado
 * e maior já que é só uma unidade por vez (não uma grade). Unidades com
 * split de negócio (Camaçari/Ponta Grossa) mostram os 2 cards (um por
 * negócio) só quando o negócio selecionado no cabeçalho é Consolidado — com
 * ROTA/ARM/EMP selecionado, só o card daquele negócio aparece (gerente
 * travado no próprio `rvNegocio`, ver `SdgGerentesPage.tsx`, nunca vê o
 * card do outro).
 */
export function SlideMetasBonusGerentes({
  unidades, unidade, negocio, rows, orcamentos, resultadosTri, rowsAux, metasPerdasIndicadores, disponibilidadeRota,
  disponibilidadeArmazem, disponibilidadeEmpurrada, posicaoLog20, ano, loading,
}: Props) {
  const { cards } = useMemo(
    () => montarCardsFarolGerentes({
      unidades, rows, orcamentos, resultadosTri, rowsAux, metasPerdasIndicadores, disponibilidadeRota,
      disponibilidadeArmazem, disponibilidadeEmpurrada, posicaoLog20, ano,
    }),
    [
      unidades, rows, orcamentos, resultadosTri, rowsAux, metasPerdasIndicadores, disponibilidadeRota,
      disponibilidadeArmazem, disponibilidadeEmpurrada, posicaoLog20, ano,
    ],
  )
  // Unidade com split (Camaçari/Ponta Grossa) tem 1 card por negócio
  // (`card.negocio` = 'ROTA'/'ARM'/'EMP') — com um negócio específico
  // selecionado no cabeçalho (ex: CDR = ARM), só o card daquele negócio
  // aparece, senão o bônus do outro gerente (CDL) vazava aqui também, mesmo
  // filtrando só Armazém. Consolidado (CONS) continua mostrando os 2, igual
  // sempre foi (resumo soma os dois). Unidade sem split sempre tem só 1
  // card (`card.negocio === null`), passa direto em qualquer negócio.
  const cardsUnidade = useMemo(
    () => cards.filter(c =>
      c.card.unidadeCodigo === unidade && (negocio === 'CONS' || c.card.negocio === null || c.card.negocio === negocio),
    ),
    [cards, unidade, negocio],
  )

  const semestreTotal = cardsUnidade.reduce((acc, c) => acc + c.semestre.length, 0)
  const semestreBatidos = cardsUnidade.reduce((acc, c) => acc + c.semestre.filter(l => l.status === 'bateu').length, 0)
  const anoTotal = cardsUnidade.reduce((acc, c) => acc + c.ano.length, 0)
  const anoBatidos = cardsUnidade.reduce((acc, c) => acc + c.ano.filter(l => l.status === 'bateu').length, 0)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Carregando Farol Gerentes...
      </div>
    )
  }

  if (cardsUnidade.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Sem dados do Farol Gerentes pra essa unidade.
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        <div className="mx-auto grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white shadow dark:bg-slate-800/60 p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Semestre — Indicadores Batidos
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{semestreBatidos}/{semestreTotal}</p>
          </div>
          <div className="rounded-xl bg-white shadow dark:bg-slate-800/60 p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
              Ano — Indicadores Batidos
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{anoBatidos}/{anoTotal}</p>
          </div>
        </div>

        {/* `scale-125` aumenta o card PROPORCIONALMENTE (largura + altura —
            texto, padding, tudo junto), não só alargando o container (que só
            deixaria mais espaço em branco ao redor do mesmo conteúdo
            pequeno). Base menor (`max-w-2xl`) pra depois de escalado ficar
            perto do tamanho visual pretendido, sem estourar a largura do
            slide. `origin-top` mantém o topo fixo ao crescer. */}
        <div className="mx-auto w-full max-w-2xl origin-top scale-125 pb-10">
          <div className="flex flex-col gap-5">
            {cardsUnidade.map(c => (
              <div key={c.card.chave} className="flex flex-col gap-3">
                <CardFarolGerente
                  titulo={c.card.titulo}
                  secoes={[
                    { titulo: 'Semestre', icone: CalendarDays, linhas: c.semestre },
                    { titulo: 'Anual', icone: BarChart3, linhas: c.ano },
                  ]}
                />
                <div className="grid grid-cols-2 gap-3">
                  <RampaBonusItem
                    titulo={`Rampa Bônus · EBITDA Unidade${c.card.negocio ? ` (${c.card.negocio})` : ''}`}
                    resultado={c.ebitdaUnidade ? calcularRampaBonus(c.ebitdaUnidade.avr, c.ebitdaUnidade.meta, PACOTES['233'].natureza) : null}
                  />
                  <RampaBonusItem
                    titulo={`Rampa Bônus · Gastos Totais${c.card.negocio ? ` (${c.card.negocio})` : ''}`}
                    resultado={c.gastosTotais ? calcularRampaBonus(c.gastosTotais.avr, c.gastosTotais.meta, PACOTES['900'].natureza) : null}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
