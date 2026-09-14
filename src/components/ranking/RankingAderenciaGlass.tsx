import { useState } from 'react'
import { Camera, Check, Table2, Trophy } from 'lucide-react'
import { useCopiarComoImagem } from '@/hooks/useCopiarComoImagem'
import { useLogosUnidades } from '@/hooks/useLogosUnidades'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard, tableCardActionClass } from '@/components/ui/table-card'
import { Button } from '@/components/ui/button'
import { cn, formatPercent } from '@/lib/utils'
import type { RankingLinhaAderencia } from '@/components/ranking/RankingTabelas'

/**
 * Variante "glass" do Modo Pódio, só pra Rotinas Financeiras (Área
 * Financeira > Rotinas) — teste isolado antes de virar padrão do projeto
 * (ver `RankingTabelas.tsx` pro Modo Pódio "oficial", usado em todo o resto
 * do app). Três diferenças de propósito, todas pedidas pelo usuário:
 *
 * 1. Fundo glass (blur + translúcido) e barrinha de progresso ao lado de
 *    cada % na lista, ao estilo do mockup de referência.
 * 2. Do 4º lugar em diante, as unidades não separam mais em "bateu"/"não
 *    bateu" — vira uma lista só, dividida em 2 colunas por QUANTIDADE (metade
 *    em cada), e o que sinaliza se bateu a meta é só a cor da fonte/barra de
 *    cada linha.
 * 3. Empate de verdade no pódio: Rotinas não tem critério de desempate (ao
 *    contrário do Ranking Geral, que usa Δ EBITDA) — então unidades com o
 *    MESMO % compartilham a mesma posição, mostrando os logos um sobrepondo
 *    a borda do outro (só nesse caso os logos ganham moldura circular branca,
 *    pra sobreposição ficar legível — um logo sozinho continua grande e sem
 *    moldura, igual ao Modo Pódio padrão).
 */

export interface GrupoAderencia {
  /** Posição no pódio/lista — unidades empatadas dividem a mesma posição. */
  posicao: number
  /** NaN pro grupo "sem resultado" (não entra em pódio, só aparece na lista com "—"). */
  valor: number
  itens: RankingLinhaAderencia[]
}

/** Agrupa por % idêntico (empate de verdade) e ordena do maior pro menor — cada grupo é uma "posição" no ranking. */
export function agruparPorValor(linhas: RankingLinhaAderencia[]): { grupos: GrupoAderencia[]; semValor: RankingLinhaAderencia[] } {
  const validos = linhas.filter((l): l is RankingLinhaAderencia & { percentual: number } => l.percentual !== null)
  const semValor = linhas.filter(l => l.percentual === null)
  const porValor = new Map<number, RankingLinhaAderencia[]>()
  for (const l of validos) {
    const arr = porValor.get(l.percentual) ?? []
    arr.push(l)
    porValor.set(l.percentual, arr)
  }
  const grupos = Array.from(porValor.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([valor, itens], i) => ({ posicao: i + 1, valor, itens }))
  return { grupos, semValor }
}

/** Distribui os grupos (do 4º lugar em diante) em 2 colunas por quantidade de UNIDADES, sem separar um grupo empatado entre as colunas. */
export function distribuirColunas(grupos: GrupoAderencia[]): { esquerda: GrupoAderencia[]; direita: GrupoAderencia[] } {
  const total = grupos.reduce((acc, g) => acc + g.itens.length, 0)
  const metade = Math.ceil(total / 2)
  const esquerda: GrupoAderencia[] = []
  const direita: GrupoAderencia[] = []
  let acumulado = 0
  for (const g of grupos) {
    if (acumulado < metade) { esquerda.push(g); acumulado += g.itens.length }
    else direita.push(g)
  }
  return { esquerda, direita }
}

const MEDALHA = {
  1: { anel: 'ring-yellow-400', badge: 'bg-yellow-400 text-yellow-950', barra: 'bg-yellow-400', tamanhoLogo: 'h-32 w-32', larguraBase: 'w-32' },
  2: { anel: 'ring-slate-300', badge: 'bg-slate-300 text-slate-900', barra: 'bg-slate-300', tamanhoLogo: 'h-28 w-28', larguraBase: 'w-28' },
  3: { anel: 'ring-orange-400', badge: 'bg-orange-400 text-orange-950', barra: 'bg-orange-400', tamanhoLogo: 'h-24 w-24', larguraBase: 'w-24' },
} as const

