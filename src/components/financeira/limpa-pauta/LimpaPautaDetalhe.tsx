import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { cn, formatCurrency, parseNumeroPtBr } from '@/lib/utils'
import { CAMPOS_APROVACAO, STATUS_APROVACAO_LABEL, STATUS_APROVACAO_OPCOES, STATUS_APROVACAO_PILL, statusAtualLimpaPauta } from '@/lib/limpa-pauta'
import type { LimpaPauta, StatusAprovacaoLimpaPauta, Unidade } from '@/types'

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const SEM_PAGAMENTO = '__sem__'
const ANOS_PAGAMENTO = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

interface LimpaPautaDetalheProps {
  registro: LimpaPauta
  unidades: Unidade[]
  onAtualizado: () => void
  /** Só admin edita (Select/Input viram texto estático pra quem não é). */
  isAdmin: boolean
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  )
}

/** Formata o status cru do Freightech ('EM_ANALISE' → 'Em Análise') só pra leitura — o valor salvo continua o original. */
function formatStatusFreightech(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Detalhe de um registro de Limpa Pauta — igual ao padrão de
 * `EncontroContasDetalhe.tsx` (UPDATE direto do admin por campo, sem RPC: não
 * há histórico/validação aqui, só as 3 aprovações internas). Dados vindos do
 * Freightech (Segmento/Categoria/Unidade/Status/Valor) ficam só pra leitura
 * — quem muda é a planilha reimportada, não essa tela. Leitura é liberada
 * geral (qualquer usuário pode abrir uma linha), mas só admin edita —
 * `isAdmin` troca os campos editáveis (Select/Input) por texto estático
 * pra quem não é (a RLS de UPDATE já bloqueia a escrita de qualquer forma,
 * isso aqui é só pra não oferecer um campo que vai falhar ao salvar).
 */
export function LimpaPautaDetalhe({ registro, unidades, onAtualizado, isAdmin }: LimpaPautaDetalheProps) {
  const { toast } = useToast()
  const nomeUnidade = unidades.find(u => u.codigo === registro.unidade)?.nome ?? registro.unidade

  const [justificativas, setJustificativas] = useState({
    god: registro.justificativa_god,
    geo: registro.justificativa_geo,
    rpo: registro.justificativa_rpo,
  })
  const [observacao, setObservacao] = useState(registro.observacao)
  const [valorPagoTexto, setValorPagoTexto] = useState(() => registro.valor_pago.toFixed(2).replace('.', ','))
  const statusAtual = statusAtualLimpaPauta(registro)

  useEffect(() => {
    setJustificativas({ god: registro.justificativa_god, geo: registro.justificativa_geo, rpo: registro.justificativa_rpo })
    setObservacao(registro.observacao)
    setValorPagoTexto(registro.valor_pago.toFixed(2).replace('.', ','))
  }, [registro.id, registro.justificativa_god, registro.justificativa_geo, registro.justificativa_rpo, registro.observacao, registro.valor_pago])

  async function handleCampo(campo: string, valor: unknown) {
    const { error } = await supabase.from('limpa_pauta').update({ [campo]: valor }).eq('id', registro.id)
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return }
    onAtualizado()
  }

  function handleSalvarJustificativa(chave: 'god' | 'geo' | 'rpo', campo: string) {
    const valorAtual = registro[campo as keyof LimpaPauta] as string
    if (justificativas[chave] === valorAtual) return
    handleCampo(campo, justificativas[chave])
  }

  function handleSalvarObservacao() {
    if (observacao === registro.observacao) return
    handleCampo('observacao', observacao)
  }

  function handleSalvarValorPago() {
    const novoValor = parseNumeroPtBr(valorPagoTexto)
    if (Number.isNaN(novoValor) || novoValor < 0) {
      toast({ title: 'Valor pago inválido', variant: 'destructive' })
      setValorPagoTexto(registro.valor_pago.toFixed(2).replace('.', ','))
      return
    }
    if (novoValor === registro.valor_pago) return
    handleCampo('valor_pago', novoValor)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {MESES_NOMES[registro.mes - 1]}/{registro.ano} · {registro.segmento}
        </p>
        <h3 className="text-xl font-semibold text-foreground">{registro.categoria}</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-4">
        <InfoItem label="Unidade">{nomeUnidade}</InfoItem>
        <InfoItem label="Valor solicitado">{formatCurrency(registro.valor_solicitado)}</InfoItem>
        <InfoItem label="Status Freightech">{formatStatusFreightech(registro.status_freightech)}</InfoItem>
        <InfoItem label="Status atual">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_APROVACAO_PILL[statusAtual])}>
            {STATUS_APROVACAO_LABEL[statusAtual]}
          </span>
        </InfoItem>
      </div>

      <div className="space-y-1.5">
        <Label>Observação</Label>
        {isAdmin ? (
          <Textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            onBlur={handleSalvarObservacao}
            placeholder="Do que se trata esse chamado..."
            className="min-h-[70px]"
          />
        ) : (
          <p className="min-h-[70px] whitespace-pre-wrap rounded-md border bg-muted/30 px-3 py-2 text-sm text-foreground">
            {observacao.trim() || <span className="italic text-muted-foreground">Nenhuma observação registrada.</span>}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Aprovações internas</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {CAMPOS_APROVACAO.map(({ chave, titulo, campoStatus, campoJustificativa }) => {
            const status = registro[campoStatus] as StatusAprovacaoLimpaPauta
            return (
              <div key={chave} className="space-y-2 rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">{titulo}</Label>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_APROVACAO_PILL[status])}>
                    {STATUS_APROVACAO_LABEL[status]}
                  </span>
                </div>
                {isAdmin ? (
                  <>
                    <Select value={status} onValueChange={v => handleCampo(campoStatus, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_APROVACAO_OPCOES.map(s => <SelectItem key={s} value={s}>{STATUS_APROVACAO_LABEL[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      value={justificativas[chave]}
                      onChange={e => setJustificativas(j => ({ ...j, [chave]: e.target.value }))}
                      onBlur={() => handleSalvarJustificativa(chave, campoJustificativa)}
                      placeholder="Justificativa..."
                      className="h-8 text-xs"
                    />
                  </>
                ) : (
                  <p className="min-h-[32px] text-xs text-muted-foreground">
                    {justificativas[chave].trim() || 'Sem justificativa registrada.'}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Pagamento</p>
        <p className="text-xs text-muted-foreground">
          Às vezes a Ambev paga só parte do valor solicitado — registre quanto foi pago e em que mês, pra rastrear depois.
        </p>
        {isAdmin ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Valor pago</Label>
              <Input
                value={valorPagoTexto}
                onChange={e => setValorPagoTexto(e.target.value)}
                onBlur={handleSalvarValorPago}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mês do pagamento</Label>
              <Select
                value={registro.mes_pagamento ? String(registro.mes_pagamento) : SEM_PAGAMENTO}
                onValueChange={v => handleCampo('mes_pagamento', v === SEM_PAGAMENTO ? null : Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_PAGAMENTO}>—</SelectItem>
                  {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ano do pagamento</Label>
              <Select
                value={registro.ano_pagamento ? String(registro.ano_pagamento) : SEM_PAGAMENTO}
                onValueChange={v => handleCampo('ano_pagamento', v === SEM_PAGAMENTO ? null : Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_PAGAMENTO}>—</SelectItem>
                  {ANOS_PAGAMENTO.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <InfoItem label="Valor pago">{registro.valor_pago > 0 ? formatCurrency(registro.valor_pago) : '—'}</InfoItem>
            <InfoItem label="Mês do pagamento">{registro.mes_pagamento ? MESES_NOMES[registro.mes_pagamento - 1] : '—'}</InfoItem>
            <InfoItem label="Ano do pagamento">{registro.ano_pagamento ?? '—'}</InfoItem>
          </div>
        )}
      </div>
    </div>
  )
}
