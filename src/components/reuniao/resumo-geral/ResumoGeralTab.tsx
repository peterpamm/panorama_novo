import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { cn } from '@/lib/utils'
import { atribuirRankComDesempate, type ReuniaoParticipavel } from '@/lib/reuniao-resultados'
import { RankingTabelaPontos, type RankingLinhaPontos } from '@/components/ranking/RankingTabelas'
import { MESES_NOMES, ANOS_RESUMO_GERAL } from '@/pages/reuniao/ReuniaoResumoGeralPage'
import { deltaFarolPacoteUnidadeMes } from '@/hooks/useReuniaoDados'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import type { ResumoMesUnidade } from '@/lib/resumo-geral-calculations'
import type { ResumoGeralAmbevSetor } from '@/types'

const COLUNAS_AMBEV: { setor: ResumoGeralAmbevSetor; label: string }[] = [
  { setor: 'gente', label: 'Ambev Gente' },
  { setor: 'frota', label: 'Ambev Frota' },
  { setor: 'seguranca', label: 'Ambev Segurança' },
]

interface ResumoGeralTabProps {
  ano: string
  setAno: (v: string) => void
  mes: string
  setMes: (v: string) => void
  linhas: ReuniaoParticipavel[]
  resumoPorLinhaMes: Record<string, ResumoMesUnidade>
  carregando: boolean
  salvarPosicaoAmbev: (unidade: string, negocio: string, mes: number, setor: ResumoGeralAmbevSetor, posicao: number | null) => Promise<void>
}

