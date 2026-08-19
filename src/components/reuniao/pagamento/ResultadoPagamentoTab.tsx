import { useEffect, useMemo, useState } from 'react'
import { Loader2, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useVencedoresReuniaoMensal } from '@/hooks/useVencedoresReuniaoMensal'
import { calcularPagamentos, SETOR_LABEL, vencedoresSemLideranca } from '@/lib/reuniao-pagamento'
import { mesAnterior } from '@/lib/rotinas-financeiras'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { cn, formatCurrency } from '@/lib/utils'
import type { ReuniaoPagamentoLideranca } from '@/types'

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ANOS = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

const DEFAULT = mesAnterior(new Date().getFullYear(), new Date().getMonth() + 1)
const VALOR_PREMIO_PADRAO = 200

/**
 * Relatório de pagamento do mês — quem venceu cada um dos 6 setores (mesmo
 * cálculo de "Ranking do Mês" de cada setor), com o prêmio já dividido entre
 * as lideranças cadastradas pra unidade+negócio+setor vencedor. "Gerar PDF"
 * é o print do navegador (Ctrl+P → Salvar como PDF): a tabela é a única
 * coisa que aparece impressa (sidebar/cabeçalho/filtros somem via
 * `print:hidden`), sem precisar de nenhuma biblioteca de PDF.
 */
export function ResultadoPagamentoTab() {
  const { toast } = useToast()
  const [ano, setAno] = useState(String(DEFAULT.ano))
  const [mes, setMes] = useState(String(DEFAULT.mes))
  const mesNum = Number(mes)

  const { carregando: carregandoVencedores, vencedores } = useVencedoresReuniaoMensal(ano, mesNum)

  const [liderancas, setLiderancas] = useState<ReuniaoPagamentoLideranca[]>([])
  const [valorPremio, setValorPremio] = useState(VALOR_PREMIO_PADRAO)
  const [carregandoCadastro, setCarregandoCadastro] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregandoCadastro(true)
      const [l, p] = await Promise.all([
        supabase.from('reuniao_pagamento_liderancas').select('*'),
        supabase.from('reuniao_pagamento_premio').select('*').maybeSingle(),
      ])
      if (l.error) toast({ title: 'Erro ao carregar lideranças', description: l.error.message, variant: 'destructive' })
      setLiderancas((l.data as ReuniaoPagamentoLideranca[]) ?? [])
      setValorPremio(p.data ? Number((p.data as { valor: number }).valor) : VALOR_PREMIO_PADRAO)
      setCarregandoCadastro(false)
    }
    carregar()
  }, [toast])

  const pagamentos = useMemo(
    () => calcularPagamentos(vencedores, liderancas, valorPremio),
    [vencedores, liderancas, valorPremio],
  )
  const semLideranca = useMemo(() => vencedoresSemLideranca(vencedores, liderancas), [vencedores, liderancas])
  const total = useMemo(() => pagamentos.reduce((acc, p) => acc + p.valor, 0), [pagamentos])

  const carregando = carregandoVencedores || carregandoCadastro

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={() => window.print()} disabled={carregando || pagamentos.length === 0} className="gap-2">
          <Printer className="h-4 w-4" />
          Gerar PDF
        </Button>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground print:hidden">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : (
        <>
          {semLideranca.length > 0 && (
            <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-700 print:hidden dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
              <p className="font-semibold">
                {semLideranca.length} setor(es) venceram o mês mas não têm liderança cadastrada — não entram no relatório:
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {semLideranca.map(v => (
                  <li key={`${v.setor}|${v.unidade}|${v.negocio}`}>{SETOR_LABEL[v.setor]} — {v.nomeUnidade}</li>
                ))}
              </ul>
              <p className="mt-1">Cadastre em Pagamento &gt; Cadastro pra essa pessoa entrar no relatório.</p>
            </div>
          )}

          {pagamentos.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground print:hidden">
              Nenhum setor com vencedor e liderança cadastrada nesse mês.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200/30 bg-white shadow-xl shadow-gray-200/20 print:rounded-none print:border-0 print:shadow-none dark:border-gray-700/30 dark:bg-gray-800 print:dark:bg-white">
              <div className="border-b border-white/10 bg-gradient-to-r from-[hsl(222,45%,20%)] to-[hsl(222,35%,30%)] px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-white dark:from-[hsl(224,28%,14%)] dark:to-[hsl(224,22%,20%)] print:from-[hsl(222,45%,20%)] print:to-[hsl(222,35%,30%)]">
                {MESES_NOMES[mesNum - 1]} / {ano}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left dark:border-gray-700 print:border-gray-300">
                    <th className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-200 print:text-gray-900">NOME</th>
                    <th className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-200 print:text-gray-900">SETOR</th>
                    <th className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-200 print:text-gray-900">FILIAL</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-200 print:text-gray-900">VALOR</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-200 print:text-gray-900">NÚMERO DO EXTRATTA</th>
                  </tr>
                </thead>
                <tbody>
                  {pagamentos.map((p, i) => {
                    const dividido = pagamentos.filter(x => x.setor === p.setor && x.unidade === p.unidade && x.negocio === p.negocio).length > 1
                    return (
                      <tr
                        key={`${p.setor}|${p.unidade}|${p.negocio}|${p.nome}`}
                        className={cn(
                          'border-b border-gray-100 last:border-0 dark:border-gray-700/50 print:border-gray-200',
                          dividido && 'bg-amber-50 dark:bg-amber-500/10 print:bg-amber-50',
                          i % 2 === 1 && !dividido && 'bg-gray-50/50 dark:bg-gray-900/20 print:bg-transparent',
                        )}
                      >
                        <td className="px-4 py-2 text-gray-800 dark:text-gray-100 print:text-black">{p.nome}</td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300 print:text-black">{SETOR_LABEL[p.setor]}</td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300 print:text-black">{p.nomeUnidade}</td>
                        <td className={cn('px-4 py-2 text-right tabular-nums text-gray-800 dark:text-gray-100 print:text-black', dividido && 'font-bold')}>
                          {formatCurrency(p.valor)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300 print:text-black">{p.numeroExtratta}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} />
                    <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-gray-900 dark:text-white print:text-black">
                      {formatCurrency(total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {pagamentos.length > 0 && (
            <p className="text-xs text-muted-foreground print:hidden">
              Linhas destacadas: prêmio dividido entre mais de uma liderança da mesma filial/setor.
            </p>
          )}
        </>
      )}
    </div>
  )
}
