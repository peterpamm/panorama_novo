import { useMemo, useState } from 'react'
import { Loader2, Trophy } from 'lucide-react'
import { useReuniaoDados, valorFarolPacoteUnidadeMes } from '@/hooks/useReuniaoDados'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { atribuirRankComDesempate, calcularPontosGanhos, resolverNaturezaFormato } from '@/lib/reuniao-resultados'
import { RankingTabelaPontos, type RankingLinhaPontos } from '@/components/ranking/RankingTabelas'
import { mesAnterior } from '@/lib/rotinas-financeiras'
import type { ReuniaoSetor } from '@/types'

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ANOS = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

// Default = mês anterior ao atual (a reunião sempre olha pra trás pro resultado que acabou de fechar).
const DEFAULT = mesAnterior(new Date().getFullYear(), new Date().getMonth() + 1)

interface ResultadoMesReuniaoTabProps {
  setor: ReuniaoSetor
}

export function ResultadoMesReuniaoTab({ setor }: ResultadoMesReuniaoTabProps) {
  const [ano, setAno] = useState(String(DEFAULT.ano))
  const [mes, setMes] = useState(String(DEFAULT.mes))
  const mesNum = Number(mes)

  const {
    carregando, indicadores, participantesPorIndicador,
    resultadoEMeta, unidadesDoTotal, totalPorUnidadeMes, maiorPorMes, nomesUnidades, rowsDre,
  } = useReuniaoDados(setor, ano)

  const nomesUnidadeMap = useMemo(() => new Map(Object.entries(nomesUnidades)), [nomesUnidades])

  const linhasRanking = useMemo<RankingLinhaPontos[]>(() => {
    const base = unidadesDoTotal.map(unidade => ({
      unidade,
      pontos: totalPorUnidadeMes[`${unidade}|${mesNum}`] ?? null,
      ebitdaAvr: valorFarolPacoteUnidadeMes(rowsDre, '232', unidade, Number(ano), mesNum),
      rank: null as number | null,
    }))
    return atribuirRankComDesempate(base, l => l.pontos, l => l.ebitdaAvr)
  }, [unidadesDoTotal, totalPorUnidadeMes, rowsDre, ano, mesNum])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : indicadores.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhum indicador ativo cadastrado pra {ano} — cadastre na aba Cadastro.</p>
      ) : (
        <>
          <TableCard
            titulo="Resultado por Indicador"
            subtitulo={`${MESES_NOMES[mesNum - 1]}/${ano} — pontuação de cada unidade em cada indicador`}
          >
            {unidadesDoTotal.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma unidade participando de indicador algum — configure em Cadastro &gt; Participantes.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-[160px] bg-inherit">Unidade</TableHead>
                    {indicadores.map(ind => (
                      <TableHead key={ind.id} className="min-w-[140px] text-center">{ind.nome}</TableHead>
                    ))}
                    <TableHead className="min-w-[120px] border-l-2 border-primary/30 bg-primary/10 text-center font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unidadesDoTotal.map(unidadeCodigo => {
                    const total = totalPorUnidadeMes[`${unidadeCodigo}|${mesNum}`] ?? null
                    const ehMelhor = total !== null && total === maiorPorMes[mesNum] && total > 0
                    return (
                      <TableRow key={unidadeCodigo}>
                        <TableCell className="sticky left-0 z-10 bg-inherit text-sm font-medium">{nomesUnidades[unidadeCodigo] ?? unidadeCodigo}</TableCell>
                        {indicadores.map(ind => {
                          const participa = (participantesPorIndicador[ind.id] ?? []).includes(unidadeCodigo)
                          if (!participa) {
                            return <TableCell key={ind.id} className="text-center text-sm text-muted-foreground">—</TableCell>
                          }
                          const { resultado, meta } = resultadoEMeta(ind, unidadeCodigo, mesNum)
                          const { natureza } = resolverNaturezaFormato(ind)
                          const pontos = calcularPontosGanhos(resultado, meta, natureza, ind.pontos)
                          return (
                            <TableCell key={ind.id} className="text-center text-sm">
                              {pontos === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span className={cn(
                                  'font-semibold tabular-nums',
                                  pontos > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                                )}>
                                  {pontos} pts
                                </span>
                              )}
                            </TableCell>
                          )
                        })}
                        <TableCell className={cn(
                          'border-l-2 border-primary/30 bg-primary/10 text-center text-sm font-bold tabular-nums',
                          total === null && 'font-normal text-muted-foreground',
                        )}>
                          {ehMelhor && <Trophy className="mr-1 inline h-3.5 w-3.5 text-amber-500" />}
                          {total === null ? '—' : total}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </TableCard>

          <div className="mx-auto max-w-2xl">
            <RankingTabelaPontos
              linhas={linhasRanking}
              nomesUnidade={nomesUnidadeMap}
              titulo="Ranking do Mês"
              subtitulo={`${MESES_NOMES[mesNum - 1]}/${ano} — total de pontos · desempate: melhor % de EBITDA`}
            />
          </div>
        </>
      )}
    </div>
  )
}
