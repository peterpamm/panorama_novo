import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency, parseNumeroPtBr } from '@/lib/utils'
import type { FinanceiroDreAjuste } from '@/types'

interface AjusteManualDreDialogProps {
  /** null = fechado. Contexto de quem está sendo editado (chave que não muda enquanto o popup está aberto). */
  alvo: { unidadeNome: string; mesLabel: string; indicadorLabel: string; ajusteAtual: FinanceiroDreAjuste | undefined; valorAutomaticoFmt: string } | null
  onFechar: () => void
  salvando: boolean
  onSalvar: (valor: number, observacao: string) => void
  onRemover: () => void
}

/**
 * Popup pra lançar/editar/remover o ajuste manual TEMPORÁRIO de Multas/Vales
 * do Financeiro (ver `FinanceiroDreAjuste`, types/index.ts) — compartilhado
 * entre a Reunião Resultados (AcompanhamentoReuniaoTab) e a Remuneração
 * Variável (RvApuracao), sempre atrás de `souDono`. Mostra o valor que o DRE
 * calcula hoje (o número furado, só pra referência) e deixa digitar o valor
 * correto — o resto da lógica de meta/pontuação/dispersão continua rodando
 * normal em cima desse número.
 */
export function AjusteManualDreDialog({ alvo, onFechar, salvando, onSalvar, onRemover }: AjusteManualDreDialogProps) {
  const [valorTexto, setValorTexto] = useState('')
  const [observacao, setObservacao] = useState('')

  useEffect(() => {
    if (!alvo) return
    setValorTexto(alvo.ajusteAtual ? String(alvo.ajusteAtual.valor).replace('.', ',') : '')
    setObservacao(alvo.ajusteAtual?.observacao ?? '')
  }, [alvo])

  if (!alvo) return null

  function handleSalvar() {
    const valor = parseNumeroPtBr(valorTexto)
    if (!Number.isFinite(valor)) return
    onSalvar(valor, observacao)
  }

  return (
    <Dialog open={alvo !== null} onOpenChange={v => { if (!v) onFechar() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajuste manual — {alvo.indicadorLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {alvo.unidadeNome} · {alvo.mesLabel} — bug temporário do DRE (não soma o que a unidade recebeu da Ambev).
            Valor que o DRE calcula hoje: <span className="font-semibold text-foreground">{alvo.valorAutomaticoFmt}</span>.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="ajuste-valor">Valor correto (R$)</Label>
            <Input id="ajuste-valor" value={valorTexto} onChange={e => setValorTexto(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ajuste-obs">Observação (opcional)</Label>
            <Input id="ajuste-obs" value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex: conferido com a unidade em 18/08" />
          </div>
          {alvo.ajusteAtual && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Ajuste ativo — sem ele, a Reunião Resultados/RV usariam {alvo.valorAutomaticoFmt} (valor do DRE).
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {alvo.ajusteAtual ? (
            <Button variant="outline" onClick={onRemover} disabled={salvando} className="text-red-600 hover:text-red-700 dark:text-red-400">
              Remover ajuste
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onFechar} disabled={salvando}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando || valorTexto.trim() === ''} className="gap-2">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Formata o valor atual (automático ou undefined) pra exibir no popup — mesmo padrão R$ do resto do app. */
export function formatarValorAutomatico(valor: number | null): string {
  return valor === null ? 'sem dado' : formatCurrency(valor)
}
