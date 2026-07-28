import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'
import type { ResultadoDescontoCivf, ResultadoDescontoStressTest } from '@/types'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const INDICADORES = [
  { id: 'civf', nome: 'Desconto CIVF', tabelaResultado: 'resultados_desconto_civf', tabelaMeta: 'rv_desconto_civf_meta' },
  { id: 'stress_test', nome: 'Desconto Stress Test', tabelaResultado: 'resultados_desconto_stress_test', tabelaMeta: 'rv_desconto_stress_test_meta' },
] as const

interface DescontoMeta {
  meta_valor: number
  peso: number
}

interface LinhaDesconto {
  unidade: string
  nome: string
  meses: (number | null)[]
}

function fmtValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Acompanhamento do Desconto CIVF e do Desconto Stress Test — resultado
 * mensal (R$) importado (Importação &gt; Frota) vs meta única — mesma regra
 * e mesmos números usados na apuração da RV (RvApuracao, props
 * incluirDescontoCivf/incluirDescontoStressTest). Quanto menor melhor
 * (desconto é uma penalidade). Um seletor alterna entre os dois indicadores.
 */
export function DescontosFrotaCard() {
  const [indId, setIndId] = useState<(typeof INDICADORES)[number]['id']>('civf')
  const ind = INDICADORES.find(i => i.id === indId) ?? INDICADORES[0]
  const { unidades } = useUnidades()
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const [resultados, setResultados] = useState<(ResultadoDescontoCivf | ResultadoDescontoStressTest)[]>([])
  const [meta, setMeta] = useState<DescontoMeta | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const [r, m] = await Promise.all([
        supabase.from(ind.tabelaResultado).select('*'),
        supabase.from(ind.tabelaMeta).select('*').maybeSingle(),
      ])
      setResultados((r.data as (ResultadoDescontoCivf | ResultadoDescontoStressTest)[]) ?? [])
      setMeta(m.data as DescontoMeta | null)
      setCarregando(false)
    }
    carregar()
  }, [ind.tabelaResultado, ind.tabelaMeta])

  const anosDisponiveis = useMemo(
    () => Array.from(new Set(resultados.map(r => r.ano))).sort((a, b) => b - a),
    [resultados],
  )
  const [ano, setAno] = useState('')
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(ano))) setAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, ano])

  const linhas = useMemo<LinhaDesconto[]>(() => {
    const anoNum = Number(ano)
    const doAno = resultados.filter(r => r.ano === anoNum)
    if (!anoNum || doAno.length === 0) return []

    const codigos = Array.from(new Set(doAno.map(r => r.unidade)))
      .sort((a, b) => (nomesUnidades.get(a) ?? a).localeCompare(nomesUnidades.get(b) ?? b))

    return codigos.map(codigo => ({
      unidade: codigo,
      nome: nomesUnidades.get(codigo) ?? codigo,
      meses: Array.from({ length: 12 }, (_, i) => doAno.find(r => r.unidade === codigo && r.mes === i + 1)?.valor ?? null),
    }))
  }, [resultados, ano, nomesUnidades])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Indicador</Label>
          <Select value={indId} onValueChange={v => setIndId(v as typeof indId)}>
            <SelectTrigger className={cn('w-56', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {INDICADORES.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TableCard
        titulo={ind.nome}
        subtitulo={carregando
          ? 'Carregando...'
          : `${ano} · resultado do mês (R$) vs meta · quanto menor melhor`}
      >
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : linhas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Sem resultados importados — importe na página Importação, aba Frota.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                {MESES_ABREV.map(m => (
                  <TableHead key={m} className="text-center">{m}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(l => (
                <TableRow key={l.unidade} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="py-1.5 text-sm font-medium">
                    {l.nome}
                    {meta === null && <span className="ml-1 text-[10px] text-muted-foreground">(sem meta)</span>}
                  </TableCell>
                  {l.meses.map((valor, i) => {
                    if (valor === null) {
                      return <TableCell key={i} className="py-1.5 text-center text-xs text-muted-foreground">—</TableCell>
                    }
                    const bateu = meta === null ? null : valor <= meta.meta_valor
                    return (
                      <TableCell
                        key={i}
                        title={meta !== null ? `Meta: R$ ${fmtValor(meta.meta_valor)}` : 'Sem meta cadastrada'}
                        className={cn(
                          'py-1.5 text-center text-xs font-medium tabular-nums',
                          bateu === null
                            ? 'text-foreground'
                            : bateu
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                        )}
                      >
                        {fmtValor(valor)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </div>
  )
}
