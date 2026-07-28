import { useState } from 'react'
import { Bomb, Camera, Check, Table2, Trophy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCopiarComoImagem } from '@/hooks/useCopiarComoImagem'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard, tableCardActionClass } from '@/components/ui/table-card'
import { Button } from '@/components/ui/button'
import { cn, formatCurrencyInteiro, formatPercent, formatPercentSigned } from '@/lib/utils'
import { corClasseAtingimento, type RankingLinhaIndicador, type RankingLinhaReceita } from '@/lib/ranking-calculations'

// Destaque da linha: degradê que nasce na cor do resultado e se dissolve pra direita
// (mais presente que o /10 chapado de antes, sem cara de planilha).
const BG = {
  positivo: 'bg-gradient-to-r from-emerald-500/25 via-emerald-500/10 to-transparent',
  negativo: 'bg-gradient-to-r from-red-500/25 via-red-500/10 to-transparent',
  semCor: '',
} as const

const TEXTO = {
  positivo: 'text-emerald-600 dark:text-emerald-400',
  negativo: 'text-red-600 dark:text-red-400',
  semCor: '',
} as const

function corClasseDelta(delta: number | null): 'positivo' | 'negativo' | 'semCor' {
  if (delta === null) return 'semCor'
  return delta >= 0 ? 'positivo' : 'negativo'
}

function formatImpacto(valor: number): string {
  const sinal = valor >= 0 ? '+' : ''
  return `${sinal}${formatCurrencyInteiro(valor)}`
}

/** Valor inteiro pt-BR sem "R$" — padrão de dados das tabelas de perdas. */
function fmtValor(v: number): string {
  return Math.round(v).toLocaleString('pt-BR')
}

// Medalhas do pódio: ouro / prata / bronze.
const MEDALHA: Record<number, string> = {
  1: 'bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 ring-1 ring-yellow-400/40',
  2: 'bg-slate-400/20 text-slate-500 dark:text-slate-300 ring-1 ring-slate-400/40',
  3: 'bg-orange-400/20 text-orange-600 dark:text-orange-400 ring-1 ring-orange-400/40',
}

