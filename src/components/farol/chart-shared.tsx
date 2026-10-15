import { calcularSemaforo } from '@/lib/farol-calculations'
import { formatPercent } from '@/lib/utils'
import type { Natureza } from '@/types'

export function getChartColors() {
  const isDark = document.documentElement.classList.contains('dark')
  return {
    grid:   isDark ? '#1e2a3a' : '#e2e8f0',
    axis:   isDark ? '#64748b' : '#94a3b8',
    legend: isDark ? '#94a3b8' : '#6b7280',
    /** Fundo do cursor de hover do Tooltip em gráficos de barra — sutil nos dois temas. */
    cursor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  }
}

/**
 * Rótulo de gap em pílula, nos tons dos badges dos cards (emerald/red suaves),
 * com fundo sólido pra ficar legível sobre barras. Número inteiro pt-BR, sem R$.
 * `positivo` decide a cor (nem sempre é value >= 0 — ex: GAP REAL invertido).
 */
export function GapPill({ x, y, value, positivo }: { x: number; y: number; value: number; positivo: boolean }) {
  const isDark = document.documentElement.classList.contains('dark')
  const bg = positivo
    ? (isDark ? '#064e3b' : '#d1fae5')   // emerald-900 / emerald-100
    : (isDark ? '#7f1d1d' : '#fee2e2')   // red-900 / red-100
  const fg = positivo
    ? (isDark ? '#6ee7b7' : '#047857')   // emerald-300 / emerald-700
    : (isDark ? '#fca5a5' : '#b91c1c')   // red-300 / red-700

  const texto = Math.round(value).toLocaleString('pt-BR')
  const largura = texto.length * 6.4 + 12
  const altura = 17

  return (
    <g>
      <rect x={x - largura / 2} y={y - altura / 2} width={largura} height={altura} rx={altura / 2} fill={bg} />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={fg}>
        {texto}
      </text>
    </g>
  )
}

export const MES_ABREV: Record<number, string> = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
}

export const COR_AVR = '#4f46e5'
export const COR_META = '#94a3b8'
/** Meta em destaque (amarelo) — usada quando a linha de meta precisa chamar mais atenção que o cinza neutro padrão (ex: SDG Corporativo). */
export const COR_META_DESTAQUE = '#eab308'
// Mesmos tons dos cards (emerald-500 / red-500, ver CORES_FAROL) — ficam bem no light e no dark.
export const COR_POSITIVO = '#10b981'
export const COR_NEGATIVO = '#ef4444'
export const COR_NECESSARIO = '#f59e0b'

/** Cor do ponto/rótulo conforme a meta foi batida (verde), perdida (vermelho) ou inexistente (indigo neutro). */
export function corPorSemaforo(avr: number, meta: number | null, natureza: Natureza): string {
  if (meta === null) return COR_AVR
  const { corClasse } = calcularSemaforo(avr, meta, natureza)
  if (corClasse === 'positivo') return COR_POSITIVO
  if (corClasse === 'negativo') return COR_NEGATIVO
  return COR_AVR
}

export interface ValorComMeta {
  avr: number | null
  meta: number | null
}

/**
 * Os pontos (dot) e rótulos custom do recharts só recebem cx/cy/x/y/index do
 * próprio recharts — não o resto da linha de dados. Por isso recebem
 * `valores` (a série já normalizada pro formato {avr, meta}, alinhada por
 * índice) em vez de depender do `payload` que o recharts injeta, cujo
 * formato varia entre os gráficos (avr/meta vs avrAcumulado/metaAnual).
 */
interface PontoDotProps {
  cx?: number
  cy?: number
  index?: number
  ultimoIndex: number
  natureza: Natureza
  valores: ValorComMeta[]
}

export function PontoDot({ cx, cy, index, ultimoIndex, natureza, valores }: PontoDotProps) {
  if (cx === undefined || cy === undefined || index === undefined) return null
  const ponto = valores[index]
  if (!ponto || ponto.avr === null) return null
  const atual = index === ultimoIndex
  const cor = corPorSemaforo(ponto.avr, ponto.meta, natureza)
  return <circle cx={cx} cy={cy} r={atual ? 4 : 3} fill={cor} stroke="none" />
}

interface PontoLabelProps {
  x?: number
  y?: number
  index?: number
  ultimoIndex: number
  natureza: Natureza
  valores: ValorComMeta[]
  formatter?: (v: number) => string
}

export function PontoLabel({ x, y, index, ultimoIndex, natureza, valores, formatter = v => formatPercent(v, 2) }: PontoLabelProps) {
  if (x === undefined || y === undefined || index === undefined) return null
  const ponto = valores[index]
  if (!ponto || ponto.avr === null) return null
  const atual = index === ultimoIndex
  const cor = corPorSemaforo(ponto.avr, ponto.meta, natureza)
  return (
    <text
      x={x}
      y={y - (atual ? 16 : 12)}
      textAnchor="middle"
      fontSize={atual ? 13 : 11}
      fontWeight={atual ? 700 : 600}
      fill={cor}
    >
      {formatter(ponto.avr)}
    </text>
  )
}

