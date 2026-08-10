import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { cn } from '@/lib/utils'
import { atribuirRankComDesempate, type ReuniaoParticipavel } from '@/lib/reuniao-resultados'
import { somarAcumuladoAnual, totalHistoricoSetores } from '@/lib/resumo-geral-calculations'
import { MESES_NOMES, ANOS_RESUMO_GERAL } from '@/pages/reuniao/ReuniaoResumoGeralPage'
import type { ResumoMesUnidade } from '@/lib/resumo-geral-calculations'
import type { ResumoGeralHistorico } from '@/types'

interface RankingAnualTabProps {
  ano: string
  setAno: (v: string) => void
  linhas: ReuniaoParticipavel[]
  resumoPorLinhaMes: Record<string, ResumoMesUnidade>
  historicoDoAno: (unidade: string) => ResumoGeralHistorico | null
  carregando: boolean
}

/**
 * Ranking Anual (Etapa 6): soma o acumulado do ano — quando existe
 * histórico importado (Etapa 7), começa dele (já cobre até o mês de corte)
 * e soma só os meses ao vivo depois desse corte; sem histórico, soma os 12
 * meses ao vivo normalmente (ver `somarAcumuladoAnual`). Define o vencedor
 * do troféu anual.
 */
export function RankingAnualTab({ ano, setAno, linhas, resumoPorLinhaMes, historicoDoAno, carregando }: RankingAnualTabProps) {
  const anuais = useMemo(() => {
    const base = linhas.map(l => {
      const historico = historicoDoAno(l.unidade)
      const pontos = somarAcumuladoAnual(
        mes => resumoPorLinhaMes[`${l.unidade}|${l.negocio}|${mes}`]?.pontuacaoFinal ?? null,
        historico ? { mesFinal: historico.mes_final, pontuacaoAcumulada: totalHistoricoSetores(historico) } : null,
      )
      const extras = Array.from({ length: 12 }, (_, i) => i + 1)
        .reduce((acc, mes) => acc + (resumoPorLinhaMes[`${l.unidade}|${l.negocio}|${mes}`]?.pontosExtras ?? 0), 0)
      return { linha: l, historico, pontos, extras, rank: null as number | null }
    })
    return atribuirRankComDesempate(base, l => l.pontos, l => l.extras)
  }, [linhas, resumoPorLinhaMes, historicoDoAno])

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Ano</Label>
        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ANOS_RESUMO_GERAL.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : (
        <TableCard titulo="Ranking Anual" subtitulo={`${ano} — acumulado do ano, define o vencedor do troféu anual`}>
          {anuais.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Sem dados pra {ano}.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">#</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-center">Pontuação Acumulada</TableHead>
                  <TableHead className="text-center">Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anuais.map(l => (
                  <TableRow key={`${l.linha.unidade}|${l.linha.negocio}`} className={cn('border-gray-200/30 dark:border-gray-700/30', l.rank === 1 && 'bg-amber-500/10')}>
                    <TableCell className="text-sm font-semibold text-muted-foreground">{l.rank ?? '—'}º</TableCell>
                    <TableCell className="text-sm font-medium">{l.linha.nome}</TableCell>
                    <TableCell className="text-center text-sm font-bold tabular-nums">{l.pontos ?? '—'}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {l.historico ? `Histórico até ${MESES_NOMES[l.historico.mes_final - 1]} + ao vivo` : 'Ao vivo (ano todo)'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}
    </div>
  )
}