/** Logo (ou inicial) de uma unidade no pódio — com moldura circular só quando faz parte de um grupo empatado (pra sobreposição ficar legível), senão grande e sem moldura. */
function LogoPodioGlass({ nome, logoUrl, tamanho, comMoldura, anelClasse }: {
  nome: string
  logoUrl?: string | null
  tamanho: string
  comMoldura: boolean
  anelClasse: string
}) {
  const [quebrado, setQuebrado] = useState(false)
  if (logoUrl && !quebrado) {
    return (
      <img
        src={logoUrl}
        alt={nome}
        className={cn(
          tamanho,
          comMoldura
            ? 'rounded-full border-4 border-white object-cover shadow-lg dark:border-slate-900'
            : 'object-contain drop-shadow-md',
        )}
        onError={() => setQuebrado(true)}
      />
    )
  }
  return (
    <div className={cn(tamanho, 'flex items-center justify-center rounded-full bg-white shadow-lg ring-4 dark:bg-slate-800', anelClasse)}>
      <span className="text-2xl font-black text-gray-700 dark:text-gray-200">{nome[0] ?? '?'}</span>
    </div>
  )
}

function ColunaPodioGlass({ grupo, posicao, nomesUnidade, logos }: {
  grupo: GrupoAderencia
  posicao: 1 | 2 | 3
  nomesUnidade: Map<string, string>
  logos: Map<string, string>
}) {
  const estilo = MEDALHA[posicao]
  const empatado = grupo.itens.length > 1
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <span className={cn('rounded-full px-3 py-1 text-xs font-black shadow', estilo.badge)}>{grupo.posicao}º</span>

      {empatado ? (
        <div className="flex items-center justify-center">
          {grupo.itens.map((item, i) => (
            <div key={item.unidade} className={i > 0 ? '-ml-7' : ''} style={{ zIndex: grupo.itens.length - i }}>
              <LogoPodioGlass
                nome={nomesUnidade.get(item.unidade) ?? item.unidade}
                logoUrl={logos.get(item.unidade)}
                tamanho="h-20 w-20"
                comMoldura
                anelClasse={estilo.anel}
              />
            </div>
          ))}
        </div>
      ) : (
        <LogoPodioGlass
          nome={nomesUnidade.get(grupo.itens[0].unidade) ?? grupo.itens[0].unidade}
          logoUrl={logos.get(grupo.itens[0].unidade)}
          tamanho={estilo.tamanhoLogo}
          comMoldura={false}
          anelClasse={estilo.anel}
        />
      )}

      <div className="text-center">
        <div className="max-w-[180px] truncate text-sm font-semibold text-gray-900 dark:text-white">
          {grupo.itens.map(i => nomesUnidade.get(i.unidade) ?? i.unidade).join(' & ')}
        </div>
        <div className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">{formatPercent(grupo.valor, 1)}</div>
      </div>

      {/* Base do pódio — só uma faixa fina (altura reduzida de propósito, o destaque agora é o logo) */}
      <div className={cn('h-2 rounded-full', estilo.larguraBase, estilo.barra)} />
    </div>
  )
}

