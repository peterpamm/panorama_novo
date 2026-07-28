import { useState } from 'react'
import { Loader2, Trophy } from 'lucide-react'
import { useReuniaoDados } from '@/hooks/useReuniaoDados'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { calcularPontosGanhos, formatarResultado, resolverNaturezaFormato } from '@/lib/reuniao-resultados'
import type { ReuniaoSetor } from '@/types'

const MESES_NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const ANOS = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

interface AcompanhamentoReuniaoTabProps {
  setor: ReuniaoSetor
}

export function AcompanhamentoReuniaoTab({ setor }: AcompanhamentoReuniaoTabProps) {
  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const {
    carregando, indicadores, participantesPorIndicador,
    valoresInput, setValoresInput, salvando, handleSalvar,
    resultadoEMeta, unidadesDoTotal, totalPorUnidadeMes, maiorPorMes, nomesUnidades,
  } = useReuniaoDados(setor, ano)

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Ano</Label>
        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
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
          {indicadores.map(ind => {
            const participantes = participantesPorIndicador[ind.id] ?? []
            const automatico = ind.fonte !== 'manual'
            const { natureza, formato } = resolverNaturezaFormato(ind)
            return (
              <TableCard
                key={ind.id}
                titulo={ind.nome}
                subtitulo={automatico
                  ? `Automático · ${natureza === 'custo' ? 'menor é melhor' : 'maior é melhor'} · vale ${ind.pontos} pontos`
                  : `Meta: ${natureza === 'custo' ? '≤' : '≥'} ${ind.meta} · vale ${ind.pontos} pontos`}
              >
                {participantes.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma unidade participando — configure em Cadastro &gt; Participantes.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 z-10 min-w-[160px] bg-inherit">Unidade</TableHead>
                        {MESES_NOMES.map(m => (
                          <TableHead key={m} className="min-w-[100px] text-center">{m}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participantes.map(unidadeCodigo => (
                        <TableRow key={unidadeCodigo}>
                          <TableCell className="sticky left-0 z-10 bg-inherit text-sm font-medium">{nomesUnidades[unidadeCodigo] ?? unidadeCodigo}</TableCell>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => {
                            const chave = `${ind.id}|${unidadeCodigo}|${mes}`
                            const { resultado, meta } = resultadoEMeta(ind, unidadeCodigo, mes)
                            const pontos = calcularPontosGanhos(resultado, meta, natureza, ind.pontos)
                            return (
                              <TableCell key={mes} className="p-1.5 text-center">
                                {automatico ? (
                                  <p className="text-xs tabular-nums text-foreground">{formatarResultado(resultado, formato)}</p>
                                ) : (
                                  <Input
                                    value={valoresInput[chave] ?? ''}
                                    onChange={e => setValoresInput(prev => ({ ...prev, [chave]: e.target.value }))}
                                    onBlur={() => handleSalvar(ind, unidadeCodigo, mes)}
                                    disabled={salvando === chave}
                                    className="h-8 w-full text-center text-xs tabular-nums"
                                    placeholder="—"
                                  />
                                )}
                                {pontos !== null && (
                                  <p className={cn(
                                    'mt-1 text-[11px] font-semibold',
                                    pontos > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                                  )}>
                                    {pontos} pts
                                  </p>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableCard>
            )
          })}

          <TableCard titulo="Total" subtitulo="Soma dos pontos de todos os indicadores — ranking do mês">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 min-w-[160px] bg-inherit">Unidade</TableHead>
                  {MESES_NOMES.map(m => (
                    <TableHead key={m} className="min-w-[90px] text-center">{m}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {unidadesDoTotal.map(unidadeCodigo => (
                  <TableRow key={unidadeCodigo}>
                    <TableCell className="sticky left-0 z-10 bg-inherit text-sm font-medium">{nomesUnidades[unidadeCodigo] ?? unidadeCodigo}</TableCell>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => {
                      const total = totalPorUnidadeMes[`${unidadeCodigo}|${mes}`] ?? null
                      const ehMelhor = total !== null && total === maiorPorMes[mes] && total > 0
                      return (
                        <TableCell key={mes} className={cn('text-center text-sm font-semibold tabular-nums', total === null && 'text-muted-foreground font-normal')}>
                          {ehMelhor && <Trophy className="mr-1 inline h-3.5 w-3.5 text-amber-500" />}
                          {total === null ? '—' : total}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </>
      )}
    </div>
  )
}