/** Posição no ranking: os 3 primeiros ganham medalha (círculo colorido), o resto número simples. */
function RankBadge({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="text-sm text-muted-foreground">—</span>
  const medalha = MEDALHA[rank]
  if (!medalha) return <span className="text-sm text-muted-foreground">{rank}</span>
  return (
    <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', medalha)}>
      {rank}
    </span>
  )
}

const linhaBorda = 'border-gray-200/30 dark:border-gray-700/30'

// ─── Modo Pódio (visão pra print/apresentação — layout padrão do projeto) ────

/** Item genérico do pódio — serve tanto pra indicadores (% + delta) quanto pra perdas (R$). */
export interface PodioItem {
  chave: string
  nome: string
  rank: number | null
  valorFmt: string
  /** Linha pequena sob o valor (ex: delta vs meta). */
  detalhe?: React.ReactNode
  /** Decide em qual lista entra (verde/vermelha) do 4º lugar em diante. */
  positivo: boolean
}

const PODIO = {
  1: { bloco: 'h-28 bg-gradient-to-t from-yellow-400/10 to-yellow-400/40 dark:from-yellow-400/5 dark:to-yellow-400/30', anel: 'ring-yellow-400', numero: 'text-yellow-500' },
  2: { bloco: 'h-20 bg-gradient-to-t from-slate-400/10 to-slate-400/40 dark:from-slate-400/5 dark:to-slate-400/30',   anel: 'ring-slate-400',  numero: 'text-slate-400' },
  3: { bloco: 'h-14 bg-gradient-to-t from-orange-400/10 to-orange-400/40 dark:from-orange-400/5 dark:to-orange-400/30', anel: 'ring-orange-400', numero: 'text-orange-500' },
} as const

function LugarPodio({ item, posicao }: { item: PodioItem; posicao: 1 | 2 | 3 }) {
  const estilo = PODIO[posicao]
  return (
    <div className="flex w-full flex-col items-center gap-2">
      {/* Espaço pra logo da unidade (placeholder com a inicial) */}
      <div className={cn(
        'flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-md ring-2 dark:bg-gray-800',
        estilo.anel,
      )}>
        <span className="text-lg font-black text-gray-700 dark:text-gray-200">{item.nome[0] ?? '?'}</span>
      </div>
      <div className="text-center">
        <div className="max-w-[140px] truncate text-sm font-semibold text-gray-900 dark:text-white">{item.nome}</div>
        <div className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{item.valorFmt}</div>
        {item.detalhe && <div className="text-xs font-semibold tabular-nums">{item.detalhe}</div>}
      </div>
      <div className={cn('flex w-full items-start justify-center rounded-t-xl pt-2', estilo.bloco)}>
        <span className={cn('text-3xl font-black', estilo.numero)}>{posicao}º</span>
      </div>
    </div>
  )
}

// "Pódio dos piores" (só ranking de Perdas, exceto BNS): mesma moldura do pódio
// padrão, mas em vermelho/laranja com bomba no lugar da medalha — pra não ficar
// com cara de conquista quando o que tá sendo destacado é o pior resultado.
const PODIO_PIOR = {
  1: { bloco: 'h-28 bg-gradient-to-t from-red-600/10 to-red-600/50 dark:from-red-600/10 dark:to-red-600/40', anel: 'ring-red-600', numero: 'text-red-600' },
  2: { bloco: 'h-20 bg-gradient-to-t from-red-400/10 to-red-400/40 dark:from-red-400/5 dark:to-red-400/30', anel: 'ring-red-400', numero: 'text-red-400 dark:text-red-300' },
  3: { bloco: 'h-14 bg-gradient-to-t from-orange-400/10 to-orange-400/40 dark:from-orange-400/5 dark:to-orange-400/30', anel: 'ring-orange-400', numero: 'text-orange-500' },
} as const

function LugarPodioPior({ item, posicao }: { item: PodioItem; posicao: 1 | 2 | 3 }) {
  const estilo = PODIO_PIOR[posicao]
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className={cn(
        'relative flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-md ring-2 dark:bg-gray-800',
        estilo.anel,
      )}>
        <span className="text-lg font-black text-gray-700 dark:text-gray-200">{item.nome[0] ?? '?'}</span>
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 ring-2 ring-white dark:ring-gray-900">
          <Bomb className="h-3 w-3 text-white" />
        </span>
      </div>
      <div className="text-center">
        <div className="max-w-[140px] truncate text-sm font-semibold text-gray-900 dark:text-white">{item.nome}</div>
        <div className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{item.valorFmt}</div>
      </div>
      <div className={cn('flex w-full flex-col items-center justify-start gap-0.5 rounded-t-xl pt-2', estilo.bloco)}>
        <span className={cn('text-2xl font-black', estilo.numero)}>{posicao}º</span>
        <span className={cn('text-[10px] font-bold uppercase tracking-wide', estilo.numero)}>pior</span>
      </div>
    </div>
  )
}

/**
 * Pódio dos piores: só sobem no destaque unidades com resultado NEGATIVO (uma
 * unidade positiva nunca aparece ali, mesmo que tecnicamente seja "rank 1" —
 * ela cai pra lista verde de baixo, igual sempre). Se tiver menos de 3 unidades
 * no vermelho, o pódio mostra só o que existir.
 */
