import { useState } from 'react'
import { AlertTriangle, Loader2, Pencil } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRvApuracao, MESES_NOMES, fmtPeso, fmtValor, type ItemApuracao, type RvApuracaoProps } from '@/hooks/useRvApuracao'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { AjusteManualDreDialog, formatarValorAutomatico } from '@/components/financeiro/AjusteManualDreDialog'
import { cn } from '@/lib/utils'
import type { FinanceiroDreAjusteIndicador } from '@/types'

export type { RvApuracaoProps }

const INDICADOR_LABEL: Record<FinanceiroDreAjusteIndicador, string> = { multas: 'Multas', vales: 'Vales' }

interface RvApuracaoUiProps extends RvApuracaoProps {
  /** Ajusta manualmente Multas/Vales do Financeiro (bug temporário do DRE) — só passado pela RvFinanceiroPage, e só o dono vê o botão de edição mesmo quando presente. */
  onSalvarAjusteFinanceiro?: (unidade: string, ano: number, mes: number, indicador: FinanceiroDreAjusteIndicador, valor: number, observacao: string) => Promise<boolean>
  onRemoverAjusteFinanceiro?: (id: string) => Promise<boolean>
}

/**
 * Apuração da RV de um setor: pra cada liderança do setor, cruza os
 * indicadores do mês e soma os pesos dos indicadores batidos sobre o valor
 * de RV da pessoa. Toda a lógica de cálculo vive em useRvApuracao (também
 * reaproveitado pelo Painel Geral, que agrega vários setores de uma vez
 * filtrando por unidade) — aqui só a tela de um setor só, com os filtros de
 * Ano/Mês/Operação.
 */