function LinhaListaGlass({ grupo, nomesUnidade, corte }: {
  grupo: GrupoAderencia
  nomesUnidade: Map<string, string>
  corte: number | null
}) {
  const semDado = Number.isNaN(grupo.valor)
  const positivo = semDado || corte === null ? null : grupo.valor >= corte
  return (
    <div className="flex items-center justify-between gap-2 border-b border-black/5 py-2 text-sm last:border-0 dark:border-white/10">
      <div className="flex min-w-0 items-center gap-2">
        <span className="w-7 shrink-0 text-xs font-semibold text-muted-foreground">{semDado ? '—' : `${grupo.posicao}º`}</span>
        <span className="truncate font-medium text-gray-800 dark:text-gray-200">
          {grupo.itens.map(i => nomesUnidade.get(i.unidade) ?? i.unidade).join(' & ')}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={cn(
          'font-black tabular-nums',
          positivo === null ? 'text-muted-foreground' : positivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
        )}>
          {semDado ? '—' : formatPercent(grupo.valor, 1)}
        </span>
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          {!semDado && (
            <div
              className={cn('h-full rounded-full', positivo ? 'bg-emerald-500' : 'bg-red-500')}
              style={{ width: `${Math.min(100, Math.max(0, grupo.valor))}%` }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function PodioGlassView({ linhas, nomesUnidade, corte }: {
  linhas: RankingLinhaAderencia[]
  nomesUnidade: Map<string, string>
  corte: number | null
}) {
  const logos = useLogosUnidades()
  const { grupos, semValor } = agruparPorValor(linhas)
  const top3 = grupos.slice(0, 3)
  const resto = grupos.slice(3)
  const semValorGrupo: GrupoAderencia | null = semValor.length > 0 ? { posicao: -1, valor: NaN, itens: semValor } : null
  const { esquerda, direita } = distribuirColunas(semValorGrupo ? [...resto, semValorGrupo] : resto)

  const ordem = ([2, 1, 3] as const).map(pos => ({ pos, grupo: top3[pos - 1] }))

  return (
    <div className="space-y-6 rounded-2xl border border-white/40 bg-gradient-to-br from-white/70 to-white/30 p-6 shadow-xl backdrop-blur-xl dark:border-white/10 dark:from-slate-800/50 dark:to-slate-900/30">
      <div className="mx-auto flex max-w-xl items-end justify-center gap-6">
        {ordem.map(({ pos, grupo }) => grupo
          ? <ColunaPodioGlass key={pos} posicao={pos} grupo={grupo} nomesUnidade={nomesUnidade} logos={logos} />
          : <div key={pos} className="w-full" />)}
      </div>

      {(esquerda.length > 0 || direita.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-black/5 bg-white/40 p-3 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
            {esquerda.map(g => <LinhaListaGlass key={g.posicao === -1 ? 'sem-dado-esq' : g.posicao} grupo={g} nomesUnidade={nomesUnidade} corte={corte} />)}
          </div>
          <div className="rounded-xl border border-black/5 bg-white/40 p-3 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
            {direita.map(g => <LinhaListaGlass key={g.posicao === -1 ? 'sem-dado-dir' : g.posicao} grupo={g} nomesUnidade={nomesUnidade} corte={corte} />)}
          </div>
        </div>
      )}
    </div>
  )
}

interface RankingAderenciaGlassProps {
  linhas: RankingLinhaAderencia[]
  nomesUnidade: Map<string, string>
  titulo: string
  subtitulo?: string
  meta?: number | null
}

/** Mesmo contrato de `RankingTabelaAderencia` — troca só a visão de Pódio pela variante glass (ver comentário do arquivo). */
export function RankingAderenciaGlass({ linhas, nomesUnidade, titulo, subtitulo, meta = null }: RankingAderenciaGlassProps) {
  const [modoPodio, setModoPodio] = useState(false)
  const { ref, status, copiar } = useCopiarComoImagem(titulo)

  const validos = linhas.filter((l): l is RankingLinhaAderencia & { percentual: number } => l.percentual !== null)
  const media = validos.length > 0 ? validos.reduce((acc, l) => acc + l.percentual, 0) / validos.length : null
  const corte = meta ?? media

  return (
    <TableCard
      ref={ref}
      titulo={titulo}
      subtitulo={subtitulo}
      acoes={
        <>
          <Button
            variant="outline"
            size="sm"
            className={cn('gap-2', tableCardActionClass)}
            onClick={copiar}
            disabled={status === 'copiando'}
            title="Copiar o card como imagem (inclui o título)"
          >
            {status === 'copiado' ? <Check className="h-4 w-4 text-emerald-400" /> : <Camera className="h-4 w-4" />}
            {status === 'copiado' ? 'Copiado!' : status === 'copiando' ? 'Gerando...' : 'Copiar imagem'}
          </Button>
          <Button variant="outline" size="sm" className={cn('gap-2', tableCardActionClass)} onClick={() => setModoPodio(v => !v)}>
            {modoPodio ? <Table2 className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
            {modoPodio ? 'Tabela' : 'Modo Pódio'}
          </Button>
        </>
      }
    >
      {linhas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Sem dados para este período.</p>
      ) : modoPodio ? (
        <div className="p-4">
          <PodioGlassView linhas={linhas} nomesUnidade={nomesUnidade} corte={corte} />
        </div>
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
              const texto = cor === 'positivo' ? 'text-emerald-600 dark:text-emerald-400' : cor === 'negativo' ? 'text-red-600 dark:text-red-400' : ''
              const fundo = cor === 'positivo'
                ? 'bg-gradient-to-r from-emerald-500/25 via-emerald-500/10 to-transparent'
                : cor === 'negativo'
                  ? 'bg-gradient-to-r from-red-500/25 via-red-500/10 to-transparent'
                  : ''
              return (
                <TableRow key={l.unidade} className={cn('border-gray-200/30 dark:border-gray-700/30', fundo)}>
                  <TableCell>
                    {l.rank === null ? <span className="text-sm text-muted-foreground">—</span> : <span className="text-sm text-muted-foreground">{l.rank}</span>}
                  </TableCell>
                  <TableCell className="text-sm">{nomesUnidade.get(l.unidade) ?? l.unidade}</TableCell>
                  <TableCell className={cn('text-center text-sm font-semibold tabular-nums', texto)}>
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