interface RotuloLinhaExtraProps {
  x?: number
  y?: number
  index?: number
  /** Índice do único ponto onde o rótulo aparece — evita repetir o texto em cada mês da linha (poluiria o gráfico). */
  primeiroIndex: number
  valor: number | null
  formatter: (v: number) => string
  /** Prefixo do texto (ex: "Necessário") — omitido por padrão, mostra só o valor formatado. */
  texto?: string
}

/** Rótulo de texto num único ponto de uma linha extra (ex: Curva de Captura) — usado em vez do `label` padrão do recharts (que repetiria em todo ponto da linha) pra não poluir o gráfico com um rótulo por mês. */
export function RotuloLinhaExtra({ x, y, index, primeiroIndex, valor, formatter, texto }: RotuloLinhaExtraProps) {
  if (x === undefined || y === undefined || index !== primeiroIndex || valor === null) return null
  return (
    <text x={x} y={y - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill={COR_NECESSARIO}>
      {texto ? `${texto}: ${formatter(valor)}` : formatter(valor)}
    </text>
  )
}

// ─── Gráfico "Acumulado até MÊS" (ano anterior × ano atual × orçado) ────────

export interface BarraComparativo {
  rotulo: string
  valor: number | null
  cor: string
  /** Linhas de texto mostradas embaixo do rótulo desta barra (ex: ['+3,1% vs 2025', 'R$ 912.554']) — a barra "atual" (meio) não leva, ela é a referência que as outras duas comparam, não compara contra si mesma. */
  delta?: { linhas: string[]; positivo: boolean }
}

/** Domain (com folga proporcional ao intervalo) do eixo Y dos gráficos de barra "Acumulado até MÊS" — mesma regra de sempre, só generalizada pra N barras (antes só ano anterior/atual, agora + Orçado). */
export function domainComparativo(valores: (number | null)[]): [number, number] {
  const nums = valores.filter((v): v is number => v !== null)
  const min = Math.min(0, ...nums)
  const max = Math.max(0, ...nums)
  const folga = (max - min || 1) * 0.18
  return [min - folga, max + folga]
}

/**
 * Tick customizado do eixo X dos gráficos "Acumulado até MÊS" — além do
 * rótulo da barra (ano, "Orçado"...), desenha embaixo dele o texto de delta
 * de quem tiver um (`barra.delta`), ex: "+3,1% vs 2025" embaixo da barra do
 * ano anterior e "−2,0% vs Orçado" embaixo da barra de Orçado — cada
 * comparação fica junto da barra a que ela se refere, em vez de uma legenda
 * única centralizada embaixo do gráfico inteiro.
 */
export function TickComparativoAcumulado({ x, y, payload, barras }: {
  x?: number
  y?: number
  payload?: { value: string }
  barras: BarraComparativo[]
}) {
  if (x === undefined || y === undefined || !payload) return null
  const isDark = document.documentElement.classList.contains('dark')
  const corRotulo = isDark ? '#cbd5e1' : '#374151'
  const barra = barras.find(b => b.rotulo === payload.value)
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={16} textAnchor="middle" fontSize={12} fontWeight={600} fill={corRotulo}>
        {payload.value}
      </text>
      {barra?.delta?.linhas.map((linha, i) => (
        <text
          key={i}
          x={0}
          y={32 + i * 13}
          textAnchor="middle"
          fontSize={i === 0 ? 11 : 10}
          fontWeight={i === 0 ? 700 : 500}
          fill={barra.delta!.positivo ? COR_POSITIVO : COR_NEGATIVO}
        >
          {linha}
        </text>
      ))}
    </g>
  )
}

export function TooltipCustom({
  active, payload, label, nomeAvr, nomeMeta = 'Meta', dataKeyAvr, dataKeyMeta, dataKeyCurva, formatter = v => formatPercent(v, 2),
}: {
  active?: boolean
  payload?: { value: number; dataKey: string }[]
  label?: number
  nomeAvr: string
  /** Nome da 2ª série no tooltip — default "Meta"; ex: "Remunerado" pra séries sem meta de orçamento. */
  nomeMeta?: string
  dataKeyAvr: string
  dataKeyMeta: string
  /** dataKey da 3ª linha opcional (Curva de Captura) — sem isso, o tooltip continua só com AVR/Meta. */
  dataKeyCurva?: string
  formatter?: (v: number) => string
}) {
  if (!active || !payload || payload.length === 0) return null
  const avr = payload.find(p => p.dataKey === dataKeyAvr)?.value
  const meta = payload.find(p => p.dataKey === dataKeyMeta)?.value
  const curva = dataKeyCurva ? payload.find(p => p.dataKey === dataKeyCurva)?.value : undefined
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
      <p className="mb-1.5 font-semibold">{MES_ABREV[label ?? 0] ?? label}</p>
      {avr !== undefined && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: COR_AVR }} />
          {nomeAvr}: <span className="font-medium text-popover-foreground">{formatter(avr)}</span>
        </p>
      )}
      {meta !== undefined && meta !== null && (
        <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full border border-border" style={{ background: COR_META }} />
          {nomeMeta}: <span className="font-medium text-popover-foreground">{formatter(meta)}</span>
        </p>
      )}
      {curva !== undefined && curva !== null && (
        <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full border border-border" style={{ background: COR_NECESSARIO }} />
          Curva de Captura: <span className="font-medium text-popover-foreground">{formatter(curva)}</span>
        </p>
      )}
    </div>
  )
}