export function RvApuracao(props: RvApuracaoUiProps) {
  const { setorLabel, onSalvarAjusteFinanceiro, onRemoverAjusteFinanceiro } = props
  const { souDono } = useAuth()
  const {
    liderancas, linhas, anosDisponiveis, verAno, setVerAno, verMes, setVerMes,
    filtroOperacao, setFiltroOperacao, operacoesDisponiveis, carregandoTudo, totalBase, totalReceber,
  } = useRvApuracao(props)

  // ── Ajuste manual de Multas/Vales (só dono, só Financeiro) ──────────────
  const [alvoAjuste, setAlvoAjuste] = useState<{ unidadeNome: string; item: ItemApuracao } | null>(null)
  const [salvandoAjuste, setSalvandoAjuste] = useState(false)

  async function handleSalvarAjuste(valor: number, observacao: string) {
    if (!alvoAjuste?.item.ajusteFinanceiro || !onSalvarAjusteFinanceiro) return
    const { indicador, unidade, mes } = alvoAjuste.item.ajusteFinanceiro
    setSalvandoAjuste(true)
    const ok = await onSalvarAjusteFinanceiro(unidade, Number(verAno), mes, indicador, valor, observacao)
    setSalvandoAjuste(false)
    if (ok) setAlvoAjuste(null)
  }

  async function handleRemoverAjuste() {
    const id = alvoAjuste?.item.ajusteFinanceiro?.ajusteAtual?.id
    if (!id || !onRemoverAjusteFinanceiro) return
    setSalvandoAjuste(true)
    const ok = await onRemoverAjusteFinanceiro(id)
    setSalvandoAjuste(false)
    if (ok) setAlvoAjuste(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={verAno} onValueChange={setVerAno}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={verMes} onValueChange={setVerMes}>
            <SelectTrigger className={cn('w-40', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Operação</Label>
          <Select value={filtroOperacao} onValueChange={setFiltroOperacao}>
            <SelectTrigger className={cn('w-52', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {operacoesDisponiveis.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TableCard
        titulo={`Apuração da RV — ${MESES_NOMES[Number(verMes) - 1] ?? ''} ${verAno}`}
        subtitulo={carregandoTudo
          ? 'Carregando...'
          : `Setor ${setorLabel} · ${linhas.length} liderança(s) · % conquistado = soma dos pesos dos indicadores batidos · pendente não soma`}
      >
        {carregandoTudo ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando apuração...
          </div>
        ) : linhas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {liderancas.length === 0
              ? 'Nenhuma liderança cadastrada — importe a RV das lideranças na página Importação, aba Gente.'
              : `Nenhuma liderança do setor ${setorLabel} no cadastro — confira a coluna SETOR da planilha de RV.`}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Negócio</TableHead>
                <TableHead>Indicadores do mês</TableHead>
                <TableHead className="text-center">% RV</TableHead>
                <TableHead className="text-right">RV (R$)</TableHead>
                <TableHead className="text-right">A receber (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(l => (
                <TableRow
                  key={l.pessoa.id ?? l.pessoa.nome}
                  className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30"
                >
                  <TableCell className="text-sm font-medium">{l.pessoa.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.pessoa.funcao || '—'}</TableCell>
                  <TableCell className="text-sm">{l.pessoa.operacao}</TableCell>
                  <TableCell className={cn(
                    'text-sm',
                    !l.pessoa.negocio || l.pessoa.negocio === 'CONS'
                      ? 'text-muted-foreground'
                      : 'font-semibold text-blue-600 dark:text-blue-400',
                  )}>
                    {l.pessoa.negocio || '—'}
                  </TableCell>
                  <TableCell>
                    {!l.unidadeOk ? (
                      <span
                        title="Nenhuma unidade cadastrada casa com essa operação — confira o nome/apelidos na Administração"
                        className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        operação não reconhecida
                      </span>
                    ) : l.itens.length === 0 ? (
                      <span className="text-xs text-muted-foreground">sem indicadores com peso</span>
                    ) : (
                      <div className="flex max-w-xl flex-wrap gap-1">
                        {l.itens.map(item => (
                          <span
                            key={item.chave}
                            title={item.detalhe}
                            className={cn(
                              'inline-flex cursor-default items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                              item.status === 'bateu' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
                              item.status === 'perdeu' && 'bg-red-500/15 text-red-700 dark:text-red-400',
                              item.status === 'pendente' && 'bg-muted text-muted-foreground',
                              item.ajusteFinanceiro?.ajusteAtual && 'ring-1 ring-amber-500/50',
                            )}
                          >
                            {item.rotulo} · {fmtPeso(item.peso)}%
                            {souDono && item.ajusteFinanceiro && onSalvarAjusteFinanceiro && (
                              <button
                                type="button"
                                title={item.ajusteFinanceiro.ajusteAtual ? 'Ajuste manual ativo — clique pra editar/remover' : 'Ajustar manualmente (bug do DRE)'}
                                onClick={() => setAlvoAjuste({ unidadeNome: l.pessoa.operacao, item })}
                                className="cursor-pointer text-current/70 hover:text-current"
                              >
                                <Pencil className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell
                    title={l.pctPossivel > 0 ? `de ${fmtPeso(l.pctPossivel)}% possível no mês` : undefined}
                    className={cn(
                      'text-center text-sm font-semibold tabular-nums',
                      l.pctConquistado > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                    )}
                  >
                    {fmtPeso(l.pctConquistado)}%
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {fmtValor(l.pessoa.valor)}
                  </TableCell>
                  <TableCell className={cn(
                    'text-right text-sm font-semibold tabular-nums',
                    l.aReceber > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                  )}>
                    {fmtValor(l.aReceber)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-gray-200/30 dark:border-gray-700/30 bg-muted/40 font-semibold hover:bg-muted/40">
                <TableCell colSpan={6} className="text-sm">Total</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{fmtValor(totalBase)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums text-emerald-600 dark:text-emerald-400">
                  {fmtValor(totalReceber)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </TableCard>

      {onSalvarAjusteFinanceiro && onRemoverAjusteFinanceiro && (
        <AjusteManualDreDialog
          alvo={alvoAjuste?.item.ajusteFinanceiro ? {
            unidadeNome: alvoAjuste.unidadeNome,
            mesLabel: `${MESES_NOMES[Number(verMes) - 1] ?? ''}/${verAno}`,
            indicadorLabel: INDICADOR_LABEL[alvoAjuste.item.ajusteFinanceiro.indicador],
            ajusteAtual: alvoAjuste.item.ajusteFinanceiro.ajusteAtual,
            valorAutomaticoFmt: formatarValorAutomatico(alvoAjuste.item.ajusteFinanceiro.valorAutomatico),
          } : null}
          onFechar={() => setAlvoAjuste(null)}
          salvando={salvandoAjuste}
          onSalvar={handleSalvarAjuste}
          onRemover={handleRemoverAjuste}
        />
      )}
    </div>
  )
}
