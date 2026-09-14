import { useState } from 'react'
import { Loader2, Pencil, Trophy } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useReuniaoDados } from '@/hooks/useReuniaoDados'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AjusteManualDreDialog, formatarValorAutomatico } from '@/components/financeiro/AjusteManualDreDialog'
import { cn } from '@/lib/utils'
import { formatarResultado, resolverNaturezaFormato, TERMOMETRO_LIMIAR_BOM } from '@/lib/reuniao-resultados'
import type { FinanceiroDreAjusteIndicador, ReuniaoIndicador, ReuniaoSetor } from '@/types'

const INDICADOR_LABEL: Record<FinanceiroDreAjusteIndicador, string> = { multas: 'Multas', vales: 'Vales' }
const MES_LABEL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const MESES_NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const ANOS = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

interface AcompanhamentoReuniaoTabProps {
  setor: ReuniaoSetor
}

export function AcompanhamentoReuniaoTab({ setor }: AcompanhamentoReuniaoTabProps) {
  const { souDono } = useAuth()
  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const {
    carregando, indicadores, participantesPorIndicador,
    valoresInput, setValoresInput, salvando, handleSalvar,
    resultadoEMeta, formatoEfetivo, pontosGanhos, unidadesDoTotal, totalPorUnidadeMes, maiorPorMes, nomesParticipaveis,
    ajusteFinanceiroDoIndicador, salvarAjusteFinanceiro, removerAjusteFinanceiro,
  } = useReuniaoDados(setor, ano)

  // ── Ajuste manual de Multas/Vales (só dono, só Financeiro) ──────────────
  const [alvoAjuste, setAlvoAjuste] = useState<{ ind: ReuniaoIndicador; unidade: string; negocio: string; unidadeNome: string; mes: number; indicador: FinanceiroDreAjusteIndicador } | null>(null)
  const [salvandoAjuste, setSalvandoAjuste] = useState(false)
  const infoAlvo = alvoAjuste ? ajusteFinanceiroDoIndicador(alvoAjuste.ind, alvoAjuste.unidade, alvoAjuste.negocio, alvoAjuste.mes) : null

  async function handleSalvarAjuste(valor: number, observacao: string) {
    if (!alvoAjuste) return
    setSalvandoAjuste(true)
    const ok = await salvarAjusteFinanceiro(alvoAjuste.unidade, Number(ano), alvoAjuste.mes, alvoAjuste.indicador, valor, observacao)
    setSalvandoAjuste(false)
    if (ok) setAlvoAjuste(null)
  }

  async function handleRemoverAjuste() {
    if (!alvoAjuste || !infoAlvo?.ajuste?.id) return
    setSalvandoAjuste(true)
    const ok = await removerAjusteFinanceiro(infoAlvo.ajuste.id)
    setSalvandoAjuste(false)
    if (ok) setAlvoAjuste(null)
  }

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
            const { natureza } = resolverNaturezaFormato(ind)
            return (
              <TableCard
                key={ind.id}
                titulo={ind.nome_t1 ? `${ind.nome} / ${ind.nome_t1}` : ind.nome}
                subtitulo={ind.fonte === 'termometro'
                  ? `Automático · pontuação direta da planilha (máx. ${ind.pontos}) · sem meta`
                  : ind.nome_t1
                    ? `Automático · meta/resultado/pontos vêm prontos da planilha (direção pode variar entre ${ind.nome}/${ind.nome_t1}) · vale ${ind.pontos} pontos`
                    : automatico
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
                      {participantes.map(p => (
                        <TableRow key={`${p.unidade}|${p.negocio}`}>
                          <TableCell className="sticky left-0 z-10 bg-inherit text-sm font-medium">{nomesParticipaveis[`${p.unidade}|${p.negocio}`] ?? p.unidade}</TableCell>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => {
                            const chave = `${ind.id}|${p.unidade}|${p.negocio}|${mes}`
                            const { resultado } = resultadoEMeta(ind, p.unidade, p.negocio, mes)
                            const pontos = pontosGanhos(ind, p.unidade, p.negocio, mes)
                            const infoAjuste = souDono ? ajusteFinanceiroDoIndicador(ind, p.unidade, p.negocio, mes) : null
                            return (
                              <TableCell key={mes} className="p-1.5 text-center">
                                {ind.fonte === 'termometro' ? (
                                  pontos === null ? (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  ) : (
                                    <p className={cn(
                                      'text-sm font-semibold tabular-nums',
                                      pontos >= TERMOMETRO_LIMIAR_BOM ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                                    )}>
                                      {pontos} pts
                                    </p>
                                  )
                                ) : (
                                  <>
                                    {automatico ? (
                                      <div className="flex items-center justify-center gap-1">
                                        <p className={cn('text-xs tabular-nums', infoAjuste?.ajuste ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-foreground')}>
                                          {formatarResultado(resultado, formatoEfetivo(ind, p.unidade, p.negocio, mes))}
                                        </p>
                                        {infoAjuste && (
                                          <button
                                            type="button"
                                            title={infoAjuste.ajuste ? 'Ajuste manual ativo — clique pra editar/remover' : 'Ajustar manualmente (bug do DRE)'}
                                            onClick={() => setAlvoAjuste({
                                              ind, unidade: p.unidade, negocio: p.negocio, mes,
                                              unidadeNome: nomesParticipaveis[`${p.unidade}|${p.negocio}`] ?? p.unidade,
                                              indicador: infoAjuste.indicador,
                                            })}
                                            className={cn(
                                              'rounded p-0.5 text-muted-foreground/50 hover:text-foreground',
                                              infoAjuste.ajuste && 'text-amber-600 hover:text-amber-700 dark:text-amber-400',
                                            )}
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <Input
                                        value={valoresInput[chave] ?? ''}
                                        onChange={e => setValoresInput(prev => ({ ...prev, [chave]: e.target.value }))}
                                        onBlur={() => handleSalvar(ind, p.unidade, p.negocio, mes)}
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
                                  </>
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
                {unidadesDoTotal.map(p => (
                  <TableRow key={`${p.unidade}|${p.negocio}`}>
                    <TableCell className="sticky left-0 z-10 bg-inherit text-sm font-medium">{nomesParticipaveis[`${p.unidade}|${p.negocio}`] ?? p.unidade}</TableCell>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => {
                      const total = totalPorUnidadeMes[`${p.unidade}|${p.negocio}|${mes}`] ?? null
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

      <AjusteManualDreDialog
        alvo={alvoAjuste && infoAlvo ? {
          unidadeNome: alvoAjuste.unidadeNome,
          mesLabel: `${MES_LABEL[alvoAjuste.mes - 1]}/${ano}`,
          indicadorLabel: INDICADOR_LABEL[alvoAjuste.indicador],
          ajusteAtual: infoAlvo.ajuste,
          valorAutomaticoFmt: formatarValorAutomatico(infoAlvo.valorAutomatico),
        } : null}
        onFechar={() => setAlvoAjuste(null)}
        salvando={salvandoAjuste}
        onSalvar={handleSalvarAjuste}
        onRemover={handleRemoverAjuste}
      />
    </div>
  )
}