/** Resumo Geral: tabela consolidada (Etapas 1-3) — pontuação dos 6 setores + bonificações + colocação, com input inline pra lançar a posição em cada um dos 3 Rankings Ambev (Gente/Frota/Segurança). */
export function ResumoGeralTab({ ano, setAno, mes, setMes, linhas, resumoPorLinhaMes, carregando, salvarPosicaoAmbev }: ResumoGeralTabProps) {
  const mesNum = Number(mes)
  const [edicoes, setEdicoes] = useState<Record<string, string>>({})
  const [salvandoChave, setSalvandoChave] = useState<string | null>(null)
  const { rows: rowsDre } = useDreLongoTodasUnidades()
  const { orcamentos } = useOrcamentoTodasUnidades()

  const linhasComResumo = useMemo(() => {
    return linhas
      .map(l => ({ linha: l, resumo: resumoPorLinhaMes[`${l.unidade}|${l.negocio}|${mesNum}`] }))
      .filter((l): l is { linha: ReuniaoParticipavel; resumo: ResumoMesUnidade } => l.resumo !== undefined)
  }, [linhas, resumoPorLinhaMes, mesNum])

  const chaveLinha = (l: ReuniaoParticipavel) => `${l.unidade}|${l.negocio}`

  // Desempate por melhor delta de EBITDA vs meta (mesma régua do Ranking de
  // EBITDA) — é o "Ranking Geral" que sai na reunião mensal, então o critério
  // de desempate importa de verdade quando duas unidades empatam em pontos.
  const ranking = useMemo(() => {
    const base = linhasComResumo.map(l => ({
      unidade: chaveLinha(l.linha),
      pontos: l.resumo.pontuacaoFinal,
      ebitdaDelta: deltaFarolPacoteUnidadeMes(rowsDre, orcamentos, '233', l.linha.unidade, Number(ano), mesNum, l.linha.negocio),
      rank: null as number | null,
    }))
    return atribuirRankComDesempate(base, l => l.pontos, l => l.ebitdaDelta)
  }, [linhasComResumo, rowsDre, orcamentos, ano, mesNum])
  const rankPorLinha = useMemo(() => new Map(ranking.map(r => [r.unidade, r.rank])), [ranking])
  const nomesLinha = useMemo(() => new Map(linhas.map(l => [chaveLinha(l), l.nome])), [linhas])

  const liderDoMes = ranking.find(r => r.rank === 1)

  async function salvarPosicao(unidade: string, negocio: string, setor: ResumoGeralAmbevSetor) {
    const chave = `${unidade}|${negocio}|${setor}`
    const texto = (edicoes[chave] ?? '').trim()
    const posicao = texto === '' ? null : Number(texto)
    if (posicao !== null && (Number.isNaN(posicao) || posicao <= 0)) return
    setSalvandoChave(chave)
    await salvarPosicaoAmbev(unidade, negocio, mesNum, setor, posicao)
    setSalvandoChave(null)
    setEdicoes(prev => { const novo = { ...prev }; delete novo[chave]; return novo })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS_RESUMO_GERAL.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
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
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Unidades participantes</div>
              <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">{linhasComResumo.length}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Líder do mês</div>
              <div className="mt-1 truncate text-lg font-semibold text-foreground">
                {liderDoMes ? (nomesLinha.get(liderDoMes.unidade) ?? liderDoMes.unidade) : '—'}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Pontuação do líder</div>
              <div className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {liderDoMes ? `${liderDoMes.pontos} pts` : '—'}
              </div>
            </Card>
          </div>

          <TableCard
            titulo="Consolidado das Unidades"
            subtitulo={`${MESES_NOMES[mesNum - 1]}/${ano} · pontuação dos 6 setores + bonificações (EBITDA batido: +50 · cada Ranking Ambev: 1º +50, 2º-5º +30)`}
          >
            {linhasComResumo.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma unidade com pontuação lançada nesse mês.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">#</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-center">Pontuação Setores</TableHead>
                      <TableHead className="text-center">EBITDA</TableHead>
                      {COLUNAS_AMBEV.map(c => <TableHead key={c.setor} className="text-center">{c.label}</TableHead>)}
                      <TableHead className="text-center">Bonificações</TableHead>
                      <TableHead className="text-center">Pontuação Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhasComResumo.map(({ linha, resumo }) => (
                      <TableRow key={chaveLinha(linha)} className="border-gray-200/30 dark:border-gray-700/30">
                        <TableCell className="text-sm text-muted-foreground">{rankPorLinha.get(chaveLinha(linha)) ?? '—'}º</TableCell>
                        <TableCell className="text-sm font-medium">{linha.nome}</TableCell>
                        <TableCell className="text-center text-sm tabular-nums">{resumo.pontuacaoSetores}</TableCell>
                        <TableCell className="text-center text-sm">
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                            resumo.ebitdaOk ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
                          )}>
                            {resumo.ebitdaOk ? 'Bateu (+50)' : 'Não bateu'}
                          </span>
                        </TableCell>
                        {COLUNAS_AMBEV.map(({ setor }) => {
                          const chave = `${linha.unidade}|${linha.negocio}|${setor}`
                          return (
                            <TableCell key={setor} className="text-center">
                              <Input
                                className="mx-auto w-16 text-center"
                                inputMode="numeric"
                                placeholder="—"
                                value={edicoes[chave] ?? (resumo.posicoesAmbev[setor] !== null ? String(resumo.posicoesAmbev[setor]) : '')}
                                onChange={e => setEdicoes(prev => ({ ...prev, [chave]: e.target.value }))}
                                onBlur={() => salvarPosicao(linha.unidade, linha.negocio, setor)}
                                disabled={salvandoChave === chave}
                              />
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-center text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {resumo.pontosExtras > 0 ? `+${resumo.pontosExtras}` : resumo.pontosExtras}
                        </TableCell>
                        <TableCell className="text-center text-sm font-bold tabular-nums">{resumo.pontuacaoFinal}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TableCard>

          <div className="mx-auto max-w-2xl">
            <RankingTabelaPontos
              linhas={ranking as RankingLinhaPontos[]}
              nomesUnidade={nomesLinha}
              titulo="Ranking Geral"
              subtitulo={`${MESES_NOMES[mesNum - 1]}/${ano} · critério de desempate: Δ EBITDA`}
            />
          </div>
        </>
      )}
    </div>
  )
}
