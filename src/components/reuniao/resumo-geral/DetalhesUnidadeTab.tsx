import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { cn } from '@/lib/utils'
import { atribuirRankComDesempate, type ReuniaoParticipavel } from '@/lib/reuniao-resultados'
import { MESES_NOMES, ANOS_RESUMO_GERAL, type SetorConsolidado } from '@/pages/reuniao/ReuniaoResumoGeralPage'
import { deltaFarolPacoteUnidadeMes } from '@/hooks/useReuniaoDados'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import type { ResumoMesUnidade } from '@/lib/resumo-geral-calculations'

const LABEL_AMBEV = { gente: 'Ranking Ambev — Gente', frota: 'Ranking Ambev — Frota', seguranca: 'Ranking Ambev — Segurança' } as const

interface DetalhesUnidadeTabProps {
  ano: string
  setAno: (v: string) => void
  mes: string
  setMes: (v: string) => void
  linhas: ReuniaoParticipavel[]
  setores: SetorConsolidado[]
  resumoPorLinhaMes: Record<string, ResumoMesUnidade>
  carregando: boolean
  /** false quando um usuário de unidade acessa essa aba direto (fora do admin) — a colocação é surpresa até a reunião mensal com todo mundo, não pode vazar aqui antes. Default true (visão do admin). */
  mostrarColocacao?: boolean
}

/** Detalhes da Unidade (Etapa 5): pontuação por setor, bonificações com motivo, total geral e colocação no Ranking Geral do mês. */
export function DetalhesUnidadeTab({ ano, setAno, mes, setMes, linhas, setores, resumoPorLinhaMes, carregando, mostrarColocacao = true }: DetalhesUnidadeTabProps) {
  const mesNum = Number(mes)
  const { rows: rowsDre } = useDreLongoTodasUnidades()
  const { orcamentos } = useOrcamentoTodasUnidades()
  const [chaveSel, setChaveSel] = useState('')
  useEffect(() => {
    if (!chaveSel && linhas.length > 0) setChaveSel(`${linhas[0].unidade}|${linhas[0].negocio}`)
  }, [linhas, chaveSel])

  const linhaSel = linhas.find(l => `${l.unidade}|${l.negocio}` === chaveSel)
  const resumo = linhaSel ? resumoPorLinhaMes[`${linhaSel.unidade}|${linhaSel.negocio}|${mesNum}`] : undefined

  const porSetor = useMemo(() => {
    if (!linhaSel) return []
    return setores.map(s => {
      const negocioBusca = s.setor === 'financeiro' ? 'CONS' : linhaSel.negocio
      const pontos = s.totalPorUnidadeMes[`${linhaSel.unidade}|${negocioBusca}|${mesNum}`] ?? 0
      return { label: s.label, pontos }
    })
  }, [setores, linhaSel, mesNum])

  // Mesmo critério de desempate do "Ranking Geral" (ResumoGeralTab): melhor
  // delta de EBITDA vs meta, não o % puro — os dois ranqueiam a mesma
  // pontuação final, então precisam bater.
  const colocacao = useMemo(() => {
    const base = linhas.map(l => ({
      unidade: `${l.unidade}|${l.negocio}`,
      pontos: resumoPorLinhaMes[`${l.unidade}|${l.negocio}|${mesNum}`]?.pontuacaoFinal ?? null,
      ebitdaDelta: deltaFarolPacoteUnidadeMes(rowsDre, orcamentos, '233', l.unidade, Number(ano), mesNum, l.negocio),
      rank: null as number | null,
    }))
    const ranking = atribuirRankComDesempate(base, l => l.pontos, l => l.ebitdaDelta)
    return ranking.find(r => r.unidade === chaveSel)?.rank ?? null
  }, [linhas, resumoPorLinhaMes, rowsDre, orcamentos, ano, mesNum, chaveSel])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Unidade</Label>
          <Select value={chaveSel} onValueChange={setChaveSel}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {linhas.map(l => <SelectItem key={`${l.unidade}|${l.negocio}`} value={`${l.unidade}|${l.negocio}`}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
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
      ) : !resumo || !linhaSel ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Sem dados pra essa unidade nesse mês.</p>
      ) : (
        <>
          <div className={cn('grid grid-cols-2 gap-3', mostrarColocacao ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Pontuação Setores</div>
              <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">{resumo.pontuacaoSetores}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Bonificações</div>
              <div className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {resumo.pontosExtras > 0 ? `+${resumo.pontosExtras}` : resumo.pontosExtras}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Total Geral</div>
              <div className="mt-1 text-lg font-bold text-foreground tabular-nums">{resumo.pontuacaoFinal}</div>
            </Card>
            {mostrarColocacao && (
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Colocação</div>
                <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">{colocacao ?? '—'}º</div>
              </Card>
            )}
          </div>

          <TableCard titulo={`Pontuação por setor — ${linhaSel.nome}`} subtitulo={`${MESES_NOMES[mesNum - 1]}/${ano}`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-center">Pontos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porSetor.map(s => (
                  <TableRow key={s.label} className="border-gray-200/30 dark:border-gray-700/30">
                    <TableCell className="text-sm">{s.label}</TableCell>
                    <TableCell className="text-center text-sm font-semibold tabular-nums">{s.pontos}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-gray-200/30 bg-muted/40 font-semibold dark:border-gray-700/30">
                  <TableCell className="text-sm">Total dos setores</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{resumo.pontuacaoSetores}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableCard>

          <TableCard titulo="Bonificações extras" subtitulo="Motivo de cada bônus aplicado no mês">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Regra</TableHead>
                  <TableHead className="text-center">Situação</TableHead>
                  <TableHead className="text-center">Pontos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-gray-200/30 dark:border-gray-700/30">
                  <TableCell className="text-sm">EBITDA (Orçado × Realizado)</TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {resumo.ebitdaOk ? 'Meta batida' : 'Meta não batida'}
                  </TableCell>
                  <TableCell className="text-center text-sm font-semibold tabular-nums">
                    {resumo.ebitdaOk ? '+50' : '0'}
                  </TableCell>
                </TableRow>
                {(['gente', 'frota', 'seguranca'] as const).map(setor => {
                  const posicao = resumo.posicoesAmbev[setor]
                  const bonus = posicao === null ? 0 : posicao === 1 ? 50 : posicao <= 5 ? 30 : 0
                  return (
                    <TableRow key={setor} className="border-gray-200/30 dark:border-gray-700/30">
                      <TableCell className="text-sm">{LABEL_AMBEV[setor]}</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {posicao !== null ? `${posicao}º lugar` : 'Sem posição lançada'}
                      </TableCell>
                      <TableCell className="text-center text-sm font-semibold tabular-nums">
                        {bonus > 0 ? `+${bonus}` : '0'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableCard>
        </>
      )}
    </div>
  )
}