function PodioPioresView({ itens, tituloPositivo, tituloNegativo }: {
  itens: PodioItem[]
  tituloPositivo: string
  tituloNegativo: string
}) {
  const ranqueados = itens.filter(i => i.rank !== null)
  const candidatos = ranqueados
    .filter(i => !i.positivo)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .slice(0, 3)
  const spotlightChaves = new Set(candidatos.map(i => i.chave))
  const top3 = ([2, 1, 3] as const)
    .map(pos => ({ pos, item: candidatos[pos - 1] }))
    .filter((x): x is { pos: 1 | 2 | 3; item: PodioItem } => x.item !== undefined)

  const resto = ranqueados.filter(i => !spotlightChaves.has(i.chave))
  const positivos = resto.filter(i => i.positivo)
  const negativos = resto.filter(i => !i.positivo)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
        <Bomb className="h-3.5 w-3.5" />
        Pódio dos piores
      </div>

      {top3.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Nenhuma unidade com resultado negativo neste período 🎉</p>
      ) : (
        <div className="mx-auto flex max-w-xl items-end gap-3">
          {top3.map(({ pos, item }) => (
            <LugarPodioPior key={pos} posicao={pos} item={item} />
          ))}
        </div>
      )}

      {/* Verde (esquerda) · vermelho (direita) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ListaPodio titulo={tituloPositivo} itens={positivos} positiva />
        <ListaPodio titulo={tituloNegativo} itens={negativos} positiva={false} />
      </div>
    </div>
  )
}

function ListaPodio({ titulo, itens, positiva }: {
  titulo: string
  itens: PodioItem[]
  positiva: boolean
}) {
  return (
    <div className={cn(
      'rounded-xl border p-3',
      positiva
        ? 'border-emerald-500/30 bg-emerald-500/5'
        : 'border-red-500/30 bg-red-500/5',
    )}>
      <div className={cn(
        'mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide',
        positiva ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
      )}>
        <span className={cn('h-2 w-2 rounded-full', positiva ? 'bg-emerald-500' : 'bg-red-500')} />
        {titulo}
      </div>
      {itens.length === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">Nenhuma unidade</p>
      ) : (
        <div className="space-y-1">
          {itens.map(i => (
            <div key={i.chave} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-gray-700 dark:text-gray-300">
                <span className="mr-1.5 text-xs text-muted-foreground">{i.rank}º</span>
                {i.nome}
              </span>
              <span className={cn(
                'shrink-0 font-semibold tabular-nums',
                positiva ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
              )}>
                {i.valorFmt}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Visão de pódio padrão do projeto: 2º·1º·3º com espaço de logo + listas verde (primeiro) e vermelha. */
function PodioView({ itens, tituloPositivo, tituloNegativo }: {
  itens: PodioItem[]
  tituloPositivo: string
  tituloNegativo: string
}) {
  const ranqueados = itens.filter(i => i.rank !== null)
  const top3 = ([2, 1, 3] as const)
    .map(pos => ({ pos, item: ranqueados.find(i => i.rank === pos) }))
    .filter((x): x is { pos: 1 | 2 | 3; item: PodioItem } => x.item !== undefined)
  const resto = ranqueados.filter(i => (i.rank ?? 0) > 3)
  const positivos = resto.filter(i => i.positivo)
  const negativos = resto.filter(i => !i.positivo)

  return (
    <div className="space-y-6 p-6">
      {/* Pódio: 2º · 1º · 3º */}
      <div className="mx-auto flex max-w-xl items-end gap-3">
        {top3.map(({ pos, item }) => (
          <LugarPodio key={pos} posicao={pos} item={item} />
        ))}
      </div>

      {/* Verde (esquerda) · vermelho (direita) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ListaPodio titulo={tituloPositivo} itens={positivos} positiva />
        <ListaPodio titulo={tituloNegativo} itens={negativos} positiva={false} />
      </div>
    </div>
  )
}

/** Botões padrão do header (copiar imagem + alternar pódio/tabela). */
function AcoesRanking({ modoPodio, onTogglePodio, status, onCopiar, iconeAtivar: IconeAtivar = Trophy, labelAtivar = 'Modo Pódio' }: {
  modoPodio: boolean
  onTogglePodio: () => void
  status: 'idle' | 'copiando' | 'copiado'
  onCopiar: () => void
  /** Ícone/label do botão quando ainda não está no modo pódio — Perdas (exceto BNS) usa Bomb em vez de Trophy. */
  iconeAtivar?: LucideIcon
  labelAtivar?: string
}) {
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn('gap-2', tableCardActionClass)}
        onClick={onCopiar}
        disabled={status === 'copiando'}
        title="Copiar o card como imagem (inclui o título)"
      >
        {status === 'copiado' ? <Check className="h-4 w-4 text-emerald-400" /> : <Camera className="h-4 w-4" />}
        {status === 'copiado' ? 'Copiado!' : status === 'copiando' ? 'Gerando...' : 'Copiar imagem'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={cn('gap-2', tableCardActionClass)}
        onClick={onTogglePodio}
      >
        {modoPodio ? <Table2 className="h-4 w-4" /> : <IconeAtivar className="h-4 w-4" />}
        {modoPodio ? 'Tabela' : labelAtivar}
      </Button>
    </>
  )
}

// ─── Receita ─────────────────────────────────────────────────────────────────

interface RankingTabelaReceitaProps {
  linhas: RankingLinhaReceita[]
  nomesUnidade: Map<string, string>
  titulo: string
  subtitulo?: string
}

export function RankingTabelaReceita({ linhas, nomesUnidade, titulo, subtitulo }: RankingTabelaReceitaProps) {
  return (
    <TableCard titulo={titulo} subtitulo={subtitulo}>
      {linhas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Sem dados para este período.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-center">Realizado</TableHead>
              <TableHead className="text-center">Orçado</TableHead>
              <TableHead className="text-center">Impacto</TableHead>
              <TableHead className="text-center">% Atingimento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(l => {
              const cor = l.rank === null ? 'semCor' : corClasseAtingimento(l.percentualAtingimento)
              const corImpacto = corClasseDelta(l.impacto)
              const ambev = l.unidade === 'AMBEV'
              return (
                <TableRow key={l.unidade} className={cn(linhaBorda, BG[cor])}>
                  <TableCell>
                    <RankBadge rank={l.rank} />
                  </TableCell>
                  <TableCell className={cn('text-sm', ambev && 'font-semibold')}>{nomesUnidade.get(l.unidade) ?? l.unidade}</TableCell>
                  <TableCell className="text-center text-sm">{formatCurrencyInteiro(l.realizado)}</TableCell>
                  <TableCell className="text-center text-sm">{formatCurrencyInteiro(l.orcado)}</TableCell>
                  <TableCell className={cn('text-center text-sm font-semibold', TEXTO[corImpacto])}>
                    {l.impacto === null ? '—' : formatImpacto(l.impacto)}
                  </TableCell>
                  <TableCell className={cn('text-center text-sm font-semibold', TEXTO[cor])}>
                    {formatPercent(l.percentualAtingimento, 1)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </TableCard>
  )
}

// ─── Indicadores (Farol: AVR × meta) ────────────────────────────────────────

interface RankingTabelaIndicadorProps {
  linhas: RankingLinhaIndicador[]
  nomesUnidade: Map<string, string>
  titulo: string
  subtitulo?: string
}

export function RankingTabelaIndicador({ linhas, nomesUnidade, titulo, subtitulo }: RankingTabelaIndicadorProps) {
  const [modoPodio, setModoPodio] = useState(false)
  const { ref, status, copiar } = useCopiarComoImagem(titulo)

  const itensPodio: PodioItem[] = linhas.map(l => ({
    chave: l.unidade,
    nome: nomesUnidade.get(l.unidade) ?? l.unidade,
    rank: l.rank,
    valorFmt: formatPercent(l.avr, 2),
    positivo: l.delta !== null && l.delta >= 0,
    detalhe: (
      <span className={TEXTO[corClasseDelta(l.delta)]}>
        {formatPercentSigned(l.delta, 2)} vs meta
      </span>
    ),
  }))

  return (
    <TableCard
      ref={ref}
      titulo={titulo}
      subtitulo={subtitulo}
      acoes={<AcoesRanking modoPodio={modoPodio} onTogglePodio={() => setModoPodio(v => !v)} status={status} onCopiar={copiar} />}
    >
      {linhas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Sem dados para este período.</p>
      ) : modoPodio ? (
        <PodioView itens={itensPodio} tituloPositivo="Meta batida" tituloNegativo="Abaixo da meta" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-center">AVR</TableHead>
              <TableHead className="text-center">Meta</TableHead>
              <TableHead className="text-center">Δ da Meta</TableHead>
              <TableHead className="text-center">Impacto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(l => {
              const cor = l.rank === null ? 'semCor' : corClasseDelta(l.delta)
              const corDelta = corClasseDelta(l.delta)
              const corImpacto = l.meta === null ? 'semCor' : l.impacto >= 0 ? 'positivo' : 'negativo'
              const ambev = l.unidade === 'AMBEV'
              return (
                <TableRow key={l.unidade} className={cn(linhaBorda, BG[cor])}>
                  <TableCell>
                    <RankBadge rank={l.rank} />
                  </TableCell>
                  <TableCell className={cn('text-sm', ambev && 'font-semibold')}>{nomesUnidade.get(l.unidade) ?? l.unidade}</TableCell>
                  <TableCell className="text-center text-sm">{formatPercent(l.avr, 2)}</TableCell>
                  <TableCell className="text-center text-sm">{formatPercent(l.meta, 2)}</TableCell>
                  <TableCell className={cn('text-center text-sm font-semibold', TEXTO[corDelta])}>
                    {formatPercentSigned(l.delta, 2)}
                  </TableCell>
                  <TableCell className={cn('text-center text-sm font-semibold', TEXTO[corImpacto])}>
                    {l.meta === null ? '—' : formatImpacto(l.impacto)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </TableCard>
  )
}

// ─── Perdas (Painel de Perdas: R$ por indicador, sem meta) ──────────────────

export interface RankingLinhaPerda {
  unidade: string
  /** Soma do período em R$ (diferença REAL−REMUN ou valor AUX); null = sem dado. */
  valor: number | null
  /** 1 = melhor ou pior, depende de pioresPrimeiro (ver RankingTabelaPerdasProps). null = AMBEV/sem dado. */
  rank: number | null
}

interface RankingTabelaPerdasProps {
  linhas: RankingLinhaPerda[]
  nomesUnidade: Map<string, string>
  titulo: string
  subtitulo?: string
  /**
   * true (padrão pra indicadores de perda de verdade): rank 1 = pior resultado,
   * e o Modo Pódio destaca as piores unidades (pódio vermelho, só quem teve
   * resultado negativo sobe nele). false (só BNS, que é receita boa dentro do
   * Painel de Perdas): mantém a regra normal, rank 1 = melhor, pódio dourado padrão.
   */
  pioresPrimeiro?: boolean
}

export function RankingTabelaPerdas({ linhas, nomesUnidade, titulo, subtitulo, pioresPrimeiro = true }: RankingTabelaPerdasProps) {
  const [modoPodio, setModoPodio] = useState(false)
  const { ref, status, copiar } = useCopiarComoImagem(titulo)

  const itensPodio: PodioItem[] = linhas.map(l => ({
    chave: l.unidade,
    nome: nomesUnidade.get(l.unidade) ?? l.unidade,
    rank: l.rank,
    valorFmt: l.valor === null ? '—' : fmtValor(l.valor),
    positivo: l.valor !== null && l.valor >= 0,
  }))

  return (
    <TableCard
      ref={ref}
      titulo={titulo}
      subtitulo={subtitulo}
      acoes={
        <AcoesRanking
          modoPodio={modoPodio}
          onTogglePodio={() => setModoPodio(v => !v)}
          status={status}
          onCopiar={copiar}
          iconeAtivar={pioresPrimeiro ? Bomb : Trophy}
          labelAtivar={pioresPrimeiro ? 'Pódio dos Piores' : 'Modo Pódio'}
        />
      }
    >
      {linhas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Sem dados para este período.</p>
      ) : modoPodio ? (
        pioresPrimeiro ? (
          <PodioPioresView itens={itensPodio} tituloPositivo="Resultado positivo" tituloNegativo="Resultado negativo" />
        ) : (
          <PodioView itens={itensPodio} tituloPositivo="Resultado positivo" tituloNegativo="Resultado negativo" />
        )
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-center">Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(l => {
              const cor = l.valor === null || l.rank === null ? 'semCor' : l.valor >= 0 ? 'positivo' : 'negativo'
              const corTexto = l.valor === null ? 'semCor' : l.valor >= 0 ? 'positivo' : 'negativo'
              const ambev = l.unidade === 'AMBEV'
              return (
                <TableRow key={l.unidade} className={cn(linhaBorda, BG[cor])}>
                  <TableCell>
                    <RankBadge rank={l.rank} />
                  </TableCell>
                  <TableCell className={cn('text-sm', ambev && 'font-semibold')}>{nomesUnidade.get(l.unidade) ?? l.unidade}</TableCell>
                  <TableCell className={cn('text-center text-sm font-semibold tabular-nums', TEXTO[corTexto])}>
                    {l.valor === null ? '—' : fmtValor(l.valor)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </TableCard>
  )
}

// ─── Pontos (Reunião Resultados: pontuação total do mês, desempate por EBITDA) ─

export interface RankingLinhaPontos {
  unidade: string
  /** Soma de pontos do mês (todos os indicadores do setor); null = nenhum indicador com resultado lançado ainda. */
  pontos: number | null
  /** % de EBITDA (AVR) do mês — só exibido/usado como critério de desempate, sem meta. */
  ebitdaAvr: number | null
  rank: number | null
}

interface RankingTabelaPontosProps {
  linhas: RankingLinhaPontos[]
  nomesUnidade: Map<string, string>
  titulo: string
  subtitulo?: string
}

/**
 * Ranking de pontuação da Reunião Resultados — mesmo modelo de pódio/tabela
 * dos demais rankings. Sem meta cadastrada (pontuação é sempre relativa entre
 * unidades), então o corte verde/vermelho do pódio usa a média do período,
 * igual ao fallback de `RankingTabelaAderencia`. O EBITDA aparece como coluna
 * e como detalhe no pódio pra deixar visível o critério de desempate.
 */
export function RankingTabelaPontos({ linhas, nomesUnidade, titulo, subtitulo }: RankingTabelaPontosProps) {
  const [modoPodio, setModoPodio] = useState(false)
  const { ref, status, copiar } = useCopiarComoImagem(titulo)

  const validos = linhas.filter((l): l is RankingLinhaPontos & { pontos: number } => l.pontos !== null)
  const media = validos.length > 0 ? validos.reduce((acc, l) => acc + l.pontos, 0) / validos.length : null

  const itensPodio: PodioItem[] = linhas.map(l => ({
    chave: l.unidade,
    nome: nomesUnidade.get(l.unidade) ?? l.unidade,
    rank: l.rank,
    valorFmt: l.pontos === null ? '—' : `${l.pontos} pts`,
    positivo: l.pontos !== null && media !== null && l.pontos >= media,
    detalhe: l.ebitdaAvr === null ? undefined : (
      <span className="text-muted-foreground">EBITDA {formatPercent(l.ebitdaAvr, 1)}</span>
    ),
  }))

  return (
    <TableCard
      ref={ref}
      titulo={titulo}
      subtitulo={subtitulo}
      acoes={<AcoesRanking modoPodio={modoPodio} onTogglePodio={() => setModoPodio(v => !v)} status={status} onCopiar={copiar} />}
    >
      {linhas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Sem dados para este período.</p>
      ) : modoPodio ? (
        <PodioView itens={itensPodio} tituloPositivo="Acima da média" tituloNegativo="Abaixo da média" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-center">Pontos</TableHead>
              <TableHead className="text-center">EBITDA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(l => {
              const cor: 'positivo' | 'negativo' | 'semCor' = l.pontos === null || media === null
                ? 'semCor'
                : l.pontos >= media ? 'positivo' : 'negativo'
              return (
                <TableRow key={l.unidade} className={cn(linhaBorda, BG[cor])}>
                  <TableCell>
                    <RankBadge rank={l.rank} />
                  </TableCell>
                  <TableCell className="text-sm">{nomesUnidade.get(l.unidade) ?? l.unidade}</TableCell>
                  <TableCell className={cn('text-center text-sm font-semibold tabular-nums', TEXTO[cor])}>
                    {l.pontos === null ? '—' : l.pontos}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                    {l.ebitdaAvr === null ? '—' : formatPercent(l.ebitdaAvr, 1)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </TableCard>
  )
}

// ─── Aderência (Rotinas Financeiras: % OK/(OK+NOK), sem meta) ───────────────

export interface RankingLinhaAderencia {
  unidade: string
  /** % de aderência (OK / (OK+NOK)); null = sem rotina respondida no período. */
  percentual: number | null
  rank: number | null
}

interface RankingTabelaAderenciaProps {
  linhas: RankingLinhaAderencia[]
  nomesUnidade: Map<string, string>
  titulo: string
  subtitulo?: string
  /** Meta (%) registrada em Metas > Financeiro > Metas de Resultado — quando informada, o corte verde/vermelho é vs essa meta; sem ela, cai pra acima/abaixo da média do período. */
  meta?: number | null
}

/**
 * Ranking de % de aderência (Rotinas Financeiras) — mesmo modelo de
 * pódio/tabela do Ranking. O corte verde/vermelho do pódio (4º lugar em
 * diante) e da tabela usa a meta cadastrada quando existe; sem meta, cai
 * pra acima/abaixo da média do período (fallback, pra continuar reutilizável
 * em rankings sem meta registrada).
 */
export function RankingTabelaAderencia({ linhas, nomesUnidade, titulo, subtitulo, meta = null }: RankingTabelaAderenciaProps) {
  const [modoPodio, setModoPodio] = useState(false)
  const { ref, status, copiar } = useCopiarComoImagem(titulo)

  const validos = linhas.filter((l): l is RankingLinhaAderencia & { percentual: number } => l.percentual !== null)
  const media = validos.length > 0 ? validos.reduce((acc, l) => acc + l.percentual, 0) / validos.length : null
  const corte = meta ?? media

  const itensPodio: PodioItem[] = linhas.map(l => ({
    chave: l.unidade,
    nome: nomesUnidade.get(l.unidade) ?? l.unidade,
    rank: l.rank,
    valorFmt: l.percentual === null ? '—' : formatPercent(l.percentual, 1),
    positivo: l.percentual !== null && corte !== null && l.percentual >= corte,
  }))

  return (
    <TableCard
      ref={ref}
      titulo={titulo}
      subtitulo={subtitulo}
      acoes={<AcoesRanking modoPodio={modoPodio} onTogglePodio={() => setModoPodio(v => !v)} status={status} onCopiar={copiar} />}
    >
      {linhas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Sem dados para este período.</p>
      ) : modoPodio ? (
        <PodioView
          itens={itensPodio}
          tituloPositivo={meta !== null ? 'Meta batida' : 'Acima da média'}
          tituloNegativo={meta !== null ? 'Abaixo da meta' : 'Abaixo da média'}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-center">Aderência</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(l => {
              const cor: 'positivo' | 'negativo' | 'semCor' = l.percentual === null || corte === null
                ? 'semCor'
                : l.percentual >= corte ? 'positivo' : 'negativo'
              return (
                <TableRow key={l.unidade} className={cn(linhaBorda, BG[cor])}>
                  <TableCell>
                    <RankBadge rank={l.rank} />
                  </TableCell>
                  <TableCell className="text-sm">{nomesUnidade.get(l.unidade) ?? l.unidade}</TableCell>
                  <TableCell className={cn('text-center text-sm font-semibold tabular-nums', TEXTO[cor])}>
                    {l.percentual === null ? '—' : formatPercent(l.percentual, 1)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </TableCard>
  )
}
